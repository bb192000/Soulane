import { Router, Request, Response } from 'express';
import { spotifyService } from '../services/SpotifyService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Search ────────────────────────────────────────────────────────────────────

router.get('/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const result = await spotifyService.search(query, limit);
    res.json(result);
  } catch (err: any) {
    console.error('[spotify] search error:', err.message);
    res.status(500).json({ error: 'Spotify search failed' });
  }
});

// ── Track lookup ──────────────────────────────────────────────────────────────

router.get('/track/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const track = await spotifyService.getTrack(id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json(track);
  } catch (err: any) {
    console.error('[spotify] track lookup error:', err.message);
    res.status(500).json({ error: 'Track lookup failed' });
  }
});

// ── OAuth ─────────────────────────────────────────────────────────────────────

router.get('/auth', (req: Request, res: Response) => {
  const state = uuidv4();
  // In production store state in Redis/session for CSRF protection
  const url = spotifyService.getAuthUrl(state);
  res.json({ url });
});

router.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  if (error) {
    return res.redirect(`${CLIENT_URL}?auth_error=${error}`);
  }

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    const tokens = await spotifyService.exchangeCode(code as string);
    // In production: store refresh token in DB, return access token to client
    const params = new URLSearchParams({
      access_token: tokens.accessToken,
      expires_in: tokens.expiresIn.toString(),
    });
    res.redirect(`${CLIENT_URL}/auth/success?${params}`);
  } catch (err: any) {
    console.error('[spotify] oauth error:', err.message);
    res.redirect(`${CLIENT_URL}?auth_error=exchange_failed`);
  }
});

router.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  try {
    const result = await spotifyService.refreshToken(refresh_token);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

export default router;
