import { Server, Socket } from 'socket.io';
import { validateSocketConnection } from '../validation/auth';
import { registerSyncHandlers } from '../handlers/sync.handler';

export const setupGateway = (io: Server) => {
  // 1. Connection-level Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const user = await validateSocketConnection(token);
      
      // Attach user to socket data for downstream access
      socket.data.user = user;
      next();
    } catch (error: any) {
      next(new Error(`Authentication failed: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    console.log(`[Gateway] Authenticated user connected: ${userId} (${socket.id})`);

    // 2. Register modular handlers
    registerSyncHandlers(socket);

    // 3. Generic Disconnect Handler
    socket.on('disconnect', (reason) => {
      console.log(`[Gateway] User disconnected: ${userId} (${socket.id}). Reason: ${reason}`);
      // TODO: Handle presence state cleanup via Redis
    });
  });
};
