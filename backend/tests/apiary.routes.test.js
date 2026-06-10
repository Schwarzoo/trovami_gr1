const fs = require('fs');
const path = require('path');

function apiaryResource(apiary, heading) {
  const start = apiary.indexOf(heading);
  expect(start).toBeGreaterThan(-1);

  const next = apiary.indexOf('\n## ', start + heading.length);
  return next === -1 ? apiary.slice(start) : apiary.slice(start, next);
}

function normalizeApiPath(apiPath) {
  return apiPath
    .replace(/\{\?[^}]+\}/g, '')
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

function joinApiPath(basePath, routePath) {
  if (routePath === '/') return basePath;
  return normalizeApiPath(`${basePath}/${routePath.replace(/^\//, '')}`);
}

function mountedApiRouters(rootDir) {
  const server = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
  const mountPattern = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*require\(['"]\.\/routes\/([^'"]+)['"]\)\s*\)/g;
  const mounts = [];
  let match;

  while ((match = mountPattern.exec(server)) !== null) {
    mounts.push({
      basePath: normalizeApiPath(match[1]),
      fileStem: path.basename(match[2], '.js')
    });
  }

  return mounts;
}

function duplicates(values) {
  return values
    .filter((value, index) => values.indexOf(value) !== index)
    .filter((value, index, duplicateValues) => duplicateValues.indexOf(value) === index)
    .sort();
}

const allowedApiaryDuplicateContracts = [
  'PATCH /api/v1/admin/rifugi/{id}',
  'POST /api/v1/auth/users'
];

function expressRouteContracts(rootDir) {
  const routeDir = path.join(rootDir, 'backend/routes');
  const contracts = [];

  mountedApiRouters(rootDir).forEach(({ fileStem, basePath }) => {
    const source = fs.readFileSync(path.join(routeDir, `${fileStem}.js`), 'utf8');
    const routePattern = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
    let match;

    while ((match = routePattern.exec(source)) !== null) {
      contracts.push(`${match[1].toUpperCase()} ${joinApiPath(basePath, match[2])}`);
    }
  });

  const server = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
  if (server.includes("app.get('/api/v1/mock-emails'")) {
    contracts.push('GET /api/v1/mock-emails');
  }

  return contracts.sort();
}

function apiaryRouteContracts(apiary) {
  const contracts = [];
  const resourcePattern = /^## .+ \[([^\]]+)\]$/gm;
  let resourceMatch;

  while ((resourceMatch = resourcePattern.exec(apiary)) !== null) {
    const resourcePath = normalizeApiPath(resourceMatch[1]);
    const resourceStart = resourceMatch.index + resourceMatch[0].length;
    const nextResourceIndex = apiary.indexOf('\n## ', resourceStart);
    const resourceBody = apiary.slice(resourceStart, nextResourceIndex === -1 ? apiary.length : nextResourceIndex);
    const actionPattern = /^### .+ \[(GET|POST|PUT|PATCH|DELETE)\]$/gm;
    let actionMatch;

    while ((actionMatch = actionPattern.exec(resourceBody)) !== null) {
      contracts.push(`${actionMatch[1]} ${resourcePath}`);
    }
  }

  return contracts.sort();
}

describe('API documentation', () => {
  test('Apiary is the only declared API documentation system', () => {
    const rootDir = path.join(__dirname, '../..');
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'backend/package.json'), 'utf8'));
    const server = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
    const routeDir = path.join(rootDir, 'backend/routes');
    const routeSources = fs.readdirSync(routeDir)
      .filter((fileName) => fileName.endsWith('.js'))
      .map((fileName) => fs.readFileSync(path.join(routeDir, fileName), 'utf8'))
      .join('\n');

    expect(readme).toContain('apiary.apib');
    expect(readme).not.toMatch(/Swagger|OpenAPI/);
    expect(packageJson.dependencies).not.toHaveProperty('swagger-jsdoc');
    expect(packageJson.dependencies).not.toHaveProperty('swagger-ui-express');
    expect(server).not.toMatch(/swagger/i);
    expect(routeSources).not.toContain('@openapi');
    expect(routeSources).not.toMatch(/^\s*\*\s+\/api\/v1\//m);
  });

  test('Apiary documents backend route contract for known public mismatches', () => {
    const apiary = fs.readFileSync(path.join(__dirname, '../../apiary.apib'), 'utf8');

    expect(apiary).toContain('## Reset Password [/api/v1/auth/password]');
    expect(apiary).toContain('### Reimposta Password [PATCH]');
    expect(apiary).not.toContain('### Reimposta Password [POST]');

    expect(apiary).toContain('## Rifugi Pubblici [/api/v1/users/rifugi]');
    expect(apiary).toContain('### Elenco Rifugi [GET]');
    expect(apiary).toContain('## Rifugi Pubblici Alias Inglese [/api/v1/users/shelters]');
    expect(apiary).toContain('### Elenco Shelters [GET]');
    expect(apiary).not.toContain('/api/v1/users/rifugi/public');
    expect(apiary).not.toContain('/api/v1/users/rifugi{?page,limit}');
    expect(apiary).not.toContain('/api/v1/users/shelters{?page,limit}');

    const rifugiDoc = apiaryResource(apiary, '## Rifugi Pubblici [/api/v1/users/rifugi]');
    expect(rifugiDoc).not.toContain('"meta"');
    expect(rifugiDoc).not.toContain('"data"');

    const sheltersDoc = apiaryResource(apiary, '## Rifugi Pubblici Alias Inglese [/api/v1/users/shelters]');
    expect(sheltersDoc).not.toContain('"meta"');
    expect(sheltersDoc).not.toContain('"data"');

    expect(apiary).toContain('## Lettura Tutte [/api/v1/notifications]');
    expect(apiary).toContain('### Segna Tutte Come Lette [PATCH]');
    expect(apiary).not.toContain('/api/v1/notifications/read-all');
  });

  test('Apiary documents every Express API route and no removed route', () => {
    const rootDir = path.join(__dirname, '../..');
    const apiary = fs.readFileSync(path.join(rootDir, 'apiary.apib'), 'utf8');
    const expressContracts = expressRouteContracts(rootDir);
    const apiaryContracts = apiaryRouteContracts(apiary);

    expect(duplicates(expressContracts)).toEqual([]);
    expect(duplicates(apiaryContracts)).toEqual(allowedApiaryDuplicateContracts);
    expect([...new Set(apiaryContracts)].sort()).toEqual(expressContracts);
  });
});
