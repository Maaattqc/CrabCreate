import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import config from './config';
import logger from './services/logger';
import * as repo from './db/repositories';
import type { JwtPayload } from './middleware/auth';

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

let io: Server | null = null;

// ── Presence tracking (in-memory) ────────────────────────────────────────────
// Maps projectId → Set of socket IDs that are present
const presenceMap = new Map<number, Map<string, { userId: number; email: string }>>();

// ── User status tracking (in-memory) ────────────────────────────────────────
// userId → status
const userStatusMap = new Map<number, { status: 'available' | 'busy' | 'away'; lastActive: number }>();

// ── Ticket viewing tracking (in-memory) ─────────────────────────────────────
// ticketId → Set of { socketId, userId, email }
const ticketViewersMap = new Map<number, Map<string, { userId: number; email: string }>>();

// ── Ticket editing tracking (in-memory) ─────────────────────────────────────
// `${ticketId}:${field}` → { socketId, userId, email }
const ticketEditingMap = new Map<string, { socketId: string; userId: number; email: string }>();

// ── Ticket dragging tracking (in-memory) ────────────────────────────────────
// ticketId → { userId, email }
const ticketDraggingMap = new Map<number, { userId: number; email: string }>();

function addToPresence(projectId: number, socketId: string, userId: number, email: string): void {
  if (!presenceMap.has(projectId)) presenceMap.set(projectId, new Map());
  presenceMap.get(projectId)!.set(socketId, { userId, email });
}

function removeFromPresence(projectId: number, socketId: string): void {
  const room = presenceMap.get(projectId);
  if (!room) return;
  room.delete(socketId);
  if (room.size === 0) presenceMap.delete(projectId);
}

function getPresenceList(projectId: number): { userId: number; email: string }[] {
  const room = presenceMap.get(projectId);
  if (!room) return [];
  // Deduplicate by userId (one user with multiple tabs = single entry)
  const seen = new Map<number, { userId: number; email: string }>();
  for (const entry of room.values()) {
    if (!seen.has(entry.userId)) seen.set(entry.userId, entry);
  }
  return Array.from(seen.values());
}

function initSocket(httpServer: http.Server): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.nodeEnv === 'development' ? config.clientUrl : false,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authenticate socket connections via JWT cookie
  io.use((socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie || '');
      const token = cookies.crab_token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS512'] }) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user?.userId;
    const email = socket.data.user?.email ?? '';
    logger.info(`[Socket] Client connected: ${socket.id} (${email})`);

    // Auto-join all project rooms the user belongs to
    if (userId) {
      const projects = repo.findProjectsByUserId(userId);
      for (const project of projects) {
        socket.join(`project:${project.id}`);
        addToPresence(project.id, socket.id, userId, email);
        io!.to(`project:${project.id}`).emit('presence:sync', { projectId: project.id, users: getPresenceList(project.id) });
      }
    }

    // Client can switch projects — join/leave rooms
    socket.on('project:join', (projectId: number) => {
      if (!userId) return;
      socket.join(`project:${projectId}`);
      addToPresence(projectId, socket.id, userId, email);
      io!.to(`project:${projectId}`).emit('presence:sync', { projectId, users: getPresenceList(projectId) });
    });

    socket.on('project:leave', (projectId: number) => {
      if (!userId) return;
      removeFromPresence(projectId, socket.id);
      io!.to(`project:${projectId}`).emit('presence:sync', { projectId, users: getPresenceList(projectId) });
      socket.to(`project:${projectId}`).emit('cursor:remove', { userId });
      socket.leave(`project:${projectId}`);
    });

    // ── Cursor relay ──────────────────────────────────────────────────────────
    socket.on('cursor:move', (data: { x: number; y: number; projectId: number }) => {
      if (!userId) return;
      socket.to(`project:${data.projectId}`).emit('cursor:update', {
        projectId: data.projectId,
        userId,
        email,
        x: data.x,
        y: data.y,
      });
    });

    socket.on('cursor:leave', (data: { projectId: number }) => {
      if (!userId) return;
      socket.to(`project:${data.projectId}`).emit('cursor:remove', { projectId: data.projectId, userId });
    });

    // ── Ticket viewing ──────────────────────────────────────────────────────
    socket.on('ticket:view', (data: { ticketId: number; projectId: number }) => {
      if (!userId) return;
      if (!ticketViewersMap.has(data.ticketId)) ticketViewersMap.set(data.ticketId, new Map());
      ticketViewersMap.get(data.ticketId)!.set(socket.id, { userId, email });
      const viewers = Array.from(ticketViewersMap.get(data.ticketId)!.values());
      // Deduplicate by userId
      const seen = new Map<number, { userId: number; email: string }>();
      for (const v of viewers) { if (!seen.has(v.userId)) seen.set(v.userId, v); }
      io!.to(`project:${data.projectId}`).emit('ticket:viewers', {
        ticketId: data.ticketId,
        viewers: Array.from(seen.values()),
      });
    });

    socket.on('ticket:unview', (data: { ticketId: number; projectId: number }) => {
      if (!userId) return;
      const map = ticketViewersMap.get(data.ticketId);
      if (map) {
        map.delete(socket.id);
        if (map.size === 0) ticketViewersMap.delete(data.ticketId);
      }
      const viewers = ticketViewersMap.get(data.ticketId);
      const list = viewers ? Array.from(viewers.values()) : [];
      const seen = new Map<number, { userId: number; email: string }>();
      for (const v of list) { if (!seen.has(v.userId)) seen.set(v.userId, v); }
      io!.to(`project:${data.projectId}`).emit('ticket:viewers', {
        ticketId: data.ticketId,
        viewers: Array.from(seen.values()),
      });
    });

    // ── Typing indicator ────────────────────────────────────────────────────
    socket.on('ticket:typing', (data: { ticketId: number; projectId: number }) => {
      if (!userId) return;
      socket.to(`project:${data.projectId}`).emit('ticket:typing', {
        ticketId: data.ticketId,
        userId,
        email,
      });
    });

    socket.on('ticket:stop-typing', (data: { ticketId: number; projectId: number }) => {
      if (!userId) return;
      socket.to(`project:${data.projectId}`).emit('ticket:stop-typing', {
        ticketId: data.ticketId,
        userId,
      });
    });

    // ── Editing lock (per-field) ─────────────────────────────────────────────
    socket.on('ticket:editing', (data: { ticketId: number; projectId: number; field: string }) => {
      if (!userId || !data.field) return;
      const key = `${data.ticketId}:${data.field}`;
      ticketEditingMap.set(key, { socketId: socket.id, userId, email });
      socket.to(`project:${data.projectId}`).emit('ticket:editing', {
        ticketId: data.ticketId,
        field: data.field,
        userId,
        email,
      });
    });

    socket.on('ticket:stop-editing', (data: { ticketId: number; projectId: number; field: string }) => {
      if (!userId || !data.field) return;
      const key = `${data.ticketId}:${data.field}`;
      const current = ticketEditingMap.get(key);
      if (current && current.userId === userId) {
        ticketEditingMap.delete(key);
      }
      socket.to(`project:${data.projectId}`).emit('ticket:stop-editing', {
        ticketId: data.ticketId,
        field: data.field,
        userId,
      });
    });

    // ── User status ─────────────────────────────────────────────────────────
    socket.on('user:status', (data: { status: 'available' | 'busy' | 'away' }) => {
      if (!userId) return;
      userStatusMap.set(userId, { status: data.status, lastActive: Date.now() });
      // Broadcast to all project rooms this user is in
      if (userId) {
        const projects = repo.findProjectsByUserId(userId);
        for (const project of projects) {
          io!.to(`project:${project.id}`).emit('user:status', {
            userId,
            email,
            status: data.status,
          });
        }
      }
    });

    // ── Drag awareness ──────────────────────────────────────────────────────
    socket.on('ticket:drag-start', (data: { ticketId: number; projectId: number }) => {
      if (!userId) return;
      ticketDraggingMap.set(data.ticketId, { userId, email });
      socket.to(`project:${data.projectId}`).emit('ticket:drag-start', {
        ticketId: data.ticketId,
        userId,
        email,
      });
    });

    socket.on('ticket:drag-end', (data: { ticketId: number; projectId: number }) => {
      if (!userId) return;
      ticketDraggingMap.delete(data.ticketId);
      socket.to(`project:${data.projectId}`).emit('ticket:drag-end', {
        ticketId: data.ticketId,
        userId,
      });
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}`);
      if (!userId) return;
      // Remove from all presence rooms and notify
      for (const [projectId] of presenceMap) {
        const room = presenceMap.get(projectId);
        if (room && room.has(socket.id)) {
          removeFromPresence(projectId, socket.id);
          io!.to(`project:${projectId}`).emit('presence:sync', { projectId, users: getPresenceList(projectId) });
          io!.to(`project:${projectId}`).emit('cursor:remove', { projectId, userId });
        }
      }
      // Clean up ticket viewers and broadcast updated lists
      for (const [ticketId, map] of ticketViewersMap) {
        if (map.has(socket.id)) {
          map.delete(socket.id);
          // Broadcast updated viewers to all project rooms
          const viewers = map.size > 0 ? Array.from(map.values()) : [];
          const seen = new Map<number, { userId: number; email: string }>();
          for (const v of viewers) { if (!seen.has(v.userId)) seen.set(v.userId, v); }
          // Find which project this ticket belongs to by checking socket rooms
          for (const [projectId] of presenceMap) {
            io!.to(`project:${projectId}`).emit('ticket:viewers', {
              ticketId,
              viewers: Array.from(seen.values()),
            });
          }
          if (map.size === 0) ticketViewersMap.delete(ticketId);
        }
      }
      // Clean up editing locks and broadcast
      for (const [key, editor] of ticketEditingMap) {
        if (editor.socketId === socket.id) {
          ticketEditingMap.delete(key);
          const [ticketIdStr, field] = key.split(':');
          for (const [projectId] of presenceMap) {
            io!.to(`project:${projectId}`).emit('ticket:stop-editing', { ticketId: Number(ticketIdStr), field, userId });
          }
        }
      }
      // Clean up dragging and broadcast
      for (const [ticketId, dragger] of ticketDraggingMap) {
        if (dragger.userId === userId) {
          ticketDraggingMap.delete(ticketId);
          for (const [projectId] of presenceMap) {
            io!.to(`project:${projectId}`).emit('ticket:drag-end', { ticketId, userId });
          }
        }
      }
      // Clean up user status
      userStatusMap.delete(userId);
    });
  });

  return io;
}

function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

function emitTicketLog(ticketId: number, message: string, logType: string = 'info', phase: string = '', projectId?: number): void {
  if (io) {
    const payload = { ticketId, message, logType, phase };
    if (projectId) {
      io.to(`project:${projectId}`).emit('ticket:log', payload);
    } else {
      io.emit('ticket:log', payload);
    }
  }
}

function emitTicketStatus(ticketId: number, status: string, progress: number = 0, projectId?: number): void {
  if (io) {
    const payload = { ticketId, status, progress };
    if (projectId) {
      io.to(`project:${projectId}`).emit('ticket:status', payload);
    } else {
      io.emit('ticket:status', payload);
    }
  }
}

function emitTicketUpdated(ticketId: number, fields: Record<string, any>, projectId?: number): void {
  if (io) {
    const payload = { ticketId, ...fields };
    if (projectId) {
      io.to(`project:${projectId}`).emit('ticket:updated', payload);
    } else {
      io.emit('ticket:updated', payload);
    }
  }
}

function emitNotification(message: string, type: string = 'info', projectId?: number): void {
  if (io) {
    const payload = { message, type };
    if (projectId) {
      io.to(`project:${projectId}`).emit('notification', payload);
    } else {
      io.emit('notification', payload);
    }
  }
}

function emitProjectUpdated(projectId: number, fields: Record<string, any>): void {
  if (io) {
    io.to(`project:${projectId}`).emit('project:updated', { projectId, ...fields });
  }
}

export { initSocket, getIO, emitTicketLog, emitTicketStatus, emitTicketUpdated, emitNotification, emitProjectUpdated };
