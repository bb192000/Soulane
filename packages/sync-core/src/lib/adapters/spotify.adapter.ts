import { PlaybackAdapter, PlaybackCommand } from './playback.adapter';

export class SpotifyPlaybackAdapter extends PlaybackAdapter {
  private player: any; // Spotify.Player instance
  private physicalPositionMs = 0;
  private isPlayerPaused = true;
  private isPlayerBuffering = false;
  private lastStateUpdateAt = performance.now();

  constructor(player: any) {
    super({
      supportsRateAdjustment: false, // Spotify Web SDK strict limitation
      supportsPreciseSeeking: true,
      estimatedSeekLatencyMs: 300 // Built-in padding for the physical target
    });
    this.player = player;
    this.attachListeners();
  }

  private attachListeners() {
    this.player.addListener('player_state_changed', (state: any) => {
      if (!state) return;
      
      this.physicalPositionMs = state.position;
      this.isPlayerPaused = state.paused;
      this.isPlayerBuffering = state.loading || false;
      this.lastStateUpdateAt = performance.now();
    });
  }

  /**
   * Translates abstract commands into strict Spotify SDK executions.
   * Queueing guarantees PAUSE and SEEK don't violently trample each other.
   */
  protected async handleCommand(command: PlaybackCommand): Promise<void> {
    if (!this.player) return;

    try {
      switch (command.type) {
        case 'SEEK':
          await this.player.seek(command.position);
          break;
        case 'PAUSE':
          await this.player.pause();
          break;
        case 'PLAY':
          if (command.position !== undefined) {
             await this.player.seek(command.position);
          }
          await this.player.resume();
          break;
        case 'NUDGE_RATE':
          // Capability rejection: We gracefully ignore this. 
          // The ReconciliationEngine knows we don't support it and will wait for a HARD_SEEK threshold.
          console.debug('[SpotifyAdapter] Rate adjustment unsupported by physical player.');
          break;
      }
    } catch (e) {
      console.error('[SpotifyAdapter] Physical operation failed:', e);
    }
    
    // Settlement Window:
    // Spotify's SDK requires physical time to resolve buffer states after a command.
    // Holding the execution queue for 150ms prevents command trampling.
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  /**
   * The Perception Mask
   * Spotify only fires state events occasionally. We must smoothly extrapolate the physical 
   * position in the milliseconds between events to compare against our ghost playhead.
   */
  public getPhysicalPosition(): number {
    if (this.isPlayerPaused || this.isPlayerBuffering) {
      return this.physicalPositionMs;
    }
    
    const elapsedSinceLastStateFire = performance.now() - this.lastStateUpdateAt;
    return this.physicalPositionMs + elapsedSinceLastStateFire;
  }

  public isBuffering(): boolean {
    return this.isPlayerBuffering;
  }
}
