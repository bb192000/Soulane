import { Request, Response } from 'express';
import crypto from 'crypto';
import { SpotifyService } from './spotify.service';
import { redis } from '../../config/redis';
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../../utils/encryption';

const spotifyService = new SpotifyService();
const prisma = new PrismaClient();

const REQUIRED_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state'
];

export const loginWithSpotify = async (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(32).toString('hex');
    const { verifier, challenge } = spotifyService.generatePKCE();
    
    // Store state and verifier in Redis with 5 min TTL
    await redis.setEx(`spotify_auth:${state}`, 300, verifier);
    
    const loginUrl = spotifyService.getLoginUrl(state, challenge);
    res.redirect(loginUrl);
  } catch (error) {
    console.error('Login initiation failed:', error);
    res.status(500).json({ error: 'LOGIN_INIT_FAILED' });
  }
};

export const spotifyCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  
  if (!state || !code) {
    return res.status(400).json({ error: 'INVALID_PARAMETERS' });
  }

  try {
    // 1. Validate state
    const verifier = await redis.get(`spotify_auth:${state}`);
    if (!verifier) {
      return res.status(400).json({ error: 'INVALID_STATE' });
    }
    
    // Invalidate state immediately to prevent replay attacks
    await redis.del(`spotify_auth:${state}`);
    
    // 2. Exchange code for tokens
    const tokens = await spotifyService.getTokens(code, verifier);
    
    // 3. Validate mandatory scopes
    const grantedScopes = tokens.scope ? tokens.scope.split(' ') : [];
    const hasRequiredScopes = REQUIRED_SCOPES.every(scope => grantedScopes.includes(scope));
    if (!hasRequiredScopes) {
      return res.status(403).json({ error: 'MISSING_REQUIRED_SCOPES' });
    }

    // 4. Fetch Spotify profile
    const profile = await spotifyService.getCurrentUser(tokens.access_token);
    
    // 5. Transaction to handle the full Auth + Identity logic
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.$transaction(async (tx) => {
      // 5a. Upsert User (Linkage)
      const user = await tx.user.upsert({
        where: { email: profile.email }, 
        update: {
          name: profile.display_name,
          avatarUrl: profile.images?.[0]?.url
        },
        create: {
          email: profile.email,
          name: profile.display_name,
          avatarUrl: profile.images?.[0]?.url
        }
      });

      // 5b. Encrypt token strictly passing user.id as Associated Authenticated Data
      const encryptedRefresh = encrypt(tokens.refresh_token, user.id);

      // 5c. Upsert OAuthProvider credential store
      await tx.oAuthProvider.upsert({
        where: {
          provider_providerUserId: {
            provider: 'spotify',
            providerUserId: profile.id
          }
        },
        update: {
          encryptedRefreshToken: encryptedRefresh,
          scopes: tokens.scope,
          expiresAt,
          userId: user.id
        },
        create: {
          provider: 'spotify',
          providerUserId: profile.id,
          encryptedRefreshToken: encryptedRefresh,
          scopes: tokens.scope,
          expiresAt,
          userId: user.id
        }
      });

      // 5d. Create robust SyncWave session
      await tx.session.create({
        data: {
          userId: user.id,
          sessionId: sessionId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });
    });

    // 6. Set secure cookie
    res.cookie('syncwave_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // 7. Redirect to frontend app
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
  } catch (error: any) {
    console.error('Spotify auth error:', error?.response?.data || error);
    res.status(500).json({ error: 'TOKEN_EXCHANGE_FAILED' });
  }
};

export const devLogin = async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'DEV_LOGIN_DISABLED' });
  }

  const mockUser = {
    id: 'dev-user-123',
    email: 'dev@soulane.app',
    display_name: 'Dev Tester',
    images: []
  };

  const sessionId = 'dev-session-' + crypto.randomBytes(16).toString('hex');

  // Skip Prisma if DATABASE_URL is missing, just set cookie for local observability
  if (process.env.DATABASE_URL) {
    try {
      await prisma.user.upsert({
        where: { email: mockUser.email },
        update: {},
        create: { email: mockUser.email, name: mockUser.display_name }
      });
      // ... session creation logic ...
    } catch (e) {
      console.warn('[DevLogin] Database skip (optional for observability)');
    }
  }

  res.cookie('syncwave_session', sessionId, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
};

export const logout = async (req: Request, res: Response) => {
  const sessionId = req.cookies?.syncwave_session;
  
  if (sessionId) {
    try {
      await prisma.session.delete({
        where: { sessionId }
      });
      // Optionally clean up Redis presence state here
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  res.clearCookie('syncwave_session');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};
