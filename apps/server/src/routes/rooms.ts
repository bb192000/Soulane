import { Router, Request, Response } from 'express';
import { roomManager } from '../services/RoomManager';

const router = Router();

// Get room info (used by clients before joining via socket)
router.get('/:roomId', (req: Request, res: Response) => {
  const roomId = req.params.roomId.toUpperCase();
  const room = roomManager.getRoom(roomId);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Return safe subset (no socket IDs)
  res.json({
    roomId: room.roomId,
    memberCount: room.members.length,
    currentTrack: room.currentTrack,
    isPlaying: room.isPlaying,
    queueLength: room.queue.length,
  });
});

export default router;
