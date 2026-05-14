/**
 * M1: BACKGROUND REAPER CHAOS TESTS
 * Tests PresenceSweeper + AuthorityManager failover logic
 */
import EventEmitter from 'events';

// ─── Minimal Redis Mock ───────────────────────────────────────────────────────
class RedisMock {
  store = new Map<string, string>();
  hashes = new Map<string, Map<string, string>>();
  zsets = new Map<string, Map<string, number>>();

  async hSet(key: string, fields: Record<string, string> | string, val?: string) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const m = this.hashes.get(key)!;
    if (typeof fields === 'object') Object.entries(fields).forEach(([f, v]) => m.set(f, v));
    else m.set(fields, val!);
  }
  async hGet(key: string, field: string) { return this.hashes.get(key)?.get(field) ?? null; }
  async hGetAll(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key)?.entries() ?? []);
  }
  async del(key: string) { this.hashes.delete(key); this.store.delete(key); return 1; }

  async zAdd(key: string, score: string | number, member: string) {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    this.zsets.get(key)!.set(member, +score);
  }
  async zRangeByScore(key: string, min: number, max: number) {
    return Array.from(this.zsets.get(key)?.entries() ?? [])
      .filter(([, s]) => s >= min && s <= max).map(([m]) => m);
  }
  async zRem(key: string, member: string) { this.zsets.get(key)?.delete(member); }
}

// ─── Inline Sweeper (same logic as presence.sweeper.ts) ──────────────────────
const SOFT_MS = 15000;
const HARD_MS = 35000;

class PresenceSweeper {
  constructor(private redis: RedisMock, private bus: EventEmitter) {}

  async recordHeartbeat(sid: string, roomId: string) {
    await this.redis.zAdd('syncwave:global:heartbeats', Date.now(), sid);
    await this.redis.hSet(`syncwave:presence:${sid}`, { roomId, status: 'ACTIVE' });
  }

  async sweep(now = Date.now()) {
    const dead = await this.redis.zRangeByScore('syncwave:global:heartbeats', 0, now - HARD_MS);
    for (const s of dead) await this.reap(s);
    const soft = await this.redis.zRangeByScore('syncwave:global:heartbeats', now - HARD_MS + 1, now - SOFT_MS);
    for (const s of soft) {
      await this.redis.hSet(`syncwave:presence:${s}`, 'status', 'UNSTABLE');
      this.bus.emit('PresenceStatusChanged', { sessionId: s, status: 'UNSTABLE' });
    }
  }

  private async reap(sid: string) {
    const roomId = await this.redis.hGet(`syncwave:presence:${sid}`, 'roomId');
    await this.redis.zRem('syncwave:global:heartbeats', sid);
    await this.redis.del(`syncwave:presence:${sid}`);
    if (roomId) this.bus.emit('AuthorityCandidateExpired', { roomId, expiredSessionId: sid });
  }
}

// ─── Inline AuthorityManager ──────────────────────────────────────────────────
class AuthorityManager {
  constructor(private redis: RedisMock, private bus: EventEmitter) {
    bus.on('AuthorityCandidateExpired', this.onExpiry.bind(this));
  }

  async init(roomId: string, hostSid: string) {
    await this.redis.hSet(`syncwave:room:${roomId}:authority`, {
      hostSessionId: hostSid, currentAuthoritySessionId: hostSid,
      authorityEpoch: '1', version: '1',
      updatedAt: Date.now().toString(), lockedUntil: '0'
    });
  }

  async get(roomId: string) {
    const d = await this.redis.hGetAll(`syncwave:room:${roomId}:authority`);
    if (!d.hostSessionId) return null;
    return {
      currentAuthoritySessionId: d.currentAuthoritySessionId,
      authorityEpoch: +d.authorityEpoch,
      lockedUntil: +(d.lockedUntil || '0')
    };
  }

  async transition(roomId: string, newSid: string) {
    const curr = await this.get(roomId);
    if (!curr || Date.now() < curr.lockedUntil) return null;
    await this.redis.hSet(`syncwave:room:${roomId}:authority`, {
      currentAuthoritySessionId: newSid,
      authorityEpoch: (curr.authorityEpoch + 1).toString(),
      updatedAt: Date.now().toString(),
      lockedUntil: (Date.now() + 10000).toString()
    });
    return this.get(roomId);
  }

  private async onExpiry({ roomId, expiredSessionId }: { roomId: string; expiredSessionId: string }) {
    const auth = await this.get(roomId);
    if (auth?.currentAuthoritySessionId === expiredSessionId)
      this.bus.emit('FailoverRequired', { roomId, expiredSessionId });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
describe('M1 — Background Reaper Chaos', () => {
  let redis: RedisMock;
  let bus: EventEmitter;
  let sweeper: PresenceSweeper;
  let authority: AuthorityManager;

  beforeEach(() => {
    redis = new RedisMock();
    bus = new EventEmitter();
    sweeper = new PresenceSweeper(redis, bus);
    authority = new AuthorityManager(redis, bus);
  });

  describe('Soft Timeout (15s)', () => {
    it('marks stale session UNSTABLE', async () => {
      await redis.zAdd('syncwave:global:heartbeats', Date.now() - 20000, 's1');
      await redis.hSet('syncwave:presence:s1', { roomId: 'r1', status: 'ACTIVE' });
      await sweeper.sweep();
      expect(await redis.hGet('syncwave:presence:s1', 'status')).toBe('UNSTABLE');
    });

    it('emits PresenceStatusChanged event', async () => {
      const events: any[] = [];
      bus.on('PresenceStatusChanged', e => events.push(e));
      await redis.zAdd('syncwave:global:heartbeats', Date.now() - 20000, 's2');
      await redis.hSet('syncwave:presence:s2', { roomId: 'r1', status: 'ACTIVE' });
      await sweeper.sweep();
      expect(events).toMatchObject([{ sessionId: 's2', status: 'UNSTABLE' }]);
    });

    it('leaves fresh session untouched', async () => {
      await sweeper.recordHeartbeat('s-fresh', 'r1');
      await sweeper.sweep();
      expect(await redis.hGet('syncwave:presence:s-fresh', 'status')).toBe('ACTIVE');
    });
  });

  describe('Hard Timeout / Reaper (35s)', () => {
    it('deletes dead session presence record', async () => {
      await redis.zAdd('syncwave:global:heartbeats', Date.now() - 40000, 'dead');
      await redis.hSet('syncwave:presence:dead', { roomId: 'r2', status: 'UNSTABLE' });
      await sweeper.sweep();
      expect(await redis.hGetAll('syncwave:presence:dead')).toEqual({});
    });

    it('removes dead session from sorted set', async () => {
      await redis.zAdd('syncwave:global:heartbeats', Date.now() - 40000, 'zombie');
      await redis.hSet('syncwave:presence:zombie', { roomId: 'r2', status: 'ACTIVE' });
      await sweeper.sweep();
      const remaining = await redis.zRangeByScore('syncwave:global:heartbeats', 0, Date.now());
      expect(remaining).not.toContain('zombie');
    });

    it('emits AuthorityCandidateExpired for reaped session', async () => {
      const events: any[] = [];
      bus.on('AuthorityCandidateExpired', e => events.push(e));
      await redis.zAdd('syncwave:global:heartbeats', Date.now() - 40000, 'host');
      await redis.hSet('syncwave:presence:host', { roomId: 'rX', status: 'ACTIVE' });
      await sweeper.sweep();
      expect(events[0]).toMatchObject({ roomId: 'rX', expiredSessionId: 'host' });
    });

    it('handles orphan session (no roomId) without crashing', async () => {
      await redis.zAdd('syncwave:global:heartbeats', Date.now() - 40000, 'orphan');
      await expect(sweeper.sweep()).resolves.not.toThrow();
    });
  });

  describe('Authority Failover', () => {
    it('emits FailoverRequired when authority session dies', async () => {
      const failover: any[] = [];
      bus.on('FailoverRequired', e => failover.push(e));
      await authority.init('room-A', 'dj-session');
      bus.emit('AuthorityCandidateExpired', { roomId: 'room-A', expiredSessionId: 'dj-session' });
      await new Promise(r => setTimeout(r, 10));
      expect(failover).toHaveLength(1);
      expect(failover[0].roomId).toBe('room-A');
    });

    it('does NOT emit FailoverRequired when a non-authority session dies', async () => {
      const failover: any[] = [];
      bus.on('FailoverRequired', e => failover.push(e));
      await authority.init('room-B', 'dj-session');
      bus.emit('AuthorityCandidateExpired', { roomId: 'room-B', expiredSessionId: 'listener' });
      await new Promise(r => setTimeout(r, 10));
      expect(failover).toHaveLength(0);
    });

    it('enforces 10s cooldown — rejects immediate second transition', async () => {
      await authority.init('room-C', 'original');
      const t1 = await authority.transition('room-C', 'new-1');
      expect(t1).not.toBeNull();
      const t2 = await authority.transition('room-C', 'new-2');
      expect(t2).toBeNull();
      expect((await authority.get('room-C'))?.currentAuthoritySessionId).toBe('new-1');
    });
  });

  describe('Multi-Session Mixed Sweep', () => {
    it('correctly categorises fresh / soft / dead sessions in one sweep', async () => {
      const now = Date.now();
      await redis.zAdd('syncwave:global:heartbeats', now, 'fresh');
      await redis.hSet('syncwave:presence:fresh', { roomId: 'r1', status: 'ACTIVE' });
      await redis.zAdd('syncwave:global:heartbeats', now - 20000, 'soft');
      await redis.hSet('syncwave:presence:soft', { roomId: 'r2', status: 'ACTIVE' });
      await redis.zAdd('syncwave:global:heartbeats', now - 40000, 'dead');
      await redis.hSet('syncwave:presence:dead', { roomId: 'r3', status: 'UNSTABLE' });

      await sweeper.sweep(now);

      expect(await redis.hGet('syncwave:presence:fresh', 'status')).toBe('ACTIVE');
      expect(await redis.hGet('syncwave:presence:soft', 'status')).toBe('UNSTABLE');
      expect(await redis.hGetAll('syncwave:presence:dead')).toEqual({});
    });
  });
});
