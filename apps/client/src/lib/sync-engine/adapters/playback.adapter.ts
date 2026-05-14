export interface AdapterCapabilities {
  supportsRateAdjustment: boolean; // Spotify: False, YouTube: True
  supportsPreciseSeeking: boolean;
  estimatedSeekLatencyMs: number; // For masking seek delay
}

export type PlaybackCommand = 
  | { type: 'SEEK'; position: number }
  | { type: 'NUDGE_RATE'; rate: number }
  | { type: 'PAUSE' }
  | { type: 'PLAY'; position?: number };

/**
 * The physical execution boundary. 
 * Abstracts away the chaos of proprietary SDKs (Spotify/Apple/YT).
 */
export abstract class PlaybackAdapter {
  public capabilities: AdapterCapabilities;
  private commandQueue: PlaybackCommand[] = [];
  private isExecuting = false;

  constructor(capabilities: AdapterCapabilities) {
    this.capabilities = capabilities;
  }

  /**
   * Enqueues commands to prevent overlapping async physical operations.
   * e.g., We cannot fire SEEK while a PAUSE is mid-flight in the Spotify SDK.
   */
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
      // Yield to event loop, then process next
      setTimeout(() => this.processQueue(), 0);
    }
  }

  // Provider-specific physical execution
  protected abstract handleCommand(command: PlaybackCommand): Promise<void>;
  
  // Provider-specific physical observation
  public abstract getPhysicalPosition(): number;
  public abstract isBuffering(): boolean;
}
