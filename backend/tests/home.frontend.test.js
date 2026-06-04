const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHomeScript({ fetchMock, elements }) {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/js/home.js'), 'utf8');
  const context = {
    console: {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    },
    document: {
      addEventListener: jest.fn(),
      getElementById: jest.fn((id) => elements[id] || null)
    },
    window: {
      addEventListener: jest.fn()
    },
    localStorage: {
      getItem: jest.fn(() => '')
    },
    setInterval: jest.fn(),
    fetch: fetchMock,
    URLSearchParams
  };

  vm.createContext(context);
  new vm.Script(source).runInContext(context);
  return context;
}

describe('home frontend stats', () => {
  test('uses the active count endpoint for the hero active-announcements counter', async () => {
    const elements = {
      'resolved-announcements-count': { textContent: '0' },
      'active-announcements-count': { textContent: '0' },
      'public-rifugi-count': { textContent: '0' }
    };
    const paginatedAnnouncements = Array.from({ length: 10 }, (_, index) => ({
      _id: `ann-${index}`,
      status: 'ACTIVE'
    }));
    const fetchMock = jest.fn(async (url) => {
      if (url === '/api/v1/announcements') {
        return {
          ok: true,
          json: async () => ({ data: paginatedAnnouncements })
        };
      }
      if (url === '/api/v1/announcements/count?status=active') {
        return {
          ok: true,
          json: async () => ({ count: 13 })
        };
      }
      if (url === '/api/v1/announcements/count?status=resolved') {
        return {
          ok: true,
          json: async () => ({ count: 4 })
        };
      }
      if (url === '/api/v1/users/shelters?isPublic=true') {
        return {
          ok: true,
          json: async () => ({ count: 2 })
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const context = loadHomeScript({ fetchMock, elements });
    await context.renderHeroStats();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/announcements/count?status=active');
    expect(elements['active-announcements-count'].textContent).toBe('13');
  });
});
