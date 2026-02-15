import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketCallback = (...args: any[]) => void;

// ── Module-level singleton socket ────────────────────────────────────────────
// All useSocket() callers share ONE connection.  This prevents duplicate
// connections, listener churn, and the "events arrive on the wrong socket" bug.
const socket: Socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false, // connect explicitly from the first useSocket() mount
});

export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);
  // Track listeners registered by THIS caller so cleanup only removes its own
  const listenersRef = useRef<Record<string, SocketCallback>>({});

  useEffect(() => {
    // First mount triggers connection if not already connected/connecting
    if (!socket.connected && !socket.active) {
      socket.connect();
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Sync initial state (another useSocket call may have connected already)
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      // Remove only THIS caller's listeners
      for (const [event, cb] of Object.entries(listenersRef.current)) {
        socket.off(event, cb);
      }
      listenersRef.current = {};
    };
  }, []);

  const on = useCallback((event: string, callback: SocketCallback): void => {
    // Remove previous listener for this event (from this caller only)
    if (listenersRef.current[event]) {
      socket.off(event, listenersRef.current[event]);
    }
    listenersRef.current[event] = callback;
    socket.on(event, callback);
  }, []);

  const off = useCallback((event: string): void => {
    if (listenersRef.current[event]) {
      socket.off(event, listenersRef.current[event]);
      delete listenersRef.current[event];
    }
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]): void => {
    socket.emit(event, ...args);
  }, []);

  return { connected, on, off, emit, socket };
}

/** Force-disconnect the shared socket (call on logout). */
export function disconnectSocket(): void {
  socket.disconnect();
}

/**
 * Reconnect the shared socket (call after login).
 * A new connection triggers server-side auto-join to project rooms
 * and a fresh presence:sync broadcast to all room members.
 */
export function reconnectSocket(): void {
  if (!socket.connected) {
    socket.connect();
  }
}
