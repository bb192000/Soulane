import { Server, Socket } from 'socket.io';
import { roomManager } from '../services/RoomManager';
import { spotifyService } from '../services/SpotifyService';
import { ClientToServerEvents, ServerToClientEvents, SyncTick } from '@soulane/shared';

const SYNC_TICK_INTERVAL_MS = 500;

export function registerSocketHandlers(io: Server) {
  // ── Global sync ticker — broadcasts canonical position every 500ms ────────
  setInterval(() => {
    // Note: roomManager.rooms is private, but we'll use a hack or update RoomManager
    // In the user's prompt, it was cast to any.
    for (const [roomId, room] of (roomManager as any).rooms as Map<string, any>) {
      if (!room.isPlaying || !room.currentTrack) continue;

      // Advance position
      roomManager.updatePosition(roomId, SYNC_TICK_INTERVAL_MS);

      // Auto-advance to next track if current track ended
      if (room.positionMs >= room.currentTrack.durationMs) {
        roomManager.nextTrack(roomId);
        io.to(roomId).emit('room:state', room);
      }

      const tick: SyncTick = {
        serverTimestamp: Date.now(),
        positionMs: room.positionMs,
        isPlaying: room.isPlaying,
        trackId: room.currentTrack?.id ?? null,
      };

      io.to(roomId).emit('sync:tick', tick);
    }
  }, SYNC_TICK_INTERVAL_MS);

  // ── Per-connection handlers ───────────────────────────────────────────────
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Create room
    socket.on('room:create', ({ displayName }) => {
      const room = roomManager.createRoom(socket.id, displayName);
      socket.join(room.roomId);
      socket.emit('room:joined', { roomId: room.roomId, isHost: true });
      socket.emit('room:state', room);
      console.log(`[room] created: ${room.roomId} by ${displayName}`);
    });

    // Join room
    socket.on('room:join', ({ roomId, displayName }) => {
      const normalizedId = roomId.trim().toUpperCase();
      const room = roomManager.joinRoom(normalizedId, socket.id, displayName);

      if (!room) {
        socket.emit('room:error', { message: `Room "${roomId}" not found` });
        return;
      }

      socket.join(normalizedId);
      socket.emit('room:joined', { roomId: normalizedId, isHost: false });

      // Send current state + sync tick immediately
      socket.emit('room:state', room);
      if (room.currentTrack) {
        const tick: SyncTick = {
          serverTimestamp: Date.now(),
          positionMs: room.positionMs,
          isPlaying: room.isPlaying,
          trackId: room.currentTrack.id,
        };
        socket.emit('sync:tick', tick);
      }

      // Notify others
      socket.to(normalizedId).emit('room:state', room);
      console.log(`[room] ${displayName} joined: ${normalizedId}`);
    });

    // Leave room
    socket.on('room:leave', () => handleLeave(socket));

    // Playback — host only
    socket.on('playback:play', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !roomManager.isHost(room.roomId, socket.id)) return;
      const updated = roomManager.play(room.roomId);
      if (updated) io.to(room.roomId).emit('room:state', updated);
    });

    socket.on('playback:pause', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !roomManager.isHost(room.roomId, socket.id)) return;
      const updated = roomManager.pause(room.roomId);
      if (updated) io.to(room.roomId).emit('room:state', updated);
    });

    socket.on('playback:seek', ({ positionMs }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !roomManager.isHost(room.roomId, socket.id)) return;
      const updated = roomManager.seek(room.roomId, positionMs);
      if (updated) {
        io.to(room.roomId).emit('room:state', updated);
        io.to(room.roomId).emit('sync:tick', {
          serverTimestamp: Date.now(),
          positionMs,
          isPlaying: updated.isPlaying,
          trackId: updated.currentTrack?.id ?? null,
        });
      }
    });

    socket.on('playback:next', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !roomManager.isHost(room.roomId, socket.id)) return;
      const updated = roomManager.nextTrack(room.roomId);
      if (updated) io.to(room.roomId).emit('room:state', updated);
    });

    // Queue
    socket.on('queue:add', async ({ trackId }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const track = await spotifyService.getTrack(trackId);
      if (!track) {
        socket.emit('room:error', { message: 'Track not found on Spotify' });
        return;
      }

      const member = room.members.find(m => m.socketId === socket.id);
      const updated = roomManager.addToQueue(room.roomId, track, member?.displayName ?? 'Unknown');
      if (updated) io.to(room.roomId).emit('room:state', updated);
    });

    // Telemetry from clients
    socket.on('telemetry:report', (telemetry) => {
      roomManager.updateTelemetry(socket.id, telemetry);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      handleLeave(socket);
    });
  });

  function handleLeave(socket: Socket) {
    const result = roomManager.leaveRoom(socket.id);
    if (!result) return;
    const { room } = result;
    socket.leave(room.roomId);
    io.to(room.roomId).emit('room:state', room);
    console.log(`[room] ${socket.id} left: ${room.roomId}`);
  }
}
