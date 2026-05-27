const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn()
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

describe('admin endpoints', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    token = jwt.sign({ userId: 'admin1', role: 'admin' }, process.env.JWT_SECRET);
    mockUserModel.findById.mockResolvedValue({
      _id: 'admin1',
      sessionToken: token,
      isActive: true
    });
  });

  test('GET /api/v1/admin/rifugi/pending returns pending shelters', async () => {
    mockUserModel.find.mockReturnValue(
      makeQuery([
        makeDoc({
          _id: 'rif1',
          username: 'rifugio',
          rifugioStatus: 'pending'
        })
      ])
    );

    const res = await request(app)
      .get('/api/v1/admin/rifugi/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].rifugioStatus).toBe('pending');
  });

  test('PATCH /api/v1/admin/rifugi/:id/status approves shelter', async () => {
    mockUserModel.findOneAndUpdate.mockReturnValue({
      select: jest.fn(() => Promise.resolve(makeDoc({
        _id: 'rif1',
        role: 'shelter',
        rifugioStatus: 'approved'
      })))
    });

    const res = await request(app)
      .patch('/api/v1/admin/rifugi/507f1f77bcf86cd799439011/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ rifugioStatus: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.rifugioStatus).toBe('approved');
  });

  test('PATCH /api/v1/admin/users/:id/status rejects invalid payload', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/507f1f77bcf86cd799439011/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'unknown' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Status utente non valido/);
  });
});

