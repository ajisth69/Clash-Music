/**
 * server.js — Clash Musics Hi-Fi Node.js Proxy & Static Server
 * Run: node server.js
 * Enables: Serves the static website, Hi-Fi 320kbps proxy, CORS bypass, range requests
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Origin, Accept, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Health check
  if (parsed.pathname === '/health') {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', hifi: true, spatial: true, version: '2.0' }));
    return;
  }

  // Stream proxy — /stream?url=<encoded_url>
  if (parsed.pathname === '/stream') {
    const streamUrl = parsed.query.url;
    if (!streamUrl) {
      res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url param' }));
      return;
    }

    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(streamUrl);
    } catch {
      res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid url' }));
      return;
    }

    const upstreamOpts = url.parse(decodedUrl);

    // SSRF Protection: Validate scheme and hostname
    const isValidScheme = upstreamOpts.protocol === 'http:' || upstreamOpts.protocol === 'https:';
    const isValidHost = upstreamOpts.hostname === 'saavncdn.com' || (upstreamOpts.hostname && upstreamOpts.hostname.endsWith('.saavncdn.com'));

    if (!isValidScheme || !isValidHost) {
      res.writeHead(403, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Invalid URL scheme or domain' }));
      return;
    }

    const lib = decodedUrl.startsWith('https') ? https : http;

    const upstreamHeaders = { 'User-Agent': 'ClashMusics/2.0' };
    if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;

    const upReq = lib.request(
      { ...upstreamOpts, headers: upstreamHeaders },
      (upRes) => {
        const resHeaders = {
          ...CORS_HEADERS,
          'Content-Type': upRes.headers['content-type'] || 'audio/mpeg',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        };
        if (upRes.headers['content-length']) resHeaders['Content-Length'] = upRes.headers['content-length'];
        if (upRes.headers['content-range'])  resHeaders['Content-Range']  = upRes.headers['content-range'];

        res.writeHead(upRes.statusCode === 206 ? 206 : 200, resHeaders);
        upRes.pipe(res);
      }
    );

    upReq.on('error', (err) => {
      console.error('[HiFi] Upstream error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream failed', message: err.message }));
      }
    });

    req.pipe(upReq);
    return;
  }

  // Full API Proxy — /api/*
  // Proxies all frontend API requests through this Node.js backend to avoid CORS and frontend fragility
  let reqPath = parsed.pathname;
  if (reqPath.startsWith('/api/')) {
    const apiPath = reqPath.replace('/api/', '/');
    const queryString = parsed.search || '';
    
    // Pool of JioSaavn API mirrors for high availability
    const API_POOL = [
      'https://jiosavan.ajisth007.workers.dev/api',
      'https://jiosaavn-api-two-beta.vercel.app/api'
    ];

    let currentMirrorIndex = 0;

    const tryFetch = () => {
      if (currentMirrorIndex >= API_POOL.length) {
        if (!res.headersSent) {
          res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'All backend API mirrors failed' }));
        }
        return;
      }

      const fullUrl = `${API_POOL[currentMirrorIndex]}${apiPath}${queryString}`;
      
      const upReq = https.request(fullUrl, { method: req.method }, (upRes) => {
        // If 5xx error, failover to the next mirror
        if (upRes.statusCode >= 500) {
          currentMirrorIndex++;
          tryFetch();
          return;
        }

        let data = '';
        upRes.on('data', chunk => data += chunk);
        upRes.on('end', () => {
          res.writeHead(upRes.statusCode, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
          res.end(data);
        });
      });

      upReq.on('error', (err) => {
        console.error(`[API Proxy] Mirror ${API_POOL[currentMirrorIndex]} failed:`, err.message);
        currentMirrorIndex++;
        tryFetch();
      });
      
      if (req.method === 'POST' || req.method === 'PUT') req.pipe(upReq);
      else upReq.end();
    };

    tryFetch();
    return;
  }

  // Static File Server
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  try {
    reqPath = decodeURIComponent(reqPath);
  } catch (err) {
    // Ignore malformed URI components
  }

  const filePath = path.resolve(path.join(__dirname, reqPath));

  // Security: check if file is within directory to prevent path traversal
  const expectedDir = path.join(__dirname, path.sep);
  if (!filePath.startsWith(expectedDir)) {
    res.writeHead(403, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Security: Block sensitive files and hidden paths
  const lowerPath = reqPath.toLowerCase();
  const isSensitiveFile = lowerPath === '/server.js' ||
                          lowerPath === '/package.json' ||
                          lowerPath === '/vercel.json' ||
                          lowerPath.includes('/.');

  if (isSensitiveFile) {
    res.writeHead(403, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  // Security: Enforce an extension whitelist
  if (!MIME_TYPES[ext]) {
    res.writeHead(403, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Return 404 for missing static files
      res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    res.writeHead(200, headers);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('\n🎵  Clash Musics Server Running Locally!');
    console.log(`✓  Website Available   : http://localhost:${PORT}`);
    console.log(`✓  Full API Proxy      : http://localhost:${PORT}/api/*`);
    console.log(`✓  Hi-Fi Stream Proxy  : http://localhost:${PORT}/stream`);
    console.log(`✓  Hi-Fi 320kbps       : ACTIVE`);
    console.log(`✓  Range/Seeking       : ACTIVE`);
    console.log(`✓  CORS Bypass         : ACTIVE`);
    console.log('\nPress Ctrl+C to terminate the server.\n');
  });
}

module.exports = server;
