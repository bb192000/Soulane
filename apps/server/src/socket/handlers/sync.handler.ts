import { Socket } from 'socket.io';
import { calculateDriftCorrection } from '../sync-engine/driftCorrection';
import { redis } from '../../config/redis';

export const registerSyncHandlers = (socket: Socket) => {
  const userId = socket.data.user?.id;

  // Client reports their current playback state
  socket.on('playback:heartbeat', async (data: { roomId: string, trackId: string, position: number }) => {
    try {
      // 1. Log heartbeat to Redis (Live Layer)
      await redis.set(`room:${data.roomId}:heartbeat:${userId}`, JSON.stringify({
        position: data.position,
        timestamp: Date.now()
      }), { EX: 15 }); // Expire after 15s to auto-clean disconnected users
      
      // 2. Get current server 'truth' position for this room from Redis/DB
      const serverPositionStr = await redis.get(`room:${data.roomId}:playback:position`);
      const serverPosition = serverPositionStr ? parseFloat(serverPositionStr) : data.position;
      
      // 3. Calculate if client needs adjustment
      const adjustment = calculateDriftCorrection(data.position, serverPosition);
      
      // 4. Send correction instruction if needed
      if (adjustment.action !== 'ignore') {
        socket.emit('playback:correction', adjustment);
      }
    } catch (error) {
      console.error('[Sync] Heartbeat processing failed', error);
    }
  });

  socket.on('playback:play', async (data: { roomId: string, position: number, version: number }) => {
    // 1. Validate host privileges via Redis or DB
    // 2. Update global room state in Redis & PostgreSQL
    // 3. Broadcast to room with new version
    socket.to(data.roomId).emit('playback:play', { 
      position: data.position, 
      version: data.version,
      timestamp: Date.now()
    });
  });

  socket.on('playback:pause', async (data: { roomId: string, position: number, version: number }) => {
    // Validate host privileges
    socket.to(data.roomId).emit('playback:pause', { 
      position: data.position, 
      version: data.version,
      timestamp: Date.now()
    });
  });
};
