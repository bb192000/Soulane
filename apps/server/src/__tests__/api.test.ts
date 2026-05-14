import request from 'supertest';
// We'll need to export the app from index.ts or create a separate app.ts
// For now, I'll mock a request to the running server or use the express app instance
// Since I'm in the 'Junior Tester' role, I'll start with a simple health check.

const API_URL = 'http://localhost:3001';

describe('Soulane API Health', () => {
  it('should return 200 OK from /health', async () => {
    const res = await request(API_URL).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should return 404 for non-existent room', async () => {
    const res = await request(API_URL).get('/rooms/NONEXISTENT');
    expect(res.status).toBe(404);
  });
});
