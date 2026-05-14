import React, { useState, useEffect } from 'react';
import { useSyncEngine } from './hooks/useSyncEngine';
import { Activity, Shield, Wifi, Clock, AlertTriangle, Play, Pause, SkipForward } from 'lucide-react';

// Mock socket for now since we are in observability phase
const mockSocket = {
  emit: (event: string, data: any, callback?: any) => {
    console.log(`[Socket Mock] EMIT: ${event}`, data);
    if (event === 'SYNC_REQUEST' && callback) {
      setTimeout(() => {
        callback({
          roomId: data.roomId,
          authorityEpoch: 1,
          version: 100,
          committedPosition: 45000,
          playbackRate: 1.0,
          isPlaying: true,
          serverTimestamp: Date.now(),
          authoritySessionId: 'mock-authority'
        });
      }, 500);
    }
  },
  on: (event: string, cb: any) => console.log(`[Socket Mock] ON: ${event}`)
};

const SESSION_ID = 'dev-device-' + Math.random().toString(36).substring(7);

function App() {
  const [roomId, setRoomId] = useState('TEST_ROOM');
  const { state, history, joinRoom } = useSyncEngine(mockSocket, SESSION_ID);

  if (!state) return <div>Initializing Engine...</div>;

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem' }}>
        <h1>SyncWave <span style={{ color: '#3b82f6' }}>Observability</span></h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
          />
          <button onClick={() => joinRoom(roomId)}>Join & Sync</button>
          
          <div className={`status-badge status-${state.temporalContinuity.toLowerCase()}`}>
            {state.temporalContinuity}
          </div>
          <div className="status-badge" style={{ background: '#333' }}>
            {state.confidenceStatus}
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        <main>
          {/* Main Control Panel */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0 }}>Playback Controls</h2>
                <p style={{ color: '#666', fontSize: '0.8rem' }}>Direct Engine Interaction</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button><Pause size={18} /></button>
                <button><Play size={18} /></button>
                <button><SkipForward size={18} /></button>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span>{Math.floor(state.localEstimatedPosition / 1000)}s</span>
                <span>Track Progress</span>
              </div>
              <div className="confidence-bar-container" style={{ background: '#222' }}>
                <div 
                  className="confidence-bar" 
                  style={{ 
                    width: `${(state.localEstimatedPosition % 180000) / 1800}%`,
                    background: '#3b82f6' 
                  }} 
                />
              </div>
            </div>
          </section>

          {/* Trust Metrics */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Ghost Confidence Meter</h3>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }}>
                {(state.ghostConfidence * 100).toFixed(1)}%
              </div>
            </div>
            <div className="confidence-bar-container">
              <div 
                className="confidence-bar" 
                style={{ 
                  width: `${state.ghostConfidence * 100}%`,
                  background: state.ghostConfidence > 0.5 ? '#10b981' : state.ghostConfidence > 0.2 ? '#f59e0b' : '#ef4444'
                }} 
              />
            </div>
          </section>

          {/* System Drift Visualization */}
          <section className="card">
            <h3>System Drift (ms)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="telemetry-item">
                <div className="telemetry-label">Ghost vs Server</div>
                <div className="telemetry-value" style={{ color: Math.abs(state.localEstimatedPosition - state.committedPosition) > 2000 ? '#ef4444' : '#10b981' }}>
                  {Math.round(state.localEstimatedPosition - state.committedPosition)}ms
                </div>
              </div>
              <div className="telemetry-item">
                <div className="telemetry-label">Local Uncertainty</div>
                <div className="telemetry-value">
                  ±{Math.round((1 - state.ghostConfidence) * 3000)}ms
                </div>
              </div>
            </div>
          </section>

          {/* Telemetry Grid */}
          <div className="telemetry-grid">
            <div className="telemetry-item">
              <div className="telemetry-label">Authority Epoch</div>
              <div className="telemetry-value">E{state.lastAuthorityEpoch}</div>
            </div>
            <div className="telemetry-item">
              <div className="telemetry-label">Applied Version</div>
              <div className="telemetry-value">v{state.lastAppliedVersion}</div>
            </div>
            <div className="telemetry-item">
              <div className="telemetry-label">Current Role</div>
              <div className="telemetry-value" style={{ color: state.authority === 'AUTHORITY' ? '#f59e0b' : '#3b82f6' }}>
                {state.authority}
              </div>
            </div>
            <div className="telemetry-item">
              <div className="telemetry-label">Sync Status</div>
              <div className="telemetry-value">{state.sync}</div>
            </div>
          </div>

          {/* Chaos Testing Rig */}
          <section className="card" style={{ marginTop: '2rem', borderColor: '#7f1d1d' }}>
            <h3 style={{ color: '#fca5a5' }}>Chaos Injection Rig</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => {
                // Toggle network state to trigger confidence decay
                const isDisconnected = state.network === 'DISCONNECTED';
                console.warn(`[ChaosRig] Toggling Network to ${isDisconnected ? 'CONNECTED' : 'DISCONNECTED'}...`);
                
                engine.dispatchAction({ 
                  type: 'NETWORK_TRANSITION', 
                  state: isDisconnected ? 'CONNECTED' : 'DISCONNECTED' 
                });
              }} style={{ borderColor: state.network === 'DISCONNECTED' ? '#22c55e' : '#ef4444' }}>
                {state.network === 'DISCONNECTED' ? 'Restore Connection' : 'Simulate Partition'}
              </button>
              
              <button onClick={() => {
                // Inject 3000ms Drift via Ghost repositioning
                console.warn('[ChaosRig] Injecting 3s Artificial Drift...');
                // We manually offset the ghost to trigger reconciliation
                state.localEstimatedPosition += 3000;
              }}>
                Inject +3s Drift
              </button>

              <button onClick={() => {
                // Simulate 10s Temporal Freeze
                console.warn('[ChaosRig] Injecting 10s JS Thread Freeze...');
                const end = Date.now() + 10000;
                while(Date.now() < end) {}
              }}>
                Simulate Freeze
              </button>
            </div>
          </section>
        </main>

        <aside>
          <section className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3>Correction History</h3>
            <div className="history-feed" style={{ flexGrow: 1 }}>
              {history.map((item, i) => (
                <div key={i} className="history-item">
                  <span className="history-timestamp">[{item.timestamp}]</span>
                  <span className="history-type">{item.type}</span>
                  <div style={{ fontSize: '0.7rem', color: '#aaa', marginLeft: '1rem' }}>
                    {item.message}
                  </div>
                </div>
              ))}
              {history.length === 0 && <div style={{ color: '#444' }}>Waiting for engine events...</div>}
            </div>
          </section>
        </aside>
      </div>

      {state.temporalContinuity === 'INVALID' && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#7f1d1d',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          border: '1px solid #b91c1c',
          zIndex: 1000
        }}>
          <AlertTriangle color="#fca5a5" />
          <div>
            <strong>Temporal Continuity Invalidated</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Revalidating room state with authority...</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
