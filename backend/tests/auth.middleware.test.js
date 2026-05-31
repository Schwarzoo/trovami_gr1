const jwt = require('jsonwebtoken');

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  /**
   * Creates a minimal chainable Express response mock for middleware tests.
   * @returns {{statusCode: number|null, body: Object|null, status: Function, json: Function}} Response mock.
   */
  function createRes() {
    return {
      statusCode: null,
      body: null,
      /**
       * Stores the HTTP status code and preserves Express-style chaining.
       * @param {number} code - HTTP status code set by the middleware.
       * @returns {Object} This response mock.
       */
      status(code) {
        this.statusCode = code;
        return this;
      },
      /**
       * Stores the JSON response body and preserves Express-style chaining.
       * @param {Object} payload - JSON body sent by the middleware.
       * @returns {Object} This response mock.
       */
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
      isActive: true,
      role: 'user'
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

  test('uses current database role instead of stale token role', async () => {
    const mockUser = {
      _id: 'user1',
      sessionToken: 'tok',
      isActive: true,
      role: 'shelter'
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
    expect(req.user).toEqual({ userId: 'user1', role: 'shelter' });
  });
});
