const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn()
};

const mockAnnouncementModel = {
  findOne: jest.fn()
};

const mockAnimalModel = jest.fn().mockImplementation(function (data) {
  Object.assign(this, data);
  this.save = jest.fn().mockResolvedValue(this);
});

mockAnimalModel.find = jest.fn();
mockAnimalModel.findById = jest.fn();
mockAnimalModel.findByIdAndUpdate = jest.fn();
mockAnimalModel.findByIdAndDelete = jest.fn();
mockAnimalModel.create = jest.fn();

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/Animal', () => mockAnimalModel);
jest.mock('../models/Announcement', () => mockAnnouncementModel);

const { createApp } = require('./helpers/createApp');

describe('animal endpoints', () => {
  let app;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    token = jwt.sign({ userId: 'user1', role: 'user' }, process.env.JWT_SECRET);
  });

  test('POST /api/v1/animals creates animal', async () => {
    const res = await request(app)
      .post('/api/v1/animals')
      .send({
        name: 'Milo',
        species: 'Dog',
        breed: 'Maremmano',
        color: 'White'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Milo');
  });

  test('GET /api/v1/animals returns filtered list', async () => {
    mockAnimalModel.find.mockReturnValue(
      makeQuery([
        makeDoc({
          _id: 'animal1',
          name: 'Milo',
          photos: ['http://localhost/photo.jpg']
        })
      ])
    );

    const res = await request(app)
      .get('/api/v1/animals')
      .query({ shelterId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Milo');
  });

  test('GET /api/v1/animals/:id returns animal', async () => {
    mockAnimalModel.findById.mockResolvedValue(makeDoc({
      _id: '507f1f77bcf86cd799439011',
      name: 'Milo'
    }));

    const res = await request(app).get('/api/v1/animals/507f1f77bcf86cd799439011');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Milo');
  });

  test('PUT /api/v1/animals/:id updates animal', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      sessionToken: token,
      isActive: true
    });
    mockAnimalModel.findByIdAndUpdate.mockResolvedValue(makeDoc({
      _id: '507f1f77bcf86cd799439011',
      name: 'Milo 2'
    }));

    const res = await request(app)
      .put('/api/v1/animals/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Milo 2' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Milo 2');
  });

  test('DELETE /api/v1/animals/:id deletes animal', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      sessionToken: token,
      isActive: true
    });
    mockAnimalModel.findByIdAndDelete.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011'
    });

    const res = await request(app)
      .delete('/api/v1/animals/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/eliminato/);
  });
});

