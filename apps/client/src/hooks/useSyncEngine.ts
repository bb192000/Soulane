import { useEffect, useState, useRef, useCallback } from 'react';
import { ClientReconciliationEngine } from '../lib/sync-engine/reconciliation.engine';
import { RecoveryProtocol } from '../lib/sync-engine/recovery.protocol';
import { SyncState } from '../lib/sync-engine/sync.reducer';

export function useSyncEngine(socket: any, sessionId: string) {
  const [state, setState] = useState<SyncState | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const engineRef = useRef<ClientReconciliationEngine | null>(null);
  const protocolRef = useRef<RecoveryProtocol | null>(null);

  useEffect(() => {
    const engine = new ClientReconciliationEngine();
    const protocol = new RecoveryProtocol(engine, socket, sessionId);

    engine.onSuspensionDetected = () => {
      addToHistory('SUSPENSION_DETECTED', 'Temporal continuity broken');
    };

    // Override dispatch to capture history and update React state
    const originalDispatch = engine.dispatchAction.bind(engine);
    engine.dispatchAction = (action) => {
      originalDispatch(action);
      setState({ ...engine.getState() });
      addToHistory(action.type, JSON.stringify(action.payload || {}));
    };

    engineRef.current = engine;
    protocolRef.current = protocol;
    setState(engine.getState());

    return () => {
      engine.stopTickLoop();
    };
  }, [socket, sessionId]);

  const addToHistory = (type: string, message: string) => {
    setHistory(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    }, ...prev].slice(0, 50));
  };

  const joinRoom = useCallback((roomId: string) => {
    if (protocolRef.current) {
      protocolRef.current.initiateRecoveryHandshake(roomId);
      addToHistory('JOIN_ROOM', roomId);
    }
  }, []);

  return {
    state,
    history,
    engine: engineRef.current,
    protocol: protocolRef.current,
    joinRoom
  };
}
