const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const server = require('./server.js');

test('HiFi proxy invalid URL handling', async (t) => {
  // Start the server on a random port for testing
  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  const port = server.address().port;

  t.after(() => {
    server.close();
  });

  await t.test('Missing url param returns 400', async () => {
    const res = await new Promise((resolve) => {
      http.get(`http://localhost:${port}/stream`, resolve);
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.headers['content-type'], 'application/json');

    let data = '';
    for await (const chunk of res) {
      data += chunk;
    }

    const body = JSON.parse(data);
    assert.deepStrictEqual(body, { error: 'Missing url param' });
  });

  await t.test('Invalid url encoding returns 400', async () => {
    // %E0%A4%A is an invalid UTF-8 sequence and will throw when decodeURIComponent is called
    const res = await new Promise((resolve) => {
      http.get(`http://localhost:${port}/stream?url=%E0%A4%A`, resolve);
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.headers['content-type'], 'application/json');

    let data = '';
    for await (const chunk of res) {
      data += chunk;
    }

    const body = JSON.parse(data);
    assert.deepStrictEqual(body, { error: 'Invalid url' });
  });
});
