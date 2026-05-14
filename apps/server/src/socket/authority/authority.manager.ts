import { redis } from '../../../config/redis';
import { eventBus } from '../events/event.bus';

export interface AuthorityState {
  roomId: string;
  hostSessionId: string;
  currentAuthoritySessionId: string;
  authorityEpoch: number;
  version: number;
  updatedAt: number;
  lockedUntil: number; // Failover Cooldown
}

export class AuthorityManager {
  
  constructor() {
    // Subscribe to sweeper death notices. We don't failover automatically; we arbitrate it.
    eventBus.on('AuthorityCandidateExpired', this.handleCandidateExpiration.bind(this));
  }

  async getAuthority(roomId: string): Promise<AuthorityState | null> {
    const data = await redis.hGetAll(`syncwave:room:${roomId}:authority`);
    if (!data || !data.hostSessionId) return null;

    return {
      roomId,
      hostSessionId: data.hostSessionId,
      currentAuthoritySessionId: data.currentAuthoritySessionId,
      authorityEpoch: parseInt(data.authorityEpoch, 10),
      version: parseInt(data.version, 10),
      updatedAt: parseInt(data.updatedAt, 10),
      lockedUntil: parseInt(data.lockedUntil || '0', 10)
    };
  }

  async initializeAuthority(roomId: string, hostSessionId: string) {
    await redis.hSet(`syncwave:room:${roomId}:authority`, {
      hostSessionId,
      currentAuthoritySessionId: hostSessionId,
      authorityEpoch: '1',
      version: '1',
      updatedAt: Date.now().toString(),
      lockedUntil: '0'
    });
  }

  async transitionAuthority(roomId: string, newAuthoritySessionId: string): Promise<AuthorityState | null> {
    const current = await this.getAuthority(roomId);
    if (!current) throw new Error('Room authority not initialized');

    const now = Date.now();
    // Cooldown logic to prevent thrashing
    if (now < current.lockedUntil) {
      console.warn(`[AuthorityManager] Failover locked for room ${roomId} until ${current.lockedUntil}`);
      return null; 
    }

    const nextEpoch = current.authorityEpoch + 1;
    const cooldownPeriodMs = 10000; // 10 seconds of stability before next allowed failover

    await redis.hSet(`syncwave:room:${roomId}:authority`, {
      currentAuthoritySessionId: newAuthoritySessionId,
      authorityEpoch: nextEpoch.toString(),
      updatedAt: now.toString(),
      lockedUntil: (now + cooldownPeriodMs).toString()
    });

    return await this.getAuthority(roomId);
  }

  private async handleCandidateExpiration(payload: { roomId: string, expiredSessionId: string }) {
    const { roomId, expiredSessionId } = payload;
    const auth = await this.getAuthority(roomId);
    
    if (auth && auth.currentAuthoritySessionId === expiredSessionId) {
      console.log(`[AuthorityManager] Authority session ${expiredSessionId} expired in room ${roomId}. Commencing failover arbitration.`);
      // Insert failover arbitration selection logic here.
      // E.g., fetch members, pick oldest active session, transition.
    }
  }
}
