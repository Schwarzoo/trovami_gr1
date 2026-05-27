const jwt = require('jsonwebtoken');

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function createRes() {
    return {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    };
  }

  test('401 when missing Bearer token', async () => {
    const { authMiddleware } = require('../middleware/auth');
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token mancante');
    expect(next).not.toHaveBeenCalled();
  });

  test('401 when token invalid', async () => {
    const { authMiddleware } = require('../middleware/auth');
    const req = { headers: { authorization: 'Bearer not-a-jwt' } };
    const res = createRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token non valido');
    expect(next).not.toHaveBeenCalled();
  });

  test('200 when token valid and session matches', async () => {
    const mockUser = {
      _id: 'user1',
      sessionToken: 'tok',
      isActive: true
    };

    jest.doMock(require.resolve('../models/User'), () => ({
      findById: jest.fn(async () => mockUser)
    }));

    const { authMiddleware } = require('../middleware/auth');
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();
    const token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
    mockUser.sessionToken = token;
    req.headers.authorization = `Bearer ${token}`;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ userId: 'user1', role: 'user' });
  });
});
