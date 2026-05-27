const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn()
};

const mockNotificationModel = {
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn()
};

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/Notification', () => mockNotificationModel);

const { createApp } = require('./helpers/createApp');

describe('notification endpoints', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      sessionToken: token,
      isActive: true
    });
  });

  test('GET /api/v1/notifications returns notifications', async () => {
    mockNotificationModel.find.mockReturnValue(
      makeQuery([
        makeDoc({
          _id: 'n1',
          message: 'hello',
          isRead: false
        })
      ])
    );

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].message).toBe('hello');
  });

  test('PATCH /api/v1/notifications marks all read', async () => {
    mockNotificationModel.updateMany.mockResolvedValue({ modifiedCount: 3 });

    const res = await request(app)
      .patch('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.modified).toBe(3);
  });

  test('PATCH /api/v1/notifications/:id marks one read', async () => {
    mockNotificationModel.findOneAndUpdate.mockResolvedValue(makeDoc({
      _id: '507f1f77bcf86cd799439011',
      isRead: true
    }));

    const res = await request(app)
      .patch('/api/v1/notifications/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isRead).toBe(true);
  });
});

