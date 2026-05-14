import { ClientReconciliationEngine } from '../lib/sync-engine/reconciliation.engine';
import { RecoveryProtocol, RecoverySnapshotContract } from '../lib/sync-engine/recovery.protocol';
import { SpotifyPlaybackAdapter } from '../lib/sync-engine/adapters/spotify.adapter';

class SyncObservatoryHarness {
  public engine: ClientReconciliationEngine;
  public adapter: SpotifyPlaybackAdapter;
  public protocol: RecoveryProtocol;

  private latencyMs = 50;
  private mockServerTime = Date.now();

  // Mock Socket.IO Client
  private mockSocket = {
    connected: false,
    id: 'harness-session-xyz',
    emit: (event: string, payload: any, callback: Function) => {
      this.logEvent(`OUT -> [${event}]`, payload);
      
      if (event === 'SYNC_REQUEST') {
        setTimeout(() => {
          const snapshot: RecoverySnapshotContract = {
            roomId: 'test-room',
            authorityEpoch: 2,
            version: 142,
            committedPosition: 45000,
            playbackRate: 1.0,
            isPlaying: true,
            serverTimestamp: Date.now(),
            authoritySessionId: 'remote-host-abc' // Deliberately testing ghost authority rejection
          };
          this.logEvent(`IN <- [SERVER_RECOVERY_SNAPSHOT]`, snapshot);
          callback(snapshot);
        }, this.latencyMs);
      }
    }
  };

  constructor() {
    this.engine = new ClientReconciliationEngine();
    
    // Mock Spotify Web Playback SDK
    const mockSpotifyPlayer = {
      addListener: (event: string, cb: Function) => {
         // In a real harness we'd trigger this via simulated ticks
      },
      seek: async (pos: number) => { 
        this.logDecision(`[PHYSICAL ADAPTER] Executing Async SEEK -> ${pos.toFixed(0)}`);
        return new Promise(r => setTimeout(r, 300)); // Simulate hardware seek delay
      },
      pause: async () => { 
        this.logDecision(`[PHYSICAL ADAPTER] Executing Async PAUSE`);
      },
      resume: async () => { 
        this.logDecision(`[PHYSICAL ADAPTER] Executing Async RESUME`);
      },
    };

    this.adapter = new SpotifyPlaybackAdapter(mockSpotifyPlayer);
    this.protocol = new RecoveryProtocol(this.engine, this.mockSocket, this.mockSocket.id);

    // Override engine logic locally to intercept decision logs
    const originalEval = this.engine.evaluateReconciliation.bind(this.engine);
    this.engine.evaluateReconciliation = (adapter) => {
      const state = this.engine.getState();
      const drift = Math.abs(state.localEstimatedPosition - adapter.getPhysicalPosition());
      if (drift > 150 && !adapter.isBuffering()) {
         this.logDecision(`[RECONCILER] Detected Drift: ${drift.toFixed(0)}ms. Evaluating policy...`);
      }
      originalEval(adapter);
    };

    this.startObservatoryLoop();
  }

  private startObservatoryLoop() {
    setInterval(() => {
      this.engine.evaluateReconciliation(this.adapter);
      this.updateUI();
    }, 100);
  }

  private updateUI() {
    const state = this.engine.getState();
    const networkEl = document.getElementById('networkState')!;
    networkEl.textContent = state.network;
    networkEl.className = `status ${state.network.toLowerCase()}`;

    document.getElementById('syncState')!.textContent = state.sync;
    document.getElementById('authorityState')!.textContent = state.authority;
    document.getElementById('versionState')!.textContent = state.lastAppliedVersion.toString();
    document.getElementById('epochState')!.textContent = state.lastAuthorityEpoch.toString();
    
    document.getElementById('serverPos')!.textContent = (state.committedPosition / 1000).toFixed(2);
    document.getElementById('ghostPos')!.textContent = (state.localEstimatedPosition / 1000).toFixed(2);
    
    const physical = this.adapter.getPhysicalPosition();
    document.getElementById('physicalPos')!.textContent = (physical / 1000).toFixed(2);
    
    const drift = Math.abs(state.localEstimatedPosition - physical);
    const driftEl = document.getElementById('driftDelta')!;
    driftEl.textContent = drift.toFixed(0);
    
    if (drift > 800) { driftEl.className = 'drift-danger'; }
    else if (drift > 150) { driftEl.className = 'drift-warning'; }
    else { driftEl.className = ''; }
  }

  public logDecision(msg: string) {
    const log = document.getElementById('decisionLog')!;
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    log.innerHTML = `<div><span style="color:#555">[${time}]</span> ${msg}</div>` + log.innerHTML;
  }

  public logEvent(msg: string, payload?: any) {
    const log = document.getElementById('eventLog')!;
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    const payloadStr = payload ? `<pre style="margin:2px 0 10px 0; color:#888;">${JSON.stringify(payload, null, 2)}</pre>` : '';
    log.innerHTML = `<div><span style="color:#555">[${time}]</span> <span style="color:#0ff">${msg}</span></div>${payloadStr}` + log.innerHTML;
  }

  // ---- CHAOS CONTROLS ----
  public simulateDisconnect() {
    this.mockSocket.connected = false;
    this.engine.dispatchAction({ type: 'NETWORK_CHANGE', status: 'DISCONNECTED' });
    this.engine.stopTickLoop();
    this.logEvent('🔴 [OS EVENT] Network Interface Down');
  }

  public simulateReconnect() {
    this.mockSocket.connected = true;
    this.logEvent('🟢 [OS EVENT] Network Interface Up. Triggering Protocol...');
    this.protocol.initiateRecoveryHandshake('test-room');
    this.engine.startTickLoop();
  }

  public injectLatency(ms: number) {
    this.latencyMs = ms;
    this.logEvent(`⚠️ [NETWORK] Congestion injected. RTT = ${ms}ms`);
  }

  public simulateSDKBuffering() {
    (this.adapter as any).isPlayerBuffering = true;
    this.logDecision('⚠️ [SDK] Entered Buffering State (Starvation)');
    setTimeout(() => {
      (this.adapter as any).isPlayerBuffering = false;
      this.logDecision('✅ [SDK] Buffering Resolved');
    }, 4000);
  }

  public simulateHardwareLag() {
    // Break the physical extrapolation to simulate a 1.5s browser lockup
    const realPhysical = (this.adapter as any).physicalPositionMs;
    (this.adapter as any).physicalPositionMs = realPhysical - 1500;
    this.logDecision('🔥 [HARDWARE] CPU Spike. SDK thread locked for 1500ms.');
  }
}

// Bind to window for HTML buttons
(window as any).harness = new SyncObservatoryHarness();
