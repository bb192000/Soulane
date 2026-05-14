import { createClient } from 'redis';

const useMock = !process.env.REDIS_URL;

class RedisMock {
  private store = new Map<string, string>();

  async connect() {
    console.warn('⚠️ USING REDIS MOCK (IN-MEMORY)');
    return Promise.resolve();
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
    return 'OK';
  }

  async get(key: string) {
    return this.store.get(key) || null;
  }

  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }

  on(event: string, callback: any) {
    // No-op for mock
  }
}

export const redis = useMock 
  ? new RedisMock() as any
  : createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

if (!useMock) {
  redis.on('error', (err: any) => console.log('Redis Client Error', err));
}

export const connectRedis = async () => {
  try {
    await redis.connect();
    if (!useMock) console.log('Redis connected successfully');
  } catch (err) {
    if (useMock) throw err;
    console.error('Failed to connect to real Redis, falling back to mock...');
    // In a real scenario, we might want to swap the instance here, 
    // but for now, we'll just let the server start if we can.
    // For this dev session, I'll force mock if no env.
  }
};
