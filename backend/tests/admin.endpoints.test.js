const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn()
};

const mockAuditLogModel = {
  find: jest.fn()
};

const mockReportModel = {
  findByIdAndUpdate: jest.fn()
};

const mockNotificationModel = {
  create: jest.fn()
};

const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);
const mockBuildAuditQuery = jest.fn(() => ({
  filter: { action: 'login' },
  sort: { createdAt: -1 },
  limit: 25
}));

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/AuditLog', () => mockAuditLogModel);
jest.mock('../models/Report', () => mockReportModel);
jest.mock('../models/Notification', () => mockNotificationModel);
jest.mock('../services/auditService', () => ({
  buildAuditQuery: (...args) => mockBuildAuditQuery(...args),
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
      isActive: true,
      role: 'admin'
    });
  });

  test('GET /api/v1/admin/rifugi?status=pending returns pending shelters', async () => {
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
      .get('/api/v1/admin/rifugi?status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body[0].rifugioStatus).toBe('pending');
  });

  test('PATCH /api/v1/admin/rifugi/:id approves shelter', async () => {
    mockUserModel.findOneAndUpdate.mockReturnValue({
      select: jest.fn(() => Promise.resolve(makeDoc({
        _id: 'rif1',
        role: 'shelter',
        rifugioStatus: 'approved'
      })))
    });

    const res = await request(app)
      .patch('/api/v1/admin/rifugi/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`)
      .send({ rifugioStatus: 'approved' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.rifugioStatus).toBe('approved');
  });

  test('PATCH /api/v1/admin/users/:id rejects invalid payload', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'unknown' });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toMatch(/Status utente non valido/);
  });

  test('GET /api/v1/admin/audit-logs applies normalized audit query', async () => {
    const query = makeQuery([{ _id: 'audit1', action: 'login' }]);
    mockAuditLogModel.find.mockReturnValue(query);

    const res = await request(app)
      .get('/api/v1/admin/audit-logs?action=login&limit=25')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockBuildAuditQuery).toHaveBeenCalledWith(expect.objectContaining({
      action: 'login',
      limit: '25'
    }));
    expect(mockAuditLogModel.find).toHaveBeenCalledWith({ action: 'login' });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(res.body[0].action).toBe('login');
  });

  test('PATCH /api/v1/admin/reports/:id dismisses report and writes audit', async () => {
    mockReportModel.findByIdAndUpdate.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      status: 'DISMISSED'
    });

    const res = await request(app)
      .patch('/api/v1/admin/reports/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DISMISSED' });

    expect(res.status).toBe(200);
    expect(mockReportModel.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { status: 'DISMISSED' },
      { new: true }
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      actor: 'admin1',
      action: 'archiviato report',
      target: null
    });
  });
});

