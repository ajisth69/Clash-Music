const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');

// Suppress console output for cleaner test results
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = () => {};
console.error = () => {};

// Intercept createServer to get the server instance
const originalCreateServer = http.createServer;
let serverInstance;
http.createServer = function(...args) {
  serverInstance = originalCreateServer.apply(this, args);
  return serverInstance;
};

// Start the server on a random port
process.env.PORT = '0';
require('./server');

test('API Proxy failover logic', async (t) => {
  if (!serverInstance.listening) {
    await new Promise(resolve => serverInstance.on('listening', resolve));
  }
  const port = serverInstance.address().port;

  const originalHttpsRequest = https.request;

  t.after(() => {
    https.request = originalHttpsRequest;
    serverInstance.close();
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
