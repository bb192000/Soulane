// ── Types ───────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  albumName: string;
  albumArt: string;
  durationMs: number;
}

export interface SyncTelemetry {
  status: 'SYNCED' | 'SYNCING' | 'SYNC_LOST' | 'BUFFERING' | 'PAUSED';
  clockOffset: number;
  confidence: number;
  playbackRate: number;
  positionMs: number;
  isBuffering: boolean;
}

export type PlaybackCommand = 
  | { type: 'SEEK'; position: number }
  | { type: 'NUDGE_RATE'; rate: number }
  | { type: 'PAUSE' }
  | { type: 'PLAY' };

export interface AdapterCapabilities {
  supportsRateAdjustment: boolean;
  estimatedSeekLatencyMs: number;
}

// ── PlaybackAdapter Base Class ──────────────────────────────────────────

const SYNC_THRESHOLD_MS = 200;
const NUDGE_RATE_FAST = 1.05;
const NUDGE_RATE_SLOW = 0.95;
const NUDGE_RATE_NORMAL = 1.0;

export abstract class PlaybackAdapter {
  protected capabilities: AdapterCapabilities;
  private _canonicalPositionMs = 0;
  private _canonicalIsPlaying = false;
  private _clockOffset = 0;
  private _confidence = 0;
  private _currentRate = 1.0;

  constructor(capabilities: AdapterCapabilities) {
    this.capabilities = capabilities;
  }

  abstract loadTrack(uri: string): Promise<void>;
  abstract getPhysicalPosition(): number;
  abstract isBuffering(): boolean;
  abstract executeCommand(command: PlaybackCommand): Promise<void>;

  public onSyncTick(serverTimestamp: number, positionMs: number, isPlaying: boolean) {
    const now = Date.now();
    this._clockOffset = now - serverTimestamp;
    this._canonicalIsPlaying = isPlaying;
    
    const latency = Math.max(0, this._clockOffset);
    this._canonicalPositionMs = isPlaying ? positionMs + latency : positionMs;

    this._runSyncCycle();
  }

  private _runSyncCycle() {
    if (!this._canonicalIsPlaying) {
      this._currentRate = NUDGE_RATE_NORMAL;
      return;
    }

    const physical = this.getPhysicalPosition();
    const drift = physical - this._canonicalPositionMs;
    const absDrift = Math.abs(drift);

    this._confidence = Math.max(0, 1 - absDrift / 2000);

    if (absDrift < SYNC_THRESHOLD_MS) {
      if (this._currentRate !== NUDGE_RATE_NORMAL) {
        this._currentRate = NUDGE_RATE_NORMAL;
        this.executeCommand({ type: 'NUDGE_RATE', rate: NUDGE_RATE_NORMAL });
      }
      return;
    }

    if (absDrift > 2000) {
      const seekTarget = this._canonicalPositionMs + this.capabilities.estimatedSeekLatencyMs;
      this.executeCommand({ type: 'SEEK', position: seekTarget });
      return;
    }

    if (this.capabilities.supportsRateAdjustment) {
      const newRate = drift < 0 ? NUDGE_RATE_FAST : NUDGE_RATE_SLOW;
      if (newRate !== this._currentRate) {
        this._currentRate = newRate;
        this.executeCommand({ type: 'NUDGE_RATE', rate: newRate });
      }
    } else {
      this.executeCommand({ type: 'SEEK', position: this._canonicalPositionMs });
    }
  }

  public getTelemetry(): SyncTelemetry {
    return {
      status: this._canonicalIsPlaying ? (this._confidence > 0.8 ? 'SYNCED' : 'SYNCING') : 'PAUSED',
      clockOffset: this._clockOffset,
      confidence: this._confidence,
      playbackRate: this._currentRate,
      positionMs: this.getPhysicalPosition(),
      isBuffering: this.isBuffering()
    };
  }
}
