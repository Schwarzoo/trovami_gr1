const fs = require('fs');
const path = require('path');

function apiaryResource(apiary, heading) {
  const start = apiary.indexOf(heading);
  expect(start).toBeGreaterThan(-1);

  const next = apiary.indexOf('\n## ', start + heading.length);
  return next === -1 ? apiary.slice(start) : apiary.slice(start, next);
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
});
