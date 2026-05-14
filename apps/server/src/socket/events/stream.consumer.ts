import { redis } from '../../../config/redis';
import { eventBus } from './event.bus';
import { CommittedPlaybackState } from '../sync-engine/playback.coordinator';
import { RoomSequentialQueue } from './room.queue';

const STREAM_KEY = 'syncwave:global:events';
const GROUP_NAME = 'syncwave:broadcast:group';
// In Kubernetes, this identifies the specific Pod/Replica taking ownership of pulled events
const CONSUMER_NAME = `node-${process.env.HOSTNAME || '1'}`; 

export class GlobalEventStreamConsumer {
  private isRunning = false;
  private roomQueues = new Map<string, RoomSequentialQueue>();

  async start() {
    this.isRunning = true;
    await this.initGroup();
    
    // Recovery for events that crashed mid-processing
    this.startPendingRecovery();
    this.startQueueEviction();

    this.poll();
    console.log(`[EventStreamConsumer] Started Consumer Group reading on ${STREAM_KEY} as ${CONSUMER_NAME}`);
  }

  stop() {
    this.isRunning = false;
  }

  private async initGroup() {
    try {
      // MKSTREAM creates the stream if it doesn't exist yet
      await redis.sendCommand(['XGROUP', 'CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM']);
    } catch (e: any) {
      if (!e.message.includes('BUSYGROUP')) {
        throw e;
      }
    }
  }

  private async poll() {
    while (this.isRunning) {
      try {
        // Block 5s, fetch new unread events for this consumer group
        const response = await redis.sendCommand([
          'XREADGROUP', 'GROUP', GROUP_NAME, CONSUMER_NAME,
          'BLOCK', '5000',
          'COUNT', '50',
          'STREAMS', STREAM_KEY, '>'
        ]);

        if (response) {
          await this.processStreams(response as any[]);
        }
      } catch (err) {
        console.error(`[EventStreamConsumer] XREADGROUP error:`, err);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Network backoff
      }
    }
  }

  private startPendingRecovery() {
    // Every 15 seconds, XAUTOCLAIM messages sitting in PEL (Pending Entries List) for > 30s
    setInterval(async () => {
      try {
        const response = await redis.sendCommand([
          'XAUTOCLAIM', STREAM_KEY, GROUP_NAME, CONSUMER_NAME, '30000', '0-0', 'COUNT', '100'
        ]);
        const messages = (response as any[])[1];
        if (messages && messages.length > 0) {
          console.warn(`[EventStreamConsumer] Reclaimed ${messages.length} pending events from crashed nodes.`);
          await this.processMessages(messages);
        }
      } catch (e) {
         console.error(`[EventStreamConsumer] XAUTOCLAIM error:`, e);
      }
    }, 15000);
  }

  private startQueueEviction() {
    // Evict empty queues that haven't seen activity in 30 minutes
    setInterval(() => {
      const now = Date.now();
      const idleTimeout = 30 * 60 * 1000;
      let evictedCount = 0;
      
      for (const [roomId, queue] of this.roomQueues.entries()) {
        if (queue.length === 0 && (now - queue.lastActivity > idleTimeout)) {
          this.roomQueues.delete(roomId);
          evictedCount++;
        }
      }
      
      if (evictedCount > 0) {
        console.log(`[EventStreamConsumer] Evicted ${evictedCount} idle room queues.`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private async processStreams(streams: any[]) {
    for (const stream of streams) {
      const messages = stream[1];
      await this.processMessages(messages);
    }
  }

  private async processMessages(messages: any[]) {
    for (const message of messages) {
      const messageId = message[0];
      const keyVals = message[1];
      const eventIndex = keyVals.indexOf('event');

      if (eventIndex !== -1) {
        const payloadStr = keyVals[eventIndex + 1];
        try {
          const payload = JSON.parse(payloadStr) as CommittedPlaybackState;
          
          // Force strict per-room sequential processing
          this.getRoomQueue(payload.roomId).enqueue(payload, async () => {
             // Only ACK once the broadcast pipeline is fully completely handled
             await redis.sendCommand(['XACK', STREAM_KEY, GROUP_NAME, messageId]);
          });

        } catch(e) {
           console.error("[EventStreamConsumer] Payload parse error. Acking to prevent poison pill.", e);
           await redis.sendCommand(['XACK', STREAM_KEY, GROUP_NAME, messageId]);
        }
      }
    }
  }

  private getRoomQueue(roomId: string) {
    if (!this.roomQueues.has(roomId)) {
      this.roomQueues.set(roomId, new RoomSequentialQueue());
    }
    return this.roomQueues.get(roomId)!;
  }
}
