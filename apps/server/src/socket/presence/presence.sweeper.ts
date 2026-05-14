import { redis } from '../../../config/redis';
import { eventBus } from '../events/event.bus';

const SOFT_TIMEOUT_MS = 15000;
const HARD_TIMEOUT_MS = 35000;

export class PresenceSweeper {
  private sweeperInterval: NodeJS.Timeout | null = null;

  start() {
    this.sweeperInterval = setInterval(() => this.sweep(), 5000);
  }

  stop() {
    if (this.sweeperInterval) clearInterval(this.sweeperInterval);
  }

  private async sweep() {
    const now = Date.now();
    const hardTimeoutThreshold = now - HARD_TIMEOUT_MS;
    const softTimeoutThreshold = now - SOFT_TIMEOUT_MS;

    const deadSessions = await redis.zRangeByScore('syncwave:global:heartbeats', 0, hardTimeoutThreshold);
    for (const sessionId of deadSessions) {
      await this.handleHardTimeout(sessionId);
    }
    
    const unstableSessions = await redis.zRangeByScore('syncwave:global:heartbeats', hardTimeoutThreshold + 1, softTimeoutThreshold);
    for (const sessionId of unstableSessions) {
      await this.handleSoftTimeout(sessionId);
    }
  }

  // Uses sessionId instead of userId to track precise device/tab connections
  async recordHeartbeat(sessionId: string, roomId: string) {
    const now = Date.now();
    // In ioredis, the syntax is zadd(key, score, value)
    await redis.zAdd('syncwave:global:heartbeats', now.toString(), sessionId);
    await redis.hSet(`syncwave:presence:${sessionId}`, {
      roomId,
      status: 'ACTIVE'
    });
  }

  private async handleSoftTimeout(sessionId: string) {
    await redis.hSet(`syncwave:presence:${sessionId}`, 'status', 'UNSTABLE');
    eventBus.emit('PresenceStatusChanged', { sessionId, status: 'UNSTABLE' });
  }

  private async handleHardTimeout(sessionId: string) {
    const roomId = await redis.hGet(`syncwave:presence:${sessionId}`, 'roomId');
    
    await redis.zRem('syncwave:global:heartbeats', sessionId);
    await redis.del(`syncwave:presence:${sessionId}`);

    if (roomId) {
      // Sweeper does not decide failovers, it only announces deaths.
      eventBus.emit('AuthorityCandidateExpired', { roomId, expiredSessionId: sessionId });
    }
  }
}
