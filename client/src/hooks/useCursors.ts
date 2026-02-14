import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import { useProject } from './useProject';
import type { CursorData, RemoteCursor, PresenceUser } from '../types';

const COLORS = [
  '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981',
  '#f97316', '#ec4899', '#6366f1', '#14b8a6', '#e11d48',
];

export function userColor(userId: number): string {
  return COLORS[userId % COLORS.length];
}

const THROTTLE_MS = 50;
const STALE_TIMEOUT = 5000;
const STALE_CHECK_INTERVAL = 2000;

export function useCursors() {
  const { on, off, emit } = useSocket();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const cursorsRef = useRef<Map<number, RemoteCursor>>(new Map());
  const lastEmitRef = useRef(0);
  const projectIdRef = useRef<number | null>(null);

  // Clear state on project change
  useEffect(() => {
    if (currentProject?.id !== projectIdRef.current) {
      cursorsRef.current.clear();
      setCursors([]);
      setPresence([]);
      projectIdRef.current = currentProject?.id ?? null;
    }
  }, [currentProject?.id]);

  const isSoloProject = currentProject?.is_private === 1;
  const cursorsDisabled = isSoloProject || currentProject?.cursors_enabled === 0;
  const presenceDisabled = isSoloProject || currentProject?.presence_enabled === 0;

  // Clear cursors immediately when disabled
  useEffect(() => {
    if (cursorsDisabled) {
      cursorsRef.current.clear();
      setCursors([]);
    }
  }, [cursorsDisabled]);

  // Listen to cursor events
  useEffect(() => {
    on('cursor:update', (data: CursorData & { projectId?: number }) => {
      if (data.projectId !== currentProject?.id) return;
      if (data.userId === user?.id) return;
      if (cursorsDisabled) return;
      const cursor: RemoteCursor = {
        ...data,
        color: userColor(data.userId),
        lastSeen: Date.now(),
      };
      cursorsRef.current.set(data.userId, cursor);
      setCursors(Array.from(cursorsRef.current.values()));
    });

    on('cursor:remove', (data: { projectId?: number; userId: number }) => {
      if (data.projectId !== currentProject?.id) return;
      cursorsRef.current.delete(data.userId);
      setCursors(Array.from(cursorsRef.current.values()));
    });

    on('presence:sync', (data: { projectId: number; users: { userId: number; email: string }[] }) => {
      if (data.projectId !== currentProject?.id) return;
      if (presenceDisabled) {
        setPresence([]);
      } else {
        setPresence(data.users.map(u => ({ ...u, color: userColor(u.userId) })));
      }
    });

    return () => {
      off('cursor:update');
      off('cursor:remove');
      off('presence:sync');
    };
  }, [on, off, user?.id, currentProject?.id, cursorsDisabled, presenceDisabled]);

  // Cleanup stale cursors every 2s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [uid, cursor] of cursorsRef.current) {
        if (now - cursor.lastSeen > STALE_TIMEOUT) {
          cursorsRef.current.delete(uid);
          changed = true;
        }
      }
      if (changed) setCursors(Array.from(cursorsRef.current.values()));
    }, STALE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const sendCursorMove = useCallback((x: number, y: number) => {
    if (cursorsDisabled) return;
    const now = Date.now();
    if (now - lastEmitRef.current < THROTTLE_MS) return;
    lastEmitRef.current = now;
    if (currentProject?.id) {
      emit('cursor:move', { x, y, projectId: currentProject.id });
    }
  }, [emit, currentProject?.id, cursorsDisabled]);

  const sendCursorLeave = useCallback(() => {
    if (currentProject?.id) {
      emit('cursor:leave', { projectId: currentProject.id });
    }
  }, [emit, currentProject?.id]);

  return {
    cursors: cursorsDisabled ? [] : cursors,
    presence: presenceDisabled ? [] : presence,
    sendCursorMove,
    sendCursorLeave,
  };
}
