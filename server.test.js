const request = require('supertest');
const http = require('http');
const server = require('./server');

describe('Static File Server Security', () => {
  let app;

  beforeAll((done) => {
    app = server.listen(0, done);
  });

  afterAll((done) => {
    app.close(done);
  });

  it('should prevent path traversal attacks via url encoded characters', (done) => {
    // Supertest normalizes both raw dots AND url encoded dots (`%2e`),
    // so we use Node's native http module to send an unnormalized path.
    const port = app.address().port;
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/%2e%2e/%2e%2e/etc/passwd',
      method: 'GET'
    }, (res) => {
      expect(res.statusCode).toBe(403);

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        expect(data).toBe('Forbidden');
        done();
      });
    });

    req.on('error', done);
    req.end();
  });

  it('should prevent path traversal attacks via raw dots', (done) => {
    // Supertest normalizes raw relative dots in the path before sending them,
    // so we use Node's native http module to send an unnormalized path.
    const port = app.address().port;
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/../../../../etc/passwd',
      method: 'GET'
    }, (res) => {
      expect(res.statusCode).toBe(403);

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        expect(data).toBe('Forbidden');
        done();
      });
    });

    req.on('error', done);
    req.end();
  });

  it('should return 404 for non-existent file within directory', async () => {
    const res = await request(app).get('/missing.html');
    expect(res.status).toBe(404);
  });

  it('should serve index.html for root path', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
