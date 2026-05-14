import { eventBus } from '../events/event.bus';
import { CommittedPlaybackState } from '../sync-engine/playback.coordinator';

export interface TelemetryEvent {
  timestamp: number;
  type: 'SYNC_DRIFT' | 'AUTHORITY_TRANSFER' | 'RECONNECT_STORM' | 'PLAYBACK_STALL' | 'QUEUE_LATENCY';
  roomId: string;
  metadata: Record<string, any>;
}

/**
 * Autonomous Reliability & Product Intelligence Layer
 * System 2: Telemetry & Observability Engine
 * 
 * Rules:
 * - Strictly passive observation (read-only)
 * - NEVER mutates playback state
 * - Decoupled from the coordination critical path
 */
export class TelemetryCollector {
  private metricsBuffer: TelemetryEvent[] = [];

  start() {
    // Passively observe committed states for latency/drift analysis
    eventBus.on('PlaybackStateCommitted', (state: CommittedPlaybackState) => {
      this.analyzeCoordinationLatency(state);
    });

    // Passively observe structural system events
    eventBus.on('AuthorityTransferred', (data: { roomId: string, oldSession: string, newSession: string, reason: string }) => {
      this.pushMetric({
        timestamp: Date.now(),
        type: 'AUTHORITY_TRANSFER',
        roomId: data.roomId,
        metadata: data
      });
    });

    // Flush metrics periodically (to Time-Series DB, Datadog, etc.)
    setInterval(() => this.flush(), 15000);
    console.log('[TelemetryCollector] Started passive observability pipeline.');
  }

  private analyzeCoordinationLatency(state: CommittedPlaybackState) {
    const now = Date.now();
    const lagMs = now - state.serverTimestamp;

    // If event bus processing took longer than 500ms, flag a Queue Latency warning
    if (lagMs > 500) {
      this.pushMetric({
        timestamp: now,
        type: 'QUEUE_LATENCY',
        roomId: state.roomId,
        metadata: { version: state.version, lagMs }
      });
    }
  }

  pushMetric(event: TelemetryEvent) {
    // Bounded buffer to prevent memory leaks if flush fails
    if (this.metricsBuffer.length < 5000) {
      this.metricsBuffer.push(event);
    }
  }

  private flush() {
    if (this.metricsBuffer.length === 0) return;
    
    // Mock flush: In production, this writes to an append-only analytics store
    console.log(`[TelemetryCollector] Flushed ${this.metricsBuffer.length} anonymized reliability metrics.`);
    
    this.metricsBuffer = []; // clear buffer
  }
}

export const telemetryCollector = new TelemetryCollector();
