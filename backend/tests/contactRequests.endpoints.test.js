const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn()
};

const mockAnimalModel = {
  findById: jest.fn()
};

const mockContactRequestModel = {
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  updateMany: jest.fn()
};

const mockNotificationModel = {
  create: jest.fn()
};

const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/Animal', () => mockAnimalModel);
jest.mock('../models/ContactRequest', () => mockContactRequestModel);
jest.mock('../models/Notification', () => mockNotificationModel);
jest.mock('../services/auditService', () => ({
  writeAuditLog: (...args) => mockWriteAuditLog(...args)
}));

const { createApp } = require('./helpers/createApp');

describe('contact request endpoints', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  test('POST /api/v1/contact-requests creates request', async () => {
    const token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
    mockUserModel.findById
      .mockResolvedValueOnce({
        _id: 'user1',
        isActive: true
      })
      .mockReturnValueOnce({
        select: jest.fn(() => Promise.resolve({
          _id: 'user1',
          username: 'mario',
          email: 'mario@test.local',
          phoneNumber: '123',
          role: 'user'
        }))
      });
    mockAnimalModel.findById.mockReturnValue({
      populate: jest.fn(() => Promise.resolve({
        _id: 'animal1',
        name: 'Milo',
        shelterId: {
          _id: 'shelter1',
          role: 'shelter',
          rifugioStatus: 'approved'
        }
      }))
    });
    mockContactRequestModel.create.mockResolvedValue({ _id: 'req1' });
    mockContactRequestModel.findById.mockReturnValue(makeQuery({
      _id: 'req1',
      requesterId: { _id: 'user1' }
    }));

    const res = await request(app)
      .post('/api/v1/contact-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ animalId: '507f1f77bcf86cd799439011', message: 'voglio info' });

    expect(res.status).toBe(201);
    expect(res.body._id).toBe('req1');
  });

  test('GET /api/v1/contact-requests returns list', async () => {
    const token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
    mockUserModel.findById
      .mockResolvedValueOnce({
        _id: 'user1',
        isActive: true
      })
      .mockReturnValueOnce({
        select: jest.fn(() => Promise.resolve({
          _id: 'user1',
          role: 'user',
          rifugioStatus: 'none'
        }))
      });
    mockContactRequestModel.find.mockReturnValue(
      makeQuery([
        makeDoc({ _id: 'req1', message: 'hello' })
      ])
    );

    const res = await request(app)
      .get('/api/v1/contact-requests')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].message).toBe('hello');
  });

  test('PATCH /api/v1/contact-requests hides replied requests', async () => {
    const token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
    mockUserModel.findById
      .mockResolvedValueOnce({
        _id: 'user1',
        isActive: true
      })
      .mockReturnValueOnce({
        select: jest.fn(() => Promise.resolve({
          _id: 'user1',
          role: 'user'
        }))
      });
    mockContactRequestModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const res = await request(app)
      .patch('/api/v1/contact-requests')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.hidden).toBe(2);
  });

  test('POST /api/v1/contact-requests/:id/replies stores reply', async () => {
    const token = jwt.sign({ userId: 'shelter1', role: 'shelter' }, process.env.JWT_SECRET);
    mockUserModel.findById
      .mockResolvedValueOnce({
        _id: 'shelter1',
        isActive: true
      })
      .mockReturnValueOnce({
        select: jest.fn(() => Promise.resolve({
          _id: 'shelter1',
          username: 'rifugio',
          role: 'shelter',
          rifugioStatus: 'approved'
        }))
      });
    mockContactRequestModel.findById.mockReturnValue(
      makeQuery({
        _id: 'req1',
        shelterId: { _id: 'shelter1' },
        requesterId: { _id: 'user1' },
        save: jest.fn().mockResolvedValue(undefined)
      })
    );

    const res = await request(app)
      .post('/api/v1/contact-requests/507f1f77bcf86cd799439011/replies')
      .set('Authorization', `Bearer ${token}`)
      .send({ replyMessage: 'ok' });

    expect(res.status).toBe(200);
    expect(res.body._id).toBe('req1');
  });
});

