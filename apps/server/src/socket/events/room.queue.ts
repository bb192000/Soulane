import { eventBus } from './event.bus';
import { CommittedPlaybackState } from '../sync-engine/playback.coordinator';

export class RoomSequentialQueue {
  private queue: { payload: CommittedPlaybackState, ackFn: () => Promise<void> }[] = [];
  private isProcessing = false;
  
  // Track state mathematically to reject stale out-of-order reclaimed events
  private lastAppliedVersion = 0;
  
  // Tracking for memory leak prevention
  public lastActivity = Date.now();

  enqueue(payload: CommittedPlaybackState, ackFn: () => Promise<void>) {
    this.lastActivity = Date.now();
    this.queue.push({ payload, ackFn });
    this.process();
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        // 1. Stale Replay Rejection
        // If consumer crashes and XAUTOCLAIM picks up an old message AFTER a new message 
        // was processed, mathematically reject it from being broadcasted.
        if (item.payload.version <= this.lastAppliedVersion) {
          console.warn(`[RoomSequentialQueue] Dropping stale reclaimed version ${item.payload.version} (current: ${this.lastAppliedVersion})`);
          await item.ackFn();
          continue;
        }

        // 2. Bounded Execution Timeout (Deadlock prevention)
        const emitTask = async () => {
          eventBus.emit('PlaybackStateCommitted', item.payload);
          this.lastAppliedVersion = item.payload.version;
          await item.ackFn();
        };

        const timeoutTask = new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Broadcast Timeout')), 2000)
        );

        // A single stuck broadcast will not hang the entire room queue forever
        await Promise.race([emitTask(), timeoutTask]);

      } catch (err) {
        console.error(`[RoomSequentialQueue] Error broadcasting event for room ${item.payload.roomId}:`, err);
        // If it throws, we do NOT execute ackFn. 
        // This allows XAUTOCLAIM to attempt recovery later, but the queue loop moves on cleanly.
      }
    }

    this.isProcessing = false;
  }
  
  get length() {
    return this.queue.length;
  }
}
