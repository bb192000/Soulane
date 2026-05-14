// ─── Playback Commands ───────────────────────────────────────────────────────

export type PlaybackCommand =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SEEK'; position: number }
  | { type: 'NUDGE_RATE'; rate: number }
  | { type: 'LOAD_TRACK'; uri: string; spotifyTrackId: string };

// ─── Adapter Capabilities ────────────────────────────────────────────────────

export interface AdapterCapabilities {
  supportsRateAdjustment: boolean;
  estimatedSeekLatencyMs: number;
}

// ─── Sync State ───────────────────────────────────────────────────────────────

export type SyncStatus =
  | 'SYNCED'
  | 'SYNCING'
  | 'SYNC_LOST'
  | 'BUFFERING'
  | 'PAUSED';

export interface SyncTelemetry {
  status: SyncStatus;
  clockOffset: number;       // ms difference from server clock
  confidence: number;        // 0.0 – 1.0
  playbackRate: number;      // current rate (1.0 = normal)
  positionMs: number;        // physical device position
  isBuffering: boolean;
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  albumName: string;
  albumArt: string;
  durationMs: number;
}

export interface RoomMember {
  socketId: string;
  userId: string;
  displayName: string;
  isHost: boolean;
  telemetry: SyncTelemetry | null;
  joinedAt: number;
}

export interface QueueItem {
  track: SpotifyTrack;
  addedBy: string;
  addedAt: number;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  members: RoomMember[];
  queue: QueueItem[];
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  positionMs: number;
  lastUpdatedAt: number;   // server timestamp when state last changed
}

// ─── Socket.IO Events ─────────────────────────────────────────────────────────

// Client → Server
export interface ClientToServerEvents {
  'room:join': (payload: { roomId: string; displayName: string }) => void;
  'room:leave': () => void;
  'room:create': (payload: { displayName: string }) => void;
  'playback:play': () => void;
  'playback:pause': () => void;
  'playback:seek': (payload: { positionMs: number }) => void;
  'playback:next': () => void;
  'queue:add': (payload: { trackId: string }) => void;
  'queue:remove': (payload: { trackId: string }) => void;
  'telemetry:report': (payload: SyncTelemetry) => void;
}

// Server → Client
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:error': (payload: { message: string }) => void;
  'room:joined': (payload: { roomId: string; isHost: boolean }) => void;
  'sync:tick': (payload: SyncTick) => void;
  'playback:command': (command: PlaybackCommand) => void;
}

export interface SyncTick {
  serverTimestamp: number;   // Date.now() on server
  positionMs: number;        // canonical playback position
  isPlaying: boolean;
  trackId: string | null;
}

// ─── Spotify API ──────────────────────────────────────────────────────────────

export interface SpotifySearchResult {
  tracks: SpotifyTrack[];
  total: number;
}
