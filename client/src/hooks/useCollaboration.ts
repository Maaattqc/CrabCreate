import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import { useProject } from './useProject';
import type { TicketViewer, UserStatus } from '../types';

// ── Ticket Viewing ──────────────────────────────────────────────────────────

export function useTicketViewers() {
  const { on, off, emit } = useSocket();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [viewersMap, setViewersMap] = useState<Map<number, TicketViewer[]>>(new Map());

  useEffect(() => {
    on('ticket:viewers', (data: { ticketId: number; viewers: TicketViewer[] }) => {
      setViewersMap(prev => {
        const next = new Map(prev);
        // Exclude self from viewers
        next.set(data.ticketId, data.viewers.filter(v => v.userId !== user?.id));
        return next;
      });
    });
    return () => { off('ticket:viewers'); };
  }, [on, off, user?.id]);

  const startViewing = useCallback((ticketId: number) => {
    if (currentProject?.id) {
      emit('ticket:view', { ticketId, projectId: currentProject.id });
    }
  }, [emit, currentProject?.id]);

  const stopViewing = useCallback((ticketId: number) => {
    if (currentProject?.id) {
      emit('ticket:unview', { ticketId, projectId: currentProject.id });
    }
  }, [emit, currentProject?.id]);

  const getViewers = useCallback((ticketId: number) => {
    return viewersMap.get(ticketId) || [];
  }, [viewersMap]);

  return { viewersMap, getViewers, startViewing, stopViewing };
}

// ── Typing Indicator ────────────────────────────────────────────────────────

export function useTypingIndicator(ticketId: number | null) {
  const { on, off, emit } = useSocket();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [typingUsers, setTypingUsers] = useState<{ userId: number; email: string }[]>([]);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!ticketId) return;

    on('ticket:typing', (data: { ticketId: number; userId: number; email: string }) => {
      if (data.ticketId !== ticketId || data.userId === user?.id) return;
      setTypingUsers(prev => {
        if (prev.some(u => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, email: data.email }];
      });
      // Auto-clear after 3s
      const existing = timeoutsRef.current.get(data.userId);
      if (existing) clearTimeout(existing);
      timeoutsRef.current.set(data.userId, setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        timeoutsRef.current.delete(data.userId);
      }, 3000));
    });

    on('ticket:stop-typing', (data: { ticketId: number; userId: number }) => {
      if (data.ticketId !== ticketId) return;
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      const existing = timeoutsRef.current.get(data.userId);
      if (existing) { clearTimeout(existing); timeoutsRef.current.delete(data.userId); }
    });

    return () => {
      off('ticket:typing');
      off('ticket:stop-typing');
      for (const t of timeoutsRef.current.values()) clearTimeout(t);
      timeoutsRef.current.clear();
    };
  }, [on, off, ticketId, user?.id]);

  const sendTyping = useCallback(() => {
    if (ticketId && currentProject?.id) {
      emit('ticket:typing', { ticketId, projectId: currentProject.id });
    }
  }, [emit, ticketId, currentProject?.id]);

  const sendStopTyping = useCallback(() => {
    if (ticketId && currentProject?.id) {
      emit('ticket:stop-typing', { ticketId, projectId: currentProject.id });
    }
  }, [emit, ticketId, currentProject?.id]);

  return { typingUsers, sendTyping, sendStopTyping };
}

// ── Per-Field Editing Lock ────────────────────────────────────────────────

export function useEditingLock(ticketId: number | null) {
  const { on, off, emit } = useSocket();
  const { user } = useAuth();
  const { currentProject } = useProject();
  // Map of field → { userId, email } for fields locked by OTHER users
  const [lockedFields, setLockedFields] = useState<Map<string, { userId: number; email: string }>>(new Map());

  useEffect(() => {
    if (!ticketId) return;

    on('ticket:editing', (data: { ticketId: number; userId: number; email: string; field: string }) => {
      if (data.ticketId !== ticketId || data.userId === user?.id) return;
      setLockedFields(prev => {
        const next = new Map(prev);
        next.set(data.field, { userId: data.userId, email: data.email });
        return next;
      });
    });

    on('ticket:stop-editing', (data: { ticketId: number; userId: number; field: string }) => {
      if (data.ticketId !== ticketId) return;
      setLockedFields(prev => {
        const current = prev.get(data.field);
        if (current && current.userId === data.userId) {
          const next = new Map(prev);
          next.delete(data.field);
          return next;
        }
        return prev;
      });
    });

    return () => {
      off('ticket:editing');
      off('ticket:stop-editing');
    };
  }, [on, off, ticketId, user?.id]);

  const startEditing = useCallback((field: string) => {
    if (ticketId && currentProject?.id) {
      emit('ticket:editing', { ticketId, projectId: currentProject.id, field });
    }
  }, [emit, ticketId, currentProject?.id]);

  const stopEditing = useCallback((field?: string) => {
    if (ticketId && currentProject?.id) {
      if (field) {
        emit('ticket:stop-editing', { ticketId, projectId: currentProject.id, field });
      } else {
        // Stop all fields (on unmount)
        emit('ticket:stop-editing', { ticketId, projectId: currentProject.id, field: 'title' });
        emit('ticket:stop-editing', { ticketId, projectId: currentProject.id, field: 'description' });
      }
    }
  }, [emit, ticketId, currentProject?.id]);

  const isFieldLocked = useCallback((field: string) => {
    return lockedFields.get(field) || null;
  }, [lockedFields]);

  return { lockedFields, isFieldLocked, startEditing, stopEditing };
}

// ── User Status ─────────────────────────────────────────────────────────────

export function useUserStatus() {
  const { on, off, emit } = useSocket();
  const { user } = useAuth();
  const [statusMap, setStatusMap] = useState<Map<number, UserStatus>>(new Map());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    on('user:status', (data: UserStatus) => {
      setStatusMap(prev => {
        const next = new Map(prev);
        next.set(data.userId, data);
        return next;
      });
    });

    return () => { off('user:status'); };
  }, [on, off]);

  // Set own status
  const setStatus = useCallback((status: 'available' | 'busy' | 'away') => {
    emit('user:status', { status });
  }, [emit]);

  // Auto-idle detection: go away after 10 min of inactivity
  useEffect(() => {
    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setStatus('available');
      idleTimerRef.current = setTimeout(() => {
        setStatus('away');
      }, 10 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    resetIdle();

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [setStatus]);

  const getStatus = useCallback((userId: number): 'available' | 'busy' | 'away' => {
    return statusMap.get(userId)?.status || 'available';
  }, [statusMap]);

  return { statusMap, getStatus, setStatus };
}

// ── Drag Awareness ──────────────────────────────────────────────────────────

export function useDragAwareness() {
  const { on, off, emit } = useSocket();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [draggingMap, setDraggingMap] = useState<Map<number, { userId: number; email: string }>>(new Map());

  useEffect(() => {
    on('ticket:drag-start', (data: { ticketId: number; userId: number; email: string }) => {
      if (data.userId === user?.id) return;
      setDraggingMap(prev => {
        const next = new Map(prev);
        next.set(data.ticketId, { userId: data.userId, email: data.email });
        return next;
      });
    });

    on('ticket:drag-end', (data: { ticketId: number; userId: number }) => {
      setDraggingMap(prev => {
        const next = new Map(prev);
        next.delete(data.ticketId);
        return next;
      });
    });

    return () => {
      off('ticket:drag-start');
      off('ticket:drag-end');
    };
  }, [on, off, user?.id]);

  const startDragging = useCallback((ticketId: number) => {
    if (currentProject?.id) {
      emit('ticket:drag-start', { ticketId, projectId: currentProject.id });
    }
  }, [emit, currentProject?.id]);

  const stopDragging = useCallback((ticketId: number) => {
    if (currentProject?.id) {
      emit('ticket:drag-end', { ticketId, projectId: currentProject.id });
    }
  }, [emit, currentProject?.id]);

  const isDragging = useCallback((ticketId: number) => {
    return draggingMap.get(ticketId) || null;
  }, [draggingMap]);

  return { draggingMap, isDragging, startDragging, stopDragging };
}
