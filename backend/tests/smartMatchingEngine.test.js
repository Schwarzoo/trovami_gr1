const smartMatchingEngine = require('../services/SmartMatchingEngine');
const Announcement = require('../models/Announcement');
const Animal = require('../models/Animal');

describe('SmartMatchingEngine render simulation', () => {
  const originalRender = process.env.RENDER;

  afterEach(() => {
    process.env.RENDER = originalRender;
    jest.restoreAllMocks();
  });

  test('generateImageEmbedding returns a mock vector only when RENDER is true', async () => {
    process.env.RENDER = 'TRUE';

    const result = await smartMatchingEngine.generateImageEmbedding(Buffer.from('unused'));

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(512);
    expect(result.every((value) => typeof value === 'number')).toBe(true);
  });

  test('calculateCosineSimilarity returns 1 for identical vectors', () => {
    expect(smartMatchingEngine.calculateCosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  test('calculateCosineSimilarity returns 0 for incompatible or zero vectors', () => {
    expect(smartMatchingEngine.calculateCosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(smartMatchingEngine.calculateCosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  test('findMatches skips database queries when the announcement has no embedding', async () => {
    const animalFindSpy = jest.spyOn(Animal, 'find');
    const announcementFindSpy = jest.spyOn(Announcement, 'find');

    await expect(
      smartMatchingEngine.findMatches({ type: 'LostAnimal' }, 'Cane')
    ).resolves.toEqual([]);

    expect(animalFindSpy).not.toHaveBeenCalled();
    expect(announcementFindSpy).not.toHaveBeenCalled();
  });

  test('findMatches filters below-threshold candidates and sorts best matches first', async () => {
    const animalSelect = jest.fn().mockResolvedValue([
      { _id: 'animal1' },
      { _id: 'animal2' }
    ]);
    jest.spyOn(Animal, 'find').mockReturnValue({ select: animalSelect });

    const candidates = [
      { _id: 'medium', imageEmbedding: [0.9, 0.1] },
      { _id: 'low', imageEmbedding: [0, 1] },
      { _id: 'best', imageEmbedding: [1, 0] }
    ];
    const populateAnimal = jest.fn().mockResolvedValue(candidates);
    const populatePublisher = jest.fn(() => ({ populate: populateAnimal }));
    const selectCandidates = jest.fn(() => ({ populate: populatePublisher }));
    const announcementFindSpy = jest.spyOn(Announcement, 'find').mockReturnValue({
      select: selectCandidates
    });

    const matches = await smartMatchingEngine.findMatches({
      type: 'LostAnimal',
      imageEmbedding: [1, 0]
    }, 'Cane');

    expect(Animal.find).toHaveBeenCalledWith({
      species: { $regex: /^Cane$/i }
    });
    expect(animalSelect).toHaveBeenCalledWith('_id');
    expect(announcementFindSpy).toHaveBeenCalledWith({
      type: 'Sighting',
      status: 'ACTIVE',
      animalId: { $in: ['animal1', 'animal2'] },
      imageEmbedding: { $ne: null }
    });
    expect(matches.map((match) => match.announcement._id)).toEqual(['best', 'medium']);
    expect(matches.every((match) => match.score >= 0.8)).toBe(true);
  });
});
