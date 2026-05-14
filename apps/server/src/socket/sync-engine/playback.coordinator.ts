import { redis } from '../../../config/redis';
import { eventBus } from '../events/event.bus';
import { z } from 'zod';

export type EventType = 'PLAY' | 'PAUSE' | 'SEEK' | 'TRACK_CHANGE';

export interface ClientIntent {
  eventId: string;
  roomId: string;
  authoritySessionId: string;
  clientEpoch: number;
  type: EventType;
  payload: any;
}

export interface CommittedPlaybackState {
  schemaVersion: number;
  roomId: string;
  version: number;
  authorityEpoch: number;
  serverTimestamp: number;
  type: EventType;
  isPlaying: boolean;
  playbackRate: number;
  position: number;
  trackId: string;
}

// Strict Zod Validation Schema BEFORE touching Redis
const ClientIntentSchema = z.object({
  eventId: z.string(),
  roomId: z.string(),
  authoritySessionId: z.string(),
  clientEpoch: z.number().int().nonnegative(),
  type: z.enum(['PLAY', 'PAUSE', 'SEEK', 'TRACK_CHANGE']),
  payload: z.object({
    isPlaying: z.boolean().optional(),
    playbackRate: z.number().optional(),
    position: z.number().optional(),
    trackId: z.string().optional()
  }).default({})
});

const COMMIT_LUA_SCRIPT = `
local intentKey = KEYS[1]
local authorityKey = KEYS[2]
local playbackKey = KEYS[3]
local globalStreamKey = KEYS[4]

local authoritySessionId = ARGV[1]
local clientEpoch = tonumber(ARGV[2])
local newStatePayload = ARGV[3]
local serverTimestamp = ARGV[4]
local idempotencyTtl = ARGV[5]

-- 1. Idempotency Check
if redis.call('SET', intentKey, '1', 'NX', 'EX', idempotencyTtl) == false then
  return 'DUPLICATE'
end

-- 2. Authority Validation
local authData = redis.call('HMGET', authorityKey, 'currentAuthoritySessionId', 'authorityEpoch', 'version')
local currentAuthSession = authData[1]
local currentEpoch = tonumber(authData[2])
local currentVersion = tonumber(authData[3])

if not currentAuthSession then return 'NO_AUTHORITY' end
if currentAuthSession ~= authoritySessionId then return 'UNAUTHORIZED' end
if clientEpoch < currentEpoch then return 'STALE_EPOCH' end

-- 3. Increment Version
local nextVersion = currentVersion + 1
redis.call('HSET', authorityKey, 'version', nextVersion, 'updatedAt', serverTimestamp)

-- 4. Inject strict sequenced constraints into JSON 
local stateObj = cjson.decode(newStatePayload)
stateObj.schemaVersion = 1
stateObj.version = nextVersion
stateObj.authorityEpoch = currentEpoch
stateObj.serverTimestamp = tonumber(serverTimestamp)
local finalPayload = cjson.encode(stateObj)

-- 5. Commit Durable Truth
redis.call('SET', playbackKey, finalPayload)

-- 6. Event Sourced Append-Log (MaxLen removed from Lua to avoid destroying recovery. Handled via Retention Policy later)
redis.call('XADD', globalStreamKey, '*', 'event', finalPayload)

return finalPayload
`;

export class PlaybackCoordinator {
  async handleIntent(rawIntent: unknown) {
    // Schema Validation: Reject garbage instantly
    const parsed = ClientIntentSchema.safeParse(rawIntent);
    if (!parsed.success) {
      console.warn('[PlaybackCoordinator] Invalid intent payload:', parsed.error);
      return;
    }

    const intent = parsed.data;
    const { eventId, roomId, authoritySessionId, clientEpoch, type, payload } = intent;

    const intentKey = `syncwave:intent:${eventId}`;
    const authorityKey = `syncwave:room:${roomId}:authority`;
    const playbackKey = `syncwave:room:${roomId}:playback`;
    const globalStreamKey = `syncwave:global:events`;

    const serverTimestamp = Date.now().toString();
    const idempotencyTtl = '60';

    const baseState = {
      roomId,
      type,
      isPlaying: type === 'PLAY' ? true : type === 'PAUSE' ? false : payload.isPlaying || true,
      playbackRate: payload.playbackRate || 1.0,
      position: payload.position || 0,
      trackId: payload.trackId || ''
    };

    try {
      const result = await redis.eval(
        COMMIT_LUA_SCRIPT, 4,
        intentKey, authorityKey, playbackKey, globalStreamKey,
        authoritySessionId, clientEpoch.toString(), JSON.stringify(baseState), serverTimestamp, idempotencyTtl
      );

      if (result === 'DUPLICATE' || result === 'NO_AUTHORITY' || result === 'UNAUTHORIZED' || result === 'STALE_EPOCH') {
        console.warn(`[PlaybackCoordinator] Intent ${eventId} rejected: ${result}`);
        return;
      }
    } catch (err) {
      console.error('[PlaybackCoordinator] Atomic commit failed:', err);
    }
  }

  async getRecoveryState(roomId: string) {
    // Pipeline for atomic multi-key read without a full transaction block
    const pipeline = redis.pipeline();
    pipeline.get(`syncwave:room:${roomId}:playback`);
    pipeline.hmget(`syncwave:room:${roomId}:authority`, 'currentAuthoritySessionId', 'authorityEpoch');
    
    const results = await pipeline.exec();
    if (!results) return null;

    const rawPlayback = results[0] as string | null;
    const rawAuth = results[1] as [string | null, string | null];

    if (!rawPlayback) return null;

    const playback = JSON.parse(rawPlayback) as CommittedPlaybackState;
    const authoritySessionId = rawAuth[0] || '';
    const authorityEpoch = rawAuth[1] ? parseInt(rawAuth[1], 10) : playback.authorityEpoch;

    return {
      roomId: playback.roomId,
      authorityEpoch: authorityEpoch,
      version: playback.version,
      committedPosition: playback.position,
      playbackRate: playback.playbackRate,
      isPlaying: playback.isPlaying,
      serverTimestamp: playback.serverTimestamp,
      authoritySessionId
    };
  }
}
