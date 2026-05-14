import express from 'express';
import { SpotifyService } from '../services/SpotifyService';

const router = express.Router();

router.post('/callback', async (req, res) => {
  const { code, codeVerifier, redirectUri } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tokenData = await SpotifyService.exchangeCodeForToken(code, codeVerifier, redirectUri);
    // In a real Phase 9 setup, we would generate a custom Soulane JWT here
    // For now, we return the token data securely to the client
    res.json(tokenData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  try {
    const newTokenData = await SpotifyService.refreshToken(refresh_token);
    res.json(newTokenData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
