const smartMatchingEngine = require('../services/SmartMatchingEngine');

describe('SmartMatchingEngine render simulation', () => {
  const originalRender = process.env.RENDER;

  afterEach(() => {
    process.env.RENDER = originalRender;
    jest.restoreAllMocks();
  });

  test('generateImageEmbedding returns a mock vector only when RENDER is true', async () => {
    process.env.RENDER = 'TRUE';
    jest.spyOn(console, 'log').mockImplementation(() => {});

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
});
