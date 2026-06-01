const express = require('express');
const request = require('supertest');

/**
 * Builds a minimal Express app that mounts only auth routes for registration tests.
 * @returns {import('express').Express} Express application configured for auth endpoint tests.
 */
function buildAuthApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', require('../routes/authRoutes'));
  return app;
}

describe('POST /api/v1/auth/users', () => {
  test('400 when password too short', async () => {
    const app = buildAuthApp();

    const res = await request(app)
      .post('/api/v1/auth/users')
      .send({ username: 'u', email: 'u@test.local', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ message: 'Password deve avere almeno 8 caratteri' });
  });
});

