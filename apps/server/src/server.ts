import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
import { setupGateway } from './socket/gateway/connection';

dotenv.config();

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Initialize real-time infrastructure
connectRedis()
  .then(() => {
    startServer();
  })
  .catch((error) => {
    console.error('Failed to initialize Redis:', error);
    if (process.env.NODE_ENV === 'development') {
      console.warn('Proceeding with limited functionality (Dev Mode)');
      startServer();
    }
  });

function startServer() {
  setupGateway(io);
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
