const smartMatchingEngine = require('../services/SmartMatchingEngine');

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
});