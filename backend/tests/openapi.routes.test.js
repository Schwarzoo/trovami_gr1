const fs = require('fs');
const path = require('path');

function routeDoc(fileName, routeCall) {
  const source = fs.readFileSync(path.join(__dirname, '../routes', fileName), 'utf8');
  const routeIndex = source.indexOf(routeCall);
  expect(routeIndex).toBeGreaterThan(-1);

  const beforeRoute = source.slice(0, routeIndex);
  const commentStart = beforeRoute.lastIndexOf('/**');
  const commentEnd = beforeRoute.lastIndexOf('*/');
  expect(commentStart).toBeGreaterThan(-1);
  expect(commentEnd).toBeGreaterThan(commentStart);

  const comment = beforeRoute.slice(commentStart, commentEnd + 2);
  expect(comment).toContain('@openapi');
  return comment;
}

describe('OpenAPI route documentation', () => {
  test.each([
    ['backend/routes/adminRoutes.js', 'adminRoutes.js', "router.get('/reports'", ['status']],
    ['backend/routes/adminRoutes.js', 'adminRoutes.js', "router.get('/audit-logs'", ['limit']],
    ['backend/routes/adminRoutes.js', 'adminRoutes.js', "router.get('/rifugi'", ['status']],
    ['backend/routes/announcementRoutes.js', 'announcementRoutes.js', "router.get('/'", ['limit', 'page', 'status']],
    ['backend/routes/announcementRoutes.js', 'announcementRoutes.js', "router.get('/count'", ['status']],
    ['backend/routes/announcementRoutes.js', 'announcementRoutes.js', "router.get('/:id/similar'", ['limit']],
    ['backend/routes/animalRoutes.js', 'animalRoutes.js', "router.get('/'", ['limit', 'page']]
  ])('%s documents query filters', (_label, fileName, routeCall, expectedParams) => {
    const comment = routeDoc(fileName, routeCall);
    expect(comment).toContain('parameters:');
    expectedParams.forEach((name) => {
      expect(comment).toContain(`name: ${name}`);
      expect(comment).toContain('in: query');
      expect(comment).toMatch(new RegExp(`name: ${name}[\\s\\S]*?schema:[\\s\\S]*?type: (integer|string)`));
    });
  });

  test.each([
    ['backend/routes/authRoutes.js', 'authRoutes.js', "router.post('/users'"],
    ['backend/routes/announcementRoutes.js', 'announcementRoutes.js', "router.post('/'"],
    ['backend/routes/announcementRoutes.js', 'announcementRoutes.js', "router.post('/:id/comments'"],
    ['backend/routes/announcementRoutes.js', 'announcementRoutes.js', "router.post('/:id/reports'"],
    ['backend/routes/animalRoutes.js', 'animalRoutes.js', "router.post('/'"],
    ['backend/routes/contactRequestRoutes.js', 'contactRequestRoutes.js', "router.post('/'"]
  ])('%s documents Location header on 201 responses', (_label, fileName, routeCall) => {
    const comment = routeDoc(fileName, routeCall);
    expect(comment).toContain("responses:");
    expect(comment).toContain("'201':");
    expect(comment).toMatch(/'201':[\s\S]*?headers:[\s\S]*?Location:[\s\S]*?schema:[\s\S]*?type: string/);
    expect(comment).toMatch(/Location:[\s\S]*?description: URI della risorsa creata/);
  });
});
