import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as authController from './modules/auth/auth.controller';

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth Routes
app.get('/auth/spotify', authController.loginWithSpotify);
app.get('/auth/callback', authController.spotifyCallback);
app.get('/auth/dev-login', authController.devLogin);
app.post('/auth/logout', authController.logout);

export default app;
