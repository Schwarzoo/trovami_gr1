const jwt = require('jsonwebtoken');
const request = require('supertest');
const { makeQuery, makeDoc } = require('./helpers/chain');

const mockUserModel = {
  findById: jest.fn()
};

const mockAnnouncementModel = {
  findOne: jest.fn(),
  deleteMany: jest.fn()
};

const mockAnimalModel = jest.fn().mockImplementation(function (data) {
  this._id = '507f1f77bcf86cd799439011';
  Object.assign(this, data);
  this.save = jest.fn().mockResolvedValue(this);
  this.toObject = jest.fn(() => ({ ...this }));
});

mockAnimalModel.find = jest.fn();
mockAnimalModel.findById = jest.fn();
mockAnimalModel.findByIdAndUpdate = jest.fn();
mockAnimalModel.findByIdAndDelete = jest.fn();
mockAnimalModel.countDocuments = jest.fn();
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
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      isActive: true,
      role: 'user'
    });

    const res = await request(app)
      .post('/api/v1/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Milo',
        species: 'Dog',
        breed: 'Maremmano',
        color: 'White',
        adoptable: true
      });

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.name).toBe('Milo');
    expect(res.body.adoptable).toBe(false);
  });

  test('POST /api/v1/animals lets shelters set adoptable', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'shelter1',
      isActive: true,
      role: 'shelter'
    });

    const res = await request(app)
      .post('/api/v1/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Luna',
        species: 'Cat',
        breed: 'Europeo',
        color: 'Black',
        adoptable: true
      });

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.adoptable).toBe(true);
  });

  test('POST /api/v1/animals stores uploaded photo in the animal document when provided', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'shelter1',
      isActive: true,
      role: 'shelter'
    });

    const res = await request(app)
      .post('/api/v1/animals')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Luna')
      .field('species', 'Cat')
      .field('breed', 'Europeo')
      .field('gender', 'Femmina')
      .field('color', 'Black')
      .attach('photo', Buffer.from('fake-image'), 'luna.jpg');

    expect(res.status).toBe(201);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0]).toBe('/api/v1/animals/507f1f77bcf86cd799439011/photo');
    const savedAnimal = mockAnimalModel.mock.instances[0];
    expect(savedAnimal.photo.contentType).toBe('image/jpeg');
    expect(Buffer.isBuffer(savedAnimal.photo.data)).toBe(true);
  });

  test('POST /api/v1/animals returns standardized error body on persistence failure', async () => {
    mockAnimalModel.mockImplementationOnce(function () {
      this.save = jest.fn().mockRejectedValue(new Error('database down'));
    });

    const res = await request(app)
      .post('/api/v1/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Milo',
        species: 'Dog'
      });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      developerMessage: 'database down',
      userMessage: 'Errore nella creazione',
      errorCode: 'ANIMAL_CREATE_ERROR'
    });
  });

  test('GET /api/v1/animals returns filtered list', async () => {
    const query = makeQuery([
      makeDoc({
        _id: 'animal1',
        name: 'Milo',
        photos: ['http://localhost/photo.jpg']
      })
    ]);
    mockAnimalModel.find.mockReturnValue(query);
    mockAnimalModel.countDocuments.mockResolvedValue(12);

    const res = await request(app)
      .get('/api/v1/animals')
      .query({ shelterId: '507f1f77bcf86cd799439011', page: 2, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.meta).toEqual({
      totalItems: 12,
      totalPages: 3,
      currentPage: 2
    });
    expect(query.skip).toHaveBeenCalledWith(5);
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(query.select).toHaveBeenCalledWith('-imageEmbedding -__v -photo.data');
    expect(res.body.data[0].name).toBe('Milo');
  });

  test('GET /api/v1/animals returns database photo URLs without binary data', async () => {
    const query = makeQuery([
      makeDoc({
        _id: '507f1f77bcf86cd799439011',
        name: 'Luna',
        photo: { contentType: 'image/png' },
        photos: []
      })
    ]);
    mockAnimalModel.find.mockReturnValue(query);
    mockAnimalModel.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/animals')
      .query({ shelterId: '507f1f77bcf86cd799439012' });

    expect(res.status).toBe(200);
    expect(res.body.data[0].photo).toBeUndefined();
    expect(res.body.data[0].photos[0]).toBe('/api/v1/animals/507f1f77bcf86cd799439011/photo');
  });

  test('GET /api/v1/animals normalizes legacy absolute API photo URLs', async () => {
    const query = makeQuery([
      makeDoc({
        _id: '507f1f77bcf86cd799439011',
        name: 'Milo',
        photos: ['http://trovami-app.onrender.com/api/v1/announcements/507f1f77bcf86cd799439012/photo']
      })
    ]);
    mockAnimalModel.find.mockReturnValue(query);
    mockAnimalModel.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/animals')
      .query({ shelterId: '507f1f77bcf86cd799439012' });

    expect(res.status).toBe(200);
    expect(res.body.data[0].photos).toEqual([
      '/api/v1/announcements/507f1f77bcf86cd799439012/photo'
    ]);
  });

  test('GET /api/v1/animals/:id returns animal', async () => {
    const select = jest.fn(() => Promise.resolve(makeDoc({
      _id: '507f1f77bcf86cd799439011',
      name: 'Milo'
    })));
    mockAnimalModel.findById.mockReturnValue({ select });

    const res = await request(app).get('/api/v1/animals/507f1f77bcf86cd799439011');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(select).toHaveBeenCalledWith('-imageEmbedding -__v -photo.data');
    expect(res.body.name).toBe('Milo');
  });

  test('GET /api/v1/animals/:id/photo returns animal photo bytes', async () => {
    const photo = Buffer.from('fake-image');
    const select = jest.fn(() => Promise.resolve(makeDoc({
      _id: '507f1f77bcf86cd799439011',
      photo: {
        data: photo,
        contentType: 'image/png'
      }
    })));
    mockAnimalModel.findById.mockReturnValue({ select });

    const res = await request(app).get('/api/v1/animals/507f1f77bcf86cd799439011/photo');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.body).toEqual(photo);
    expect(select).toHaveBeenCalledWith('+photo.data photo.contentType');
  });

  test('PUT /api/v1/animals/:id updates animal', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
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
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.name).toBe('Milo 2');
  });

  test('DELETE /api/v1/animals/:id deletes animal', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      isActive: true
    });
    const select = jest.fn(() => Promise.resolve(makeDoc({
      _id: '507f1f77bcf86cd799439011',
      shelterId: 'user1'
    })));
    mockAnimalModel.findById.mockReturnValue({ select });
    mockAnimalModel.findByIdAndDelete.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011'
    });
    mockAnnouncementModel.deleteMany.mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .delete('/api/v1/animals/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toMatch(/eliminato/);
    expect(select).toHaveBeenCalledWith('shelterId');
    expect(mockAnnouncementModel.deleteMany).toHaveBeenCalledWith({
      animalId: '507f1f77bcf86cd799439011'
    });
  });

  test('DELETE /api/v1/animals/:id rejects non-owner users', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'user1',
      isActive: true
    });
    const select = jest.fn(() => Promise.resolve(makeDoc({
      _id: '507f1f77bcf86cd799439011',
      shelterId: 'another-user'
    })));
    mockAnimalModel.findById.mockReturnValue({ select });

    const res = await request(app)
      .delete('/api/v1/animals/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(mockAnimalModel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(mockAnnouncementModel.deleteMany).not.toHaveBeenCalled();
  });
});

