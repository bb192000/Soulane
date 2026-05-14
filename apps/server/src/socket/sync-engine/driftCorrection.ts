/**
 * driftCorrection.ts
 * Production-grade sync logic with hysteresis, latency compensation, and safe bounds.
 */

export interface SyncState {
  lastCorrectionAt: number;
  lastPlaybackRate: number;
  driftHistory: number[];
  stableDriftCount: number;
}

export interface SyncAdjustment {
  action: 'ignore' | 'adjust_rate' | 'seek';
  playbackRate?: number;
  seekPosition?: number;
}

export interface SyncPacket {
  position: number;
  timestamp: number;
  playbackRate: number;
  isPlaying: boolean;
  sequence?: number;
}

const MIN_CORRECTION_INTERVAL = 3000; // ms
const STABLE_WINDOW_MS = 500;
const MAX_RATE_ADJUST = 1500; // ms
const TOLERANCE_MS = 300;

export function calculateDriftCorrection(
  clientState: SyncState,
  clientPacket: SyncPacket,
  serverPacket: SyncPacket,
  estimatedRTT: number = 100
): { adjustment: SyncAdjustment, newState: SyncState } {
  const now = Date.now();
  
  // 1. Latency Compensation
  const serverElapsed = (now - serverPacket.timestamp) + (estimatedRTT / 2);
  const expectedServerPosition = serverPacket.position + (serverPacket.isPlaying ? (serverElapsed / 1000) * serverPacket.playbackRate : 0);
  
  const clientElapsed = (now - clientPacket.timestamp);
  const actualClientPosition = clientPacket.position + (clientPacket.isPlaying ? (clientElapsed / 1000) * clientPacket.playbackRate : 0);

  const driftSecs = expectedServerPosition - actualClientPosition;
  const driftMs = Math.abs(driftSecs * 1000);

  // Smooth drift history (moving average of last 5 heartbeats)
  const driftHistory = [...clientState.driftHistory.slice(-4), driftSecs];
  const smoothedDriftSecs = driftHistory.reduce((a, b) => a + b, 0) / driftHistory.length;
  const smoothedDriftMs = Math.abs(smoothedDriftSecs * 1000);

  let newState = { ...clientState, driftHistory };

  // 2. Cooldown Window (Hysteresis)
  if (now - clientState.lastCorrectionAt < MIN_CORRECTION_INTERVAL) {
    return { adjustment: { action: 'ignore' }, newState };
  }

  // 3. Tolerances and Actions based on smoothed drift
  if (smoothedDriftMs < TOLERANCE_MS) {
    newState.stableDriftCount = 0;
    
    if (clientState.lastPlaybackRate !== 1.0) {
      newState.lastCorrectionAt = now;
      newState.lastPlaybackRate = 1.0;
      return { 
        adjustment: { action: 'adjust_rate', playbackRate: 1.0 }, 
        newState 
      };
    }
    
    return { adjustment: { action: 'ignore' }, newState };
  }

  // Require drift to be somewhat stable before adjusting
  newState.stableDriftCount += 1;
  // Simulating the STABLE_WINDOW_MS by waiting for consecutive heartbeats
  if (newState.stableDriftCount < 2) {
     return { adjustment: { action: 'ignore' }, newState };
  }

  // 4. Rate adjustment (0.97 to 1.03) for moderate drift
  if (smoothedDriftMs >= TOLERANCE_MS && smoothedDriftMs <= MAX_RATE_ADJUST) {
    const driftDirection = smoothedDriftSecs > 0 ? 1 : -1; // > 0: speed up
    
    // Scale adjustment within safe bounds: 3% (0.03)
    const rateAdjustment = (smoothedDriftMs / MAX_RATE_ADJUST) * 0.03 * driftDirection;
    const safeRate = 1.0 + rateAdjustment;

    newState.lastCorrectionAt = now;
    newState.lastPlaybackRate = safeRate;
    newState.stableDriftCount = 0;

    return {
      adjustment: { action: 'adjust_rate', playbackRate: safeRate },
      newState
    };
  }

  // 5. Hard Seek correction for severe drift (> 1500ms)
  newState.lastCorrectionAt = now;
  newState.lastPlaybackRate = 1.0;
  newState.stableDriftCount = 0;

  return {
    adjustment: { 
      action: 'seek', 
      seekPosition: expectedServerPosition + 0.15 
    },
    newState
  };
}
