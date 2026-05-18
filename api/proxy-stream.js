const axios = require('axios');

module.exports = async function handler(req, res) {
  const streamUrl = req.query.url;
  if (!streamUrl) {
    return res.status(400).json({ error: 'Missing url param' });
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(streamUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }

  const isValidScheme = decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://');
  if (!isValidScheme) {
    return res.status(403).json({ error: 'Forbidden: Invalid URL scheme' });
  }

  const upstreamHeaders = { 'User-Agent': 'ClashMusics/2.0' };
  if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;

  try {
    const upRes = await axios({
      method: 'GET',
      url: decodedUrl,
      headers: upstreamHeaders,
      responseType: 'stream',
      validateStatus: () => true // Allow all status codes
    });

    res.status(upRes.status);

    // Set headers manually
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (upRes.headers['content-type']) {
        res.setHeader('Content-Type', upRes.headers['content-type']);
    } else {
        res.setHeader('Content-Type', 'audio/mpeg');
    }

    if (upRes.headers['content-length']) res.setHeader('Content-Length', upRes.headers['content-length']);
    if (upRes.headers['content-range'])  res.setHeader('Content-Range', upRes.headers['content-range']);

    upRes.data.pipe(res);

  } catch (err) {
    console.error('[HiFi Proxy] Upstream error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Upstream failed', message: err.message });
    }
  }
}
