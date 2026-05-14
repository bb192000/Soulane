import { EventEmitter } from 'events';
import { CommittedPlaybackState } from '../sync-engine/playback.coordinator';

class SyncWaveEventBus extends EventEmitter {
  // Strongly typed event emitter wrapper can be added here
}

// Singletons for internal node communication
export const eventBus = new SyncWaveEventBus();
