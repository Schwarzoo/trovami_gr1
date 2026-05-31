const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn(),
  find: jest.fn()
};

const mockAnimalModel = {
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn()
};

const mockReportModel = {
  create: jest.fn()
};

const mockNotificationModel = {
  create: jest.fn()
};

const mockSmartMatchingEngine = {
  findMatches: jest.fn(),
  generateImageEmbedding: jest.fn()
};

const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);

const mockAnnouncementModel = jest.fn().mockImplementation(function (data) {
  Object.assign(this, data);
  this.save = jest.fn().mockResolvedValue(this);
  this.toObject = jest.fn(() => ({ ...data, _id: this._id || 'ann-new' }));
});

mockAnnouncementModel.find = jest.fn();
mockAnnouncementModel.findById = jest.fn();
mockAnnouncementModel.findByIdAndUpdate = jest.fn();
mockAnnouncementModel.findByIdAndDelete = jest.fn();
mockAnnouncementModel.countDocuments = jest.fn();

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/Animal', () => mockAnimalModel);
jest.mock('../models/Report', () => mockReportModel);
jest.mock('../models/Notification', () => mockNotificationModel);
jest.mock('../models/Announcement', () => mockAnnouncementModel);
jest.mock('../services/SmartMatchingEngine', () => mockSmartMatchingEngine);
jest.mock('../services/auditService', () => ({
  writeAuditLog: (...args) => mockWriteAuditLog(...args)
}));

const { createApp } = require('./helpers/createApp');

describe('announcement endpoints', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
  });

  test('GET /api/v1/announcements returns list', async () => {
    mockAnnouncementModel.find.mockReturnValue(
      makeQuery([
        makeDoc({
          _id: 'ann1',
          title: 'Test',
          publisherId: { _id: 'user1', username: 'mario', contactVisibility: {} }
        })
      ])
    );

    const res = await request(app).get('/api/v1/announcements');

    expect(res.status).toBe(200);
    expect(res.body[0]._id).toBe('ann1');
  });

  test('GET /api/v1/announcements/:id returns one announcement', async () => {
    mockAnnouncementModel.findById.mockReturnValue({
      select: jest.fn(() => ({
        populate: jest.fn(() => ({
          populate: jest.fn(() => Promise.resolve(makeDoc({
            _id: 'ann1',
            publisherId: { _id: 'user1', username: 'mario', contactVisibility: {} }
          })))
        }))
      }))
    });

    const res = await request(app).get('/api/v1/announcements/507f1f77bcf86cd799439011');

    expect(res.status).toBe(200);
    expect(res.body._id).toBe('ann1');
  });

  test('GET /api/v1/announcements/:id/similar returns matches', async () => {
    mockAnnouncementModel.findById.mockReturnValue({
      select: jest.fn(() => ({
        populate: jest.fn(() => Promise.resolve({
          _id: 'ann1',
          imageEmbedding: [1, 2],
          animalId: { species: 'Dog' },
          status: 'ACTIVE'
        }))
      }))
    });
    mockSmartMatchingEngine.findMatches.mockResolvedValue([
      {
        score: 0.91,
        announcement: makeDoc({
          _id: 'ann2',
          publisherId: { _id: 'user2', username: 'anna', contactVisibility: {} }
        })
      }
    ]);

    const res = await request(app).get('/api/v1/announcements/507f1f77bcf86cd799439011/similar');

    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
  });

  test('POST /api/v1/announcements with isQuick creates quick announcement', async () => {
    mockAnimalModel.create.mockResolvedValue(makeDoc({ _id: 'animal1' }));

    const res = await request(app)
      .post('/api/v1/announcements')
      .send({
        isQuick: true,
        species: 'Dog',
        color: 'Brown',
        coordinates: [12.5, 41.9]
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
  });

  test('POST /api/v1/announcements/:id/reports creates report', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      sessionToken: token,
      isActive: true
    });
    mockAnnouncementModel.findById.mockReturnValue({
      populate: jest.fn(() => Promise.resolve({
        _id: 'ann1',
        publisherId: { _id: 'publisher1', username: 'owner', role: 'user', rifugioData: {} }
      }))
    });
    mockReportModel.create.mockResolvedValue({ _id: 'report1' });
    mockUserModel.find.mockReturnValue(makeQuery([{ _id: 'admin1' }]));

    const res = await request(app)
      .post('/api/v1/announcements/507f1f77bcf86cd799439011/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'altro', details: 'test' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Segnalazione inviata/);
  });
});

