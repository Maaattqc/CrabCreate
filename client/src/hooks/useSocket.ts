import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketCallback = (...args: any[]) => void;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Record<string, SocketCallback>>({});

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      if (err.message === 'Authentication required' || err.message === 'Authentication failed') {
        console.log('[Socket] Auth error, will retry on login');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const on = (event: string, callback: SocketCallback): void => {
    if (socketRef.current) {
      // Remove previous listener for this event if any
      if (listenersRef.current[event]) {
        socketRef.current.off(event, listenersRef.current[event]);
      }
      listenersRef.current[event] = callback;
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string): void => {
    if (socketRef.current && listenersRef.current[event]) {
      socketRef.current.off(event, listenersRef.current[event]);
      delete listenersRef.current[event];
    }
  };

  const emit = (event: string, ...args: unknown[]): void => {
    if (socketRef.current) {
      socketRef.current.emit(event, ...args);
    }
  };

  return { connected, on, off, emit, socket: socketRef.current };
}
