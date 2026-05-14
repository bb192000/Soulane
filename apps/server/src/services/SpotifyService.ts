import axios from 'axios';
import qs from 'querystring';

export class SpotifyService {
  private static CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  private static CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
  private static REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

  static async exchangeCodeForToken(code: string, codeVerifier?: string, redirectUri?: string) {
    if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
      throw new Error('Backend credentials missing in .env');
    }

    const authHeader = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString('base64');

    try {
      const payload: any = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri || this.REDIRECT_URI,
      };

      if (codeVerifier) {
        payload.code_verifier = codeVerifier;
      }

      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        qs.stringify(payload),
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data; // { access_token, refresh_token, expires_in }
    } catch (error: any) {
      console.error('Spotify Auth Error:', error.response?.data || error.message);
      throw new Error('Failed to exchange Spotify code');
    }
  }

  static async refreshToken(refreshToken: string) {
    const authHeader = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString('base64');

    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        qs.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Spotify Refresh Error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Spotify token');
    }
  }
}
