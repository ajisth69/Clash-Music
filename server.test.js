const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const https = require('node:https');
const { EventEmitter } = require('events');
const server = require('./server.js');

// Suppress console output for cleaner test results
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = () => {};
console.error = () => {};

test('HiFi proxy invalid URL handling', async (t) => {
  // Start the server on a random port for testing
  if (!server.listening) {
    await new Promise((resolve) => {
      server.listen(0, resolve);
    });
  }

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

test('API Proxy failover logic', async (t) => {
  if (!server.listening) {
    await new Promise(resolve => server.listen(0, resolve));
  }
  const port = server.address().port;

  const originalHttpsRequest = https.request;

  t.after(() => {
    https.request = originalHttpsRequest;
    server.close();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  await t.test('Should failover to the second mirror when the first returns 500', async () => {
    let requestCount = 0;

    https.request = function(url, options, callback) {
      requestCount++;
      const mockReq = new EventEmitter();

      mockReq.end = function() {
        process.nextTick(() => {
          const mockRes = new EventEmitter();
          if (requestCount === 1) {
            mockRes.statusCode = 500;
            mockRes.headers = {};
            if (callback) callback(mockRes);
          } else {
            mockRes.statusCode = 200;
            mockRes.headers = { 'content-type': 'application/json' };
            if (callback) callback(mockRes);
            mockRes.emit('data', '{"success":true,"mirror":2}');
            mockRes.emit('end');
          }
        });
      };

      mockReq.pipe = mockReq.end;
      return mockReq;
    };

    const result = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/test`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      }).on('error', reject);
    });

    assert.strictEqual(requestCount, 2);
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.data, '{"success":true,"mirror":2}');
  });

  await t.test('Should failover to the second mirror on network error', async () => {
    let requestCount = 0;

    https.request = function(url, options, callback) {
      requestCount++;
      const mockReq = new EventEmitter();

      mockReq.end = function() {
        process.nextTick(() => {
          if (requestCount === 1) {
            mockReq.emit('error', new Error('Network timeout'));
          } else {
            const mockRes = new EventEmitter();
            mockRes.statusCode = 200;
            mockRes.headers = { 'content-type': 'application/json' };
            if (callback) callback(mockRes);
            mockRes.emit('data', '{"success":true,"mirror":2}');
            mockRes.emit('end');
          }
        });
      };

      mockReq.pipe = mockReq.end;
      return mockReq;
    };

    const result = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/test`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      }).on('error', reject);
    });

    assert.strictEqual(requestCount, 2);
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.data, '{"success":true,"mirror":2}');
  });

  await t.test('Should return 502 when all mirrors fail', async () => {
    let requestCount = 0;

    https.request = function(url, options, callback) {
      requestCount++;
      const mockReq = new EventEmitter();

      mockReq.end = function() {
        process.nextTick(() => {
          const mockRes = new EventEmitter();
          mockRes.statusCode = 503;
          mockRes.headers = {};
          if (callback) callback(mockRes);
        });
      };

      mockReq.pipe = mockReq.end;
      return mockReq;
    };

    const result = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/test`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      }).on('error', reject);
    });

    assert.strictEqual(requestCount, 2);
    assert.strictEqual(result.statusCode, 502);
    assert.strictEqual(JSON.parse(result.data).error, 'All backend API mirrors failed');
  });
});
