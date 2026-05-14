import { SyncState, SyncAction } from './sync.reducer';
import { ClientReconciliationEngine } from './reconciliation.engine';

export interface RecoverySnapshotContract {
  roomId: string;
  authorityEpoch: number;
  version: number;
  committedPosition: number;
  playbackRate: number;
  isPlaying: boolean;
  serverTimestamp: number;
  authoritySessionId: string;
}

export class RecoveryProtocol {
  private currentRoomId: string | null = null;
  private revalidationTimeout: NodeJS.Timeout | null = null;

  constructor(
    private engine: ClientReconciliationEngine,
    private socket: any, // Socket.IO client instance
    private sessionId: string // Unique identifier for this device/tab
  ) {
    // Wire the Temporal Continuity Engine
    this.engine.onSuspensionDetected = () => {
      console.warn('[RecoveryProtocol] Temporal Suspension Detected. Initiating Authoritative Continuity Reconstruction.');
      if (this.currentRoomId) {
        // Socket flush: We don't manually clear the socket queue, 
        // the reducer's Revalidation Quarantine automatically drops any 
        // stale incremental events arriving from the TCP buffer until the snapshot hits.
        this.initiateRecoveryHandshake(this.currentRoomId);
      }
    };
  }

  /**
   * RECOVERY HANDSHAKE FLOW
   * 1. Triggered immediately upon socket 'connect' event after a drop
   */
  public initiateRecoveryHandshake(roomId: string) {
    this.currentRoomId = roomId;
    console.log('[RecoveryProtocol] Initiating handshake...');
    this.engine.dispatchAction({ type: 'NETWORK_CHANGE', status: 'RECONNECTING' });
    
    // 2. SYNC_REQUEST over socket
    this.socket.emit('SYNC_REQUEST', { roomId }, (snapshot: RecoverySnapshotContract | null) => {
       this.handleRecoverySnapshot(snapshot);
    });
  }

  /**
   * 3. SERVER_RECOVERY_SNAPSHOT received
   */
  private handleRecoverySnapshot(snapshot: RecoverySnapshotContract | null) {
     if (!snapshot) {
       console.warn('[RecoveryProtocol] Empty snapshot received. Room dead or invalid.');
       this.engine.dispatchAction({ type: 'NETWORK_CHANGE', status: 'DISCONNECTED' });
       return; 
     }

     const currentState = this.engine.getState();

     // 4. Session Resurrection Rules
     // If we thought we were authority, but the disconnect was long (>15s), 
     // the server's Heartbeat Sweeper will have given authority to someone else.
     if (currentState.authority === 'AUTHORITY' && snapshot.authoritySessionId !== this.sessionId) {
         console.warn('[RecoveryProtocol] Ghost Authority Resurrection rejected. Authority lost during disconnect window.');
         this.engine.dispatchAction({ type: 'AUTHORITY_TRANSITION', role: 'FOLLOWER', epoch: snapshot.authorityEpoch });
     }

     // 5. Physical State Revalidation Window
     // Delay the worldview reconstruction by 1.5s.
     // This allows the browser to process incoming TCP flushes, and gives the Spotify SDK 
     // time to stabilize its internal state before we start reconciling against it.
     if (this.revalidationTimeout) clearTimeout(this.revalidationTimeout);
     
     this.revalidationTimeout = setTimeout(() => {
       // 6. Version/Epoch Validation & Local Reconstruction (Snapshot Dominance)
       // The reducer strictly rejects mathematically impossible realities.
       // By dispatching RECOVERY_SYNC_COMPLETE, the reducer breaks the Revalidation Quarantine,
       // fast-forwards the state, and begins Ghost Confidence Ramp.
       this.engine.dispatchAction({ 
          type: 'RECOVERY_SYNC_COMPLETE', 
          payload: {
            roomId: snapshot.roomId,
            version: snapshot.version,
            authorityEpoch: snapshot.authorityEpoch,
            serverTimestamp: snapshot.serverTimestamp,
            isPlaying: snapshot.isPlaying,
            playbackRate: snapshot.playbackRate,
            position: snapshot.committedPosition,
            trackId: '', // To be filled by adapter later
            schemaVersion: 1,
            type: 'SEEK' // Virtual intent to force reconstruction
          } 
       });

       // 7. Active (Tick Loop resumes observation)
       this.engine.dispatchAction({ type: 'NETWORK_CHANGE', status: 'CONNECTED' });
     }, 1500);
  }
}
