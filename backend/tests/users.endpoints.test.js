const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  find: jest.fn()
};

const mockAnnouncementModel = {
  find: jest.fn()
};

const mockRemoveAnnouncementCascade = jest.fn().mockResolvedValue(true);
const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/Announcement', () => mockAnnouncementModel);
jest.mock('../controllers/announcementController', () => ({
  removeAnnouncementCascade: (...args) => mockRemoveAnnouncementCascade(...args)
}));
jest.mock('../services/auditService', () => ({
  writeAuditLog: (...args) => mockWriteAuditLog(...args)
}));

const userRoutes = require('../routes/userRoutes');

describe('users endpoints', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/v1/users', userRoutes);
    token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
  });

  test('GET /api/v1/users/me returns profile', async () => {
    mockUserModel.findById
      .mockResolvedValueOnce({
        _id: 'user1',
        isActive: true
      })
      .mockImplementationOnce(() => ({
        select: jest.fn(() => Promise.resolve(makeDoc({
          _id: 'user1',
          username: 'mario'
        })))
      }));

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('mario');
  });

  test('PUT /api/v1/users/me updates profile', async () => {
    mockUserModel.findById
      .mockResolvedValueOnce({
        _id: 'user1',
        isActive: true
      })
      .mockResolvedValueOnce({
        set: jest.fn(),
        save: jest.fn().mockResolvedValue({
          toObject: () => ({
            _id: 'user1',
            username: 'luigi'
          })
        })
      });

    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'luigi' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('luigi');
  });

  test('GET /api/v1/users/rifugi?isPublic=true returns shelters', async () => {
    mockUserModel.find.mockReturnValue(
      makeQuery([
        makeDoc({
          _id: 'rif1',
          username: 'rifugio',
          email: 'shelter@test.local',
          phoneNumber: '123',
          rifugioData: { rifugioName: 'Rifugio Uno' },
          contactVisibility: { showEmail: true, showPhone: true }
        })
      ])
    );

    const res = await request(app).get('/api/v1/users/rifugi?isPublic=true');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].rifugioData.rifugioName).toBe('Rifugio Uno');
  });

  test('GET /api/v1/users/:id/public returns masked user', async () => {
    mockUserModel.findById
      .mockResolvedValueOnce({
        _id: 'user1',
        isActive: true
      })
      .mockReturnValueOnce({
        select: jest.fn(() => Promise.resolve(makeDoc({
          _id: 'user2',
          username: 'anna',
          email: 'anna@test.local',
          phoneNumber: '987',
          contactVisibility: { showEmail: false, showPhone: true }
        })))
      });

    const res = await request(app)
      .get('/api/v1/users/user2/public')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBeNull();
    expect(res.body.phoneNumber).toBe('987');
  });

  test('DELETE /api/v1/users/me deletes account', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      isActive: true
    });
    mockAnnouncementModel.find.mockReturnValue(makeQuery([
      { _id: 'ann1' }
    ]));
    mockUserModel.findByIdAndDelete.mockReturnValue({
      select: jest.fn(() => Promise.resolve({ username: 'mario' }))
    });

    const res = await request(app)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRemoveAnnouncementCascade).toHaveBeenCalled();
  });
});
