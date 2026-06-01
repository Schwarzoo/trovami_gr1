const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn()
};

const mockNotificationModel = {
  create: jest.fn()
};

const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/Notification', () => mockNotificationModel);
jest.mock('../services/auditService', () => ({
  writeAuditLog: (...args) => mockWriteAuditLog(...args)
}));

const { createApp } = require('./helpers/createApp');

describe('auth endpoints', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  test('POST /api/v1/auth/users creates user', async () => {
    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockResolvedValue(makeDoc({
      _id: 'user1',
      role: 'user',
      rifugioStatus: 'none'
    }));

    const res = await request(app)
      .post('/api/v1/auth/users')
      .send({
        username: 'mario',
        email: 'mario@test.local',
        password: 'password123',
        phoneNumber: '123'
      });

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.role).toBe('user');
    expect(mockUserModel.create).toHaveBeenCalledTimes(1);
  });

  test('POST /api/v1/auth/sessions logs in', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    mockUserModel.findOne.mockResolvedValue(makeDoc({
      _id: 'user1',
      passwordHash,
      isActive: true,
      isEmailVerified: true,
      role: 'user',
      save: jest.fn().mockResolvedValue(undefined)
    }));

    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'mario@test.local', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.token).toBeDefined();
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).userId).toBe('user1');
  });

  test('DELETE /api/v1/auth/sessions/current logs out', async () => {
    const token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
    mockUserModel.findById.mockResolvedValue(makeDoc({
      _id: 'user1',
      isActive: true
    }));

    const res = await request(app)
      .delete('/api/v1/auth/sessions/current')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toBe('Logout effettuato');
    expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('POST /api/v1/auth/readmission-requests stores request', async () => {
    mockUserModel.findOne.mockResolvedValue(makeDoc({
      _id: 'user1',
      username: 'mario',
      email: 'mario@test.local',
      isActive: false,
      role: 'user',
      save: jest.fn().mockResolvedValue(undefined)
    }));
    mockUserModel.find.mockReturnValue(makeQuery([{ _id: 'admin1' }]));

    const res = await request(app)
      .post('/api/v1/auth/readmission-requests')
      .send({
        email: 'mario@test.local',
        message: 'Voglio rientrare'
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toMatch(/riammissione inviata/);
  });

  test('POST /api/v1/auth/password-reset-requests starts reset flow', async () => {
    mockUserModel.findOne.mockResolvedValue(makeDoc({
      _id: 'user1',
      email: 'mario@test.local',
      save: jest.fn().mockResolvedValue(undefined)
    }));

    const res = await request(app)
      .post('/api/v1/auth/password-reset-requests')
      .send({ email: 'mario@test.local' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toMatch(/recupero inviata/);
  });

  test('PATCH /api/v1/auth/password updates password', async () => {
    mockUserModel.findOne.mockResolvedValue(makeDoc({
      _id: 'user1',
      save: jest.fn().mockResolvedValue(undefined)
    }));

    const res = await request(app)
      .patch('/api/v1/auth/password')
      .send({ token: 'reset-token', newPassword: 'password123' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toMatch(/Password aggiornata/);
  });

  test('GET /api/v1/auth/email-verifications rejects missing token in json mode', async () => {
    const res = await request(app)
      .get('/api/v1/auth/email-verifications')
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toBe('Token mancante');
  });

  test('POST /api/v1/auth/email-verifications resends token', async () => {
    mockUserModel.findOne.mockResolvedValue(makeDoc({
      _id: 'user1',
      email: 'mario@test.local',
      isEmailVerified: false,
      save: jest.fn().mockResolvedValue(undefined)
    }));

    const res = await request(app)
      .post('/api/v1/auth/email-verifications')
      .send({ email: 'mario@test.local' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toMatch(/reinviata/);
  });
});
