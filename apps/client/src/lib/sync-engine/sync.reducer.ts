import { CommittedPlaybackState } from '@soulane/shared';

export interface SyncState {
  // Orthogonal State Domains
  network: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  sync: 'SYNCING' | 'ACTIVE' | 'DRIFTING' | 'RECOVERING' | 'STALE';
  authority: 'FOLLOWER' | 'AUTHORITY' | 'AUTHORITY_UNSTABLE';
  
  // Trust Management (Worldview Confidence)
  ghostConfidence: number; // 0.0 to 1.0
  confidenceStatus: 'STABLE_SYNC' | 'DEGRADED_SYNC' | 'PARTITION_RISK' | 'SYNC_LOST';
  temporalContinuity: 'VERIFIED' | 'DEGRADED' | 'INVALID';
  
  // Formal Synchronization Contracts (Truth Trackers)
  lastAppliedVersion: number;
  lastAuthorityEpoch: number;
  
  // Time Protocol
  serverTimestampAtLastUpdate: number;
  clockOffsetMs: number; // Computed via SNTP-like ping/pong
  
  // Extrapolated Local Truth
  committedPosition: number;
  localEstimatedPosition: number;
  playbackRate: number;
  isPlaying: boolean;
  trackId: string | null;
}

export type SyncAction = 
  | { type: 'NETWORK_CHANGE', status: SyncState['network'] }
  | { type: 'CLOCK_OFFSET_COMPUTED', offsetMs: number }
  | { type: 'SERVER_EVENT_COMMITTED', payload: CommittedPlaybackState }
  | { type: 'RECOVERY_SYNC_COMPLETE', payload: CommittedPlaybackState }
  | { type: 'LOCAL_TICK' } // Driven by requestAnimationFrame
  | { type: 'AUTHORITY_TRANSITION', role: SyncState['authority'], epoch: number }
  | { type: 'CONFIDENCE_TRANSITION', status: SyncState['confidenceStatus'], value: number }
  | { type: 'CONTINUITY_TRANSITION', state: SyncState['temporalContinuity'] };

/**
 * Deterministic State Reducer
 * Rule 1: Never mutate state directly in UI components.
 * Rule 2: Strictly reject mathematical impossibilities (stale versions).
 * Rule 3: Decouple Network, Sync, and Authority state.
 */
export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'CLOCK_OFFSET_COMPUTED':
      return { ...state, clockOffsetMs: action.offsetMs };

    case 'NETWORK_CHANGE':
      return { 
        ...state, 
        network: action.status
        // We no longer blindly force sync: 'STALE'. 
        // The Trust Management Engine decides when worldview is lost.
      };

    case 'SERVER_EVENT_COMMITTED': {
      // 0. Revalidation Quarantine (Snapshot Dominance)
      // If we are temporally invalid (e.g. recovering from a background tab freeze),
      // we strictly drop all incremental events. Intermediate history is observationally irrelevant.
      if (state.temporalContinuity === 'INVALID') {
        console.warn(`[SyncReducer] Dropped incremental event v${action.payload.version} due to Revalidation Quarantine.`);
        return state;
      }

      // 1. Packet Acceptance Contract (Strict Rejection)
      if (action.payload.version <= state.lastAppliedVersion) {
        console.warn(`[SyncReducer] Dropped stale packet v${action.payload.version} (current: ${state.lastAppliedVersion})`);
        return state; 
      }
      if (action.payload.authorityEpoch < state.lastAuthorityEpoch) {
        console.warn(`[SyncReducer] Dropped stale epoch packet e${action.payload.authorityEpoch}`);
        return state;
      }

      return {
        ...state,
        sync: 'ACTIVE',
        lastAppliedVersion: action.payload.version,
        lastAuthorityEpoch: action.payload.authorityEpoch,
        serverTimestampAtLastUpdate: action.payload.serverTimestamp,
        isPlaying: action.payload.isPlaying,
        playbackRate: action.payload.playbackRate,
        trackId: action.payload.trackId,
        committedPosition: action.payload.position,
        localEstimatedPosition: action.payload.position
      };
    }

    case 'RECOVERY_SYNC_COMPLETE': {
      // 1. Packet Acceptance Contract (Strict Rejection)
      if (action.payload.authorityEpoch < state.lastAuthorityEpoch) {
        console.warn(`[SyncReducer] Dropped stale epoch recovery payload e${action.payload.authorityEpoch}`);
        return state;
      }

      // 2. Truth Reconstruction (Snapshot Dominance)
      // The recovery payload is absolute truth. It breaks the quarantine.
      return {
        ...state,
        sync: 'ACTIVE',
        temporalContinuity: 'VERIFIED', // Quarantine broken
        lastAppliedVersion: action.payload.version,
        lastAuthorityEpoch: action.payload.authorityEpoch,
        serverTimestampAtLastUpdate: action.payload.serverTimestamp,
        isPlaying: action.payload.isPlaying,
        playbackRate: action.payload.playbackRate,
        trackId: action.payload.trackId,
        committedPosition: action.payload.position,
        localEstimatedPosition: action.payload.position 
      };
    }

    case 'LOCAL_TICK': {
      // 3. Predictive Playback Estimation Contract
      if (!state.isPlaying || state.sync === 'STALE') return state;
      
      const currentTrueServerTime = Date.now() + state.clockOffsetMs;
      const trueElapsedMs = currentTrueServerTime - state.serverTimestampAtLastUpdate;
      
      // Calculate where the playhead SHOULD be right now
      const estimatedPosition = state.committedPosition + (trueElapsedMs * state.playbackRate);

      return {
        ...state,
        localEstimatedPosition: estimatedPosition
      };
    }

    case 'AUTHORITY_TRANSITION': {
      return {
        ...state,
        authority: action.role,
        lastAuthorityEpoch: action.epoch
      };
    }

    case 'CONFIDENCE_TRANSITION': {
      return {
        ...state,
        confidenceStatus: action.status,
        ghostConfidence: action.value
      };
    }

    case 'CONTINUITY_TRANSITION': {
      return {
        ...state,
        temporalContinuity: action.state,
        // If continuity is invalid, wipe trust entirely
        ghostConfidence: action.state === 'INVALID' ? 0.0 : state.ghostConfidence,
        confidenceStatus: action.state === 'INVALID' ? 'SYNC_LOST' : state.confidenceStatus
      };
    }

    default:
      return state;
  }
}
