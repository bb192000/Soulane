import { RoomState, SpotifyTrack } from '@soulane/shared';

export interface DomeMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  expiresAt: number;
}

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private domes: Map<string, DomeMessage[]> = new Map();

  createRoom(name: string, authorityId: string): RoomState {
    const id = Math.random().toString(36).substring(7);
    const newRoom: RoomState = {
      id,
      name,
      isPlaying: false,
      currentTrack: null,
      listeners: [],
      authorityId
    };
    this.rooms.set(id, newRoom);
    return newRoom;
  }

  getRoom(id: string): RoomState | undefined {
    return this.rooms.get(id);
  }

  updatePlayback(id: string, isPlaying: boolean, track?: SpotifyTrack) {
    const room = this.rooms.get(id);
    if (room) {
      room.isPlaying = isPlaying;
      if (track) room.currentTrack = track;
    }
  }

  // ── THE DOME (Phase 6) ───────────────────────────────────────────────────

  sendDomeMessage(roomId: string, senderId: string, content: string) {
    if (!this.domes.has(roomId)) this.domes.set(roomId, []);
    
    const message: DomeMessage = {
      id: Math.random().toString(36).substring(7),
      senderId,
      content,
      timestamp: Date.now(),
      expiresAt: Date.now() + 60000 // Ephemeral: 60s TTL
    };
    
    this.domes.get(roomId)?.push(message);
    
    // Auto-cleanup for ephemerality
    setTimeout(() => {
      const messages = this.domes.get(roomId);
      if (messages) {
        this.domes.set(roomId, messages.filter(m => m.id !== message.id));
      }
    }, 60000);
  }
}

export const roomManager = new RoomManager();
