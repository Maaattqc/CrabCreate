import { useState, useCallback, useRef, useEffect } from 'react';
import type { Notification } from '../types';

let nextId = 0;

export function useNotifications(timeoutMs: number = 5000) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutRef = useRef(timeoutMs);

  useEffect(() => {
    timeoutRef.current = timeoutMs;
  }, [timeoutMs]);

  const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = ++nextId;
    setNotifications(prev => [...prev, { id, message, type }]);

    // Auto-dismiss
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, timeoutRef.current);
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, addNotification, removeNotification };
}
