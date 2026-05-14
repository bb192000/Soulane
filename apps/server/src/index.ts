import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/auth', authRoutes);

// Socket.io Handlers
import { registerSocketHandlers } from './socket/handlers';
registerSocketHandlers(io);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'Soulane Backend' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   Soulane Backend — Phase 9 Active   ║
  ║   Security Gate: LOCKED              ║
  ║   Listening on: http://localhost:${PORT} ║
  ╚══════════════════════════════════════╝
  `);
});
