import { SyncState, SyncAction, syncReducer } from './sync.reducer';
import { PlaybackAdapter } from './adapters/playback.adapter';

export const DRIFT_POLICY = {
  // Hysteresis for soft corrections
  HYSTERESIS_ENTER_NUDGE_MS: 150,
  HYSTERESIS_EXIT_NUDGE_MS: 50,
  NUDGE_SPEED_MULTIPLIER: 1.05,
  
  // Hysteresis for violent corrections
  HYSTERESIS_ENTER_SEEK_MS: 1500, // Wait until drift is truly unignorable before hard seeking
  
  // Stabilization Timers
  HARD_SEEK_COOLDOWN_MS: 15000, 
  STABILIZATION_LOCKOUT_MS: 3000, 
  BUFFERING_CONFIDENCE_MS: 1500,

  // Trust Management
  PARTITION_TOLERANCE_MS: 15000,     // Total time until confidence hits 0
  CONFIDENCE_RAMP_DURATION_MS: 5000  // Time to recover full confidence after reconnect
};

export class ClientReconciliationEngine {
  private state: SyncState;
  private tickIntervalId: NodeJS.Timeout | null = null;
  private lastTickPerformanceMs: number = performance.now();

  // Adaptive Stability Control State
  private lastHardSeekAt: number = 0;
  private stabilizationLockoutUntil: number = 0;
  private lastBufferingAt: number = 0;
  private isNudging: boolean = false;
  private previousDriftMs: number = 0;

  // Trust Management State
  private partitionStartTime: number = 0;
  private recoveryStartTime: number = 0;
  private hasHaltedDueToPartition: boolean = false;

  public onSuspensionDetected: (() => void) | null = null;

  constructor() {
    this.state = this.getInitialState();
    
    // Page Visibility API Integration
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.dispatchAction({ type: 'CONTINUITY_TRANSITION', state: 'DEGRADED' });
        } else if (document.visibilityState === 'visible') {
          // Coming back from background - always treat as a temporal break requiring revalidation
          this.handleTemporalSuspension(0);
        }
      });
    }
  }

  public dispatchAction(action: SyncAction) {
    this.state = syncReducer(this.state, action);
  }

  public getState(): SyncState {
    return this.state;
  }

  /**
   * Visibility-Aware Monotonic Clock Loop
   * Replaces rAF which gets violently throttled or paused by background tabs.
   */
  public startTickLoop() {
    if (this.tickIntervalId) clearInterval(this.tickIntervalId);
    
    this.lastTickPerformanceMs = performance.now();

    this.tickIntervalId = setInterval(() => {
      // 1. Monotonic elapsed time calculation
      const now = performance.now();
      const deltaMs = now - this.lastTickPerformanceMs;
      this.lastTickPerformanceMs = now;

      // 2. Suspension Detection (Timer Compression Explosion)
      // If the delta is impossibly large for a 16ms loop, the JS thread was suspended.
      if (deltaMs > 2000) {
         this.handleTemporalSuspension(deltaMs);
         return; // REJECT local extrapolation. The ghost playhead is fictional now.
      }

      // 3. Normal Execution Continuity
      if (this.state.temporalContinuity !== 'INVALID' && this.state.isPlaying && this.state.sync === 'ACTIVE') {
        const estimatedPosition = this.state.localEstimatedPosition + (deltaMs * this.state.playbackRate);
        
        // Manual state update to avoid dispatch overhead on 60fps loop
        this.state.localEstimatedPosition = estimatedPosition;
      }

      this.evaluateConfidenceDecay(now);
    }, 16); // Target ~60fps, but relies on delta-time so throttling is perfectly safe
  }

  /**
   * The Synchronization Trust Management System
   * Decays confidence smoothly during partition, forces PAUSE when worldview is invalid, 
   * and ramps confidence back up gracefully upon recovery.
   */
  private evaluateConfidenceDecay(now: number) {
    if (this.state.network === 'DISCONNECTED') {
      if (this.partitionStartTime === 0) this.partitionStartTime = now;
      this.recoveryStartTime = 0;

      const duration = now - this.partitionStartTime;
      let newConfidence = 1.0;
      let newStatus: SyncState['confidenceStatus'] = 'STABLE_SYNC';

      if (duration > DRIFT_POLICY.PARTITION_TOLERANCE_MS) {
        newConfidence = 0.0;
        newStatus = 'SYNC_LOST';
      } else if (duration > 5000) {
        // Linearly decay confidence from 1.0 to 0.0 over the remaining 10 seconds
        newConfidence = 1.0 - ((duration - 5000) / (DRIFT_POLICY.PARTITION_TOLERANCE_MS - 5000));
        newStatus = 'PARTITION_RISK';
      } else {
        newStatus = 'DEGRADED_SYNC';
      }

      // Suppress dispatch spam
      if (this.state.ghostConfidence !== newConfidence || this.state.confidenceStatus !== newStatus) {
        this.dispatchAction({ type: 'CONFIDENCE_TRANSITION', status: newStatus, value: Math.max(0, newConfidence) });
      }
    } else {
      // Reconnected. Ramp confidence back up over time to avoid snap-corrections
      if (this.partitionStartTime > 0) {
        this.partitionStartTime = 0;
        this.recoveryStartTime = now;
        this.hasHaltedDueToPartition = false;
      }

      if (this.recoveryStartTime > 0) {
        const recoveryDuration = now - this.recoveryStartTime;
        if (recoveryDuration > DRIFT_POLICY.CONFIDENCE_RAMP_DURATION_MS) {
           this.recoveryStartTime = 0;
           if (this.state.confidenceStatus !== 'STABLE_SYNC') {
             this.dispatchAction({ type: 'CONFIDENCE_TRANSITION', status: 'STABLE_SYNC', value: 1.0 });
           }
        } else {
           const rampConfidence = recoveryDuration / DRIFT_POLICY.CONFIDENCE_RAMP_DURATION_MS;
           this.dispatchAction({ type: 'CONFIDENCE_TRANSITION', status: 'STABLE_SYNC', value: rampConfidence });
        }
      }
    }
  }

  /**
   * Triggers when the browser execution thread resumes from a freeze or the tab is foregrounded.
   */
  private handleTemporalSuspension(deltaMs: number) {
    console.warn(`[SyncEngine] Temporal Continuity broken. Suspected suspension delta: ${deltaMs}ms`);
    
    if (this.state.temporalContinuity !== 'INVALID') {
      this.dispatchAction({ type: 'CONTINUITY_TRANSITION', state: 'INVALID' });
      
      // The recovery layer must listen to this callback, query the physical SDK, 
      // request a fresh SERVER_RECOVERY_SNAPSHOT, and flush stale socket events.
      if (this.onSuspensionDetected) {
        this.onSuspensionDetected();
      }
    }
  }

  public stopTickLoop() {
    if (this.tickIntervalId) clearInterval(this.tickIntervalId);
  }

  /**
   * The Adaptive Stability Controller
   * Replaces reactive reconciliation with a control-system model preventing oscillation.
   */
  public evaluateReconciliation(adapter: PlaybackAdapter): void {
    if (!this.state.isPlaying || this.state.sync !== 'ACTIVE') return;

    // 0. Temporal Suspension Freeze
    // If continuity is invalid, we are waiting for an authoritative snapshot.
    // We strictly ignore all drift calculations until the worldview is rebuilt.
    if (this.state.temporalContinuity === 'INVALID') return;

    // 1. Trust Management Halt (Zero Confidence)
    if (this.state.ghostConfidence === 0 && !this.hasHaltedDueToPartition) {
       console.warn('[TrustManagement] Ghost Confidence reached 0. Halting physical playback.');
       this.hasHaltedDueToPartition = true;
       adapter.executeCommand({ type: 'PAUSE' });
       return;
    }

    if (this.state.ghostConfidence === 0) return; // Worldview invalid, do nothing

    const now = performance.now();

    // 1. Buffering Confidence Lock
    if (adapter.isBuffering()) {
      this.lastBufferingAt = now;
      return; 
    }
    if (now - this.lastBufferingAt < DRIFT_POLICY.BUFFERING_CONFIDENCE_MS) {
      return; // Waiting for SDK stability confidence window to clear
    }

    // 2. Seek Stabilization Lockout
    if (now < this.stabilizationLockoutUntil) {
      return; // Ignore all drift while physical playhead recovers from previous seek
    }

    const physicalPosition = adapter.getPhysicalPosition();
    const driftMs = Math.abs(this.state.localEstimatedPosition - physicalPosition);
    
    // 3. Drift Slope Evaluation (Is it fixing itself naturally?)
    const driftDelta = driftMs - this.previousDriftMs;
    this.previousDriftMs = driftMs;
    
    // If drift is naturally decreasing rapidly, let it ride. Do not intervene.
    if (driftDelta < -5) return;

    // Expand tolerance inversely proportional to confidence. 
    // Example: If confidence is 0.2 (just reconnected), tolerance multiplier is 1.8x. 
    // This makes the controller extremely passive and forgiving during the recovery ramp.
    const toleranceMultiplier = 1 + ((1 - this.state.ghostConfidence) * 1.0); 

    // 4. Correction Hysteresis (Nudging)
    if (adapter.capabilities.supportsRateAdjustment) {
      if (this.isNudging && driftMs <= (DRIFT_POLICY.HYSTERESIS_EXIT_NUDGE_MS * toleranceMultiplier)) {
         // Exit nudge gracefully
         adapter.executeCommand({ type: 'NUDGE_RATE', rate: 1.0 });
         this.isNudging = false;
         return;
      }
      
      const enterNudgeThreshold = DRIFT_POLICY.HYSTERESIS_ENTER_NUDGE_MS * toleranceMultiplier;
      const enterSeekThreshold = DRIFT_POLICY.HYSTERESIS_ENTER_SEEK_MS * toleranceMultiplier;

      if (!this.isNudging && driftMs > enterNudgeThreshold && driftMs < enterSeekThreshold) {
         // Enter nudge
         adapter.executeCommand({ type: 'NUDGE_RATE', rate: DRIFT_POLICY.NUDGE_SPEED_MULTIPLIER });
         this.isNudging = true;
         return;
      }
    }

    // 5. Emotionally Stabilized Hard Seeking
    if (driftMs >= (DRIFT_POLICY.HYSTERESIS_ENTER_SEEK_MS * toleranceMultiplier)) {
      // Prevent consecutive hard seeks from destroying psychological continuity
      if (now - this.lastHardSeekAt > DRIFT_POLICY.HARD_SEEK_COOLDOWN_MS) {
        this.lastHardSeekAt = now;
        this.stabilizationLockoutUntil = now + DRIFT_POLICY.STABILIZATION_LOCKOUT_MS;
        
        // Add estimated SDK execution latency to land perfectly on the moving target
        const targetSeek = this.state.localEstimatedPosition + adapter.capabilities.estimatedSeekLatencyMs;
        
        adapter.executeCommand({ type: 'SEEK', position: targetSeek });
        
        if (this.isNudging) {
           adapter.executeCommand({ type: 'NUDGE_RATE', rate: 1.0 });
           this.isNudging = false;
        }
      } else {
        console.warn('[AdaptiveController] Suppressed HARD_SEEK due to emotion cooldown window.');
      }
    }
  }

  private getInitialState(): SyncState {
    return {
      network: 'DISCONNECTED',
      sync: 'STALE',
      authority: 'FOLLOWER',
      lastAppliedVersion: 0,
      lastAuthorityEpoch: 0,
      serverTimestampAtLastUpdate: 0,
      clockOffsetMs: 0,
      committedPosition: 0,
      localEstimatedPosition: 0,
      playbackRate: 1.0,
      isPlaying: false,
      trackId: null,
      ghostConfidence: 1.0,
      confidenceStatus: 'STABLE_SYNC',
      temporalContinuity: 'VERIFIED'
    };
  }
}
