import { AdapterCapabilities, PlaybackCommand, SyncTelemetry, SyncStatus } from '../../types';

const SYNC_THRESHOLD_MS = 200;       // acceptable drift before correction
const NUDGE_RATE_FAST = 1.05;
const NUDGE_RATE_SLOW = 0.95;
const NUDGE_RATE_NORMAL = 1.0;
const POLL_INTERVAL_MS = 250;

export abstract class PlaybackAdapter {
  protected capabilities: AdapterCapabilities;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _onTelemetry: ((t: SyncTelemetry) => void) | null = null;

  // Canonical state (from server sync:tick)
  private _canonicalPositionMs = 0;
  private _canonicalIsPlaying = false;
  private _canonicalServerTs = 0;
  private _clockOffset = 0;          // local clock - server clock
  private _confidence = 0;
  private _currentRate = 1.0;

  private commandQueue: PlaybackCommand[] = [];
  private isExecuting = false;

  constructor(capabilities: AdapterCapabilities) {
    this.capabilities = capabilities;
  }

  // ── Abstract methods (platform must implement) ────────────────────────────

  abstract loadTrack(uri: string): Promise<void>;
  abstract getPhysicalPosition(): number;
  abstract isBuffering(): boolean;
  protected abstract handleCommand(command: PlaybackCommand): Promise<void>;

  // ── Command queueing ──────────────────────────────────────────────────────

  public executeCommand(command: PlaybackCommand) {
    this.commandQueue.push(command);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isExecuting || this.commandQueue.length === 0) return;
    this.isExecuting = true;

    const cmd = this.commandQueue.shift()!;
    try {
      await this.handleCommand(cmd);
    } catch (e) {
      console.error(`[PlaybackAdapter] Command execution failed:`, e);
    } finally {
      this.isExecuting = false;
      setTimeout(() => this.processQueue(), 0);
    }
  }

  // ── Sync engine ───────────────────────────────────────────────────────────

  /**
   * Called by socket layer when server sends sync:tick
   */
  public onSyncTick(serverTimestamp: number, positionMs: number, isPlaying: boolean) {
    const now = Date.now();
    this._clockOffset = now - serverTimestamp;
    this._canonicalServerTs = serverTimestamp;
    this._canonicalIsPlaying = isPlaying;

    // Estimate canonical position accounting for travel time
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

    // Update confidence (0 = lost, 1 = perfect)
    this._confidence = Math.max(0, 1 - absDrift / 2000);

    if (absDrift < SYNC_THRESHOLD_MS) {
      // In sync — restore normal rate if we were nudging
      if (this._currentRate !== NUDGE_RATE_NORMAL) {
        this._currentRate = NUDGE_RATE_NORMAL;
        this.executeCommand({ type: 'NUDGE_RATE', rate: NUDGE_RATE_NORMAL });
      }
      return;
    }

    // Large drift — hard seek
    if (absDrift > 2000) {
      const seekTarget = this._canonicalPositionMs + this.capabilities.estimatedSeekLatencyMs;
      this.executeCommand({ type: 'SEEK', position: seekTarget });
      return;
    }

    // Medium drift — rate nudge
    if (this.capabilities.supportsRateAdjustment) {
      const newRate = drift < 0 ? NUDGE_RATE_FAST : NUDGE_RATE_SLOW;
      if (newRate !== this._currentRate) {
        this._currentRate = newRate;
        this.executeCommand({ type: 'NUDGE_RATE', rate: newRate });
      }
    } else {
      // No rate adjustment — just seek
      this.executeCommand({ type: 'SEEK', position: this._canonicalPositionMs });
    }
  }

  // ── Telemetry polling ─────────────────────────────────────────────────────

  public startTelemetry(callback: (t: SyncTelemetry) => void) {
    this._onTelemetry = callback;
    this._pollTimer = setInterval(() => this._emitTelemetry(), POLL_INTERVAL_MS);
  }

  public stopTelemetry() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private _emitTelemetry() {
    if (!this._onTelemetry) return;

    let status: SyncStatus;
    if (!this._canonicalIsPlaying) {
      status = 'PAUSED';
    } else if (this.isBuffering()) {
      status = 'BUFFERING';
    } else if (this._confidence < 0.1) {
      status = 'SYNC_LOST';
    } else if (this._confidence < 0.8) {
      status = 'SYNCING';
    } else {
      status = 'SYNCED';
    }

    this._onTelemetry({
      status,
      clockOffset: this._clockOffset,
      confidence: this._confidence,
      playbackRate: this._currentRate,
      positionMs: this.getPhysicalPosition(),
      isBuffering: this.isBuffering(),
    });
  }

  public dispose() {
    this.stopTelemetry();
  }
}
