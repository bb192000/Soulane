import axios from 'axios';
import crypto from 'crypto';

export class SpotifyService {
  private readonly clientId = process.env.SPOTIFY_CLIENT_ID || '';
  private readonly clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  private readonly redirectUri = `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/auth/spotify/callback`;

  generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  getLoginUrl(state: string, challenge: string) {
    const scopes = [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-modify-playback-state',
      'user-read-playback-state'
    ];
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: scopes.join(' '),
      redirect_uri: this.redirectUri,
      state: state,
      code_challenge_method: 'S256',
      code_challenge: challenge
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async getTokens(code: string, verifier: string) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: verifier
    });

    const response = await axios.post('https://accounts.spotify.com/api/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      timeout: 5000
    });

    return response.data;
  }

  async refreshAccessToken(refreshToken: string) {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId
    });

    const response = await axios.post('https://accounts.spotify.com/api/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      timeout: 5000
    });

    return response.data;
  }

  async getCurrentUser(accessToken: string) {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 5000
    });
    return response.data;
  }
}
