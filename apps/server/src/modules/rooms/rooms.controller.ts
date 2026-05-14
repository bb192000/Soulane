import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createRoom = async (req: Request, res: Response) => {
  const { name, hostId } = req.body;
  try {
    // Basic validation
    if (!name || !hostId) {
      return res.status(400).json({ error: 'Name and hostId required' });
    }

    const room = await prisma.room.create({
      data: { 
        name, 
        hostId 
      }
    });

    // Automatically join the host as 'HOST'
    await prisma.roomMember.create({
      data: { 
        roomId: room.id, 
        userId: hostId, 
        role: 'HOST' 
      }
    });

    // Initialize playback state
    await prisma.playbackState.create({
      data: {
        roomId: room.id,
      }
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

export const joinRoom = async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const member = await prisma.roomMember.upsert({
      where: { 
        roomId_userId: { roomId, userId } 
      },
      update: {
        // e.g. update last joined timestamp
      },
      create: { 
        roomId, 
        userId, 
        role: 'LISTENER' 
      }
    });

    res.json(member);
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
};
