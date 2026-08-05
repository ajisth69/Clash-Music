export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const songId = url.searchParams.get('songId') || url.searchParams.get('song');
    const playlistId = url.searchParams.get('playlist') || url.searchParams.get('playlistId');
    const pName = url.searchParams.get('pName');
    const pData = url.searchParams.get('pData');

    const UPSTASH_URL = env?.UPSTASH_URL || 'https://inviting-moccasin-222921.upstash.io';
    const UPSTASH_TOKEN = env?.UPSTASH_TOKEN;

    // CORS Headers helper
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 1. API Endpoints for Playlist Shortening (/api/playlist) ---
    if (url.pathname === '/api/playlist') {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const shortId = Math.random().toString(36).substring(2, 10);
          const key = `pl_${shortId}`;

          const res = await fetch(`${UPSTASH_URL}/set/${key}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${UPSTASH_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });

          if (!res.ok) {
            throw new Error('Failed to save playlist to Redis');
          }

          return Response.json({ success: true, id: shortId }, { headers: corsHeaders });
        } catch (err) {
          return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
        }
      }

      if (request.method === 'GET') {
        try {
          const id = url.searchParams.get('id');
          if (!id) throw new Error('Missing playlist ID');

          const res = await fetch(`${UPSTASH_URL}/get/pl_${id}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
          });
          const json = await res.json();

          if (!json.result) {
            return Response.json({ success: false, error: 'Playlist not found' }, { status: 404, headers: corsHeaders });
          }

          let pl = json.result;
          if (typeof pl === 'string') {
            try { pl = JSON.parse(pl); } catch (e) {}
          }

          return Response.json({ success: true, data: pl }, { headers: corsHeaders });
        } catch (err) {
          return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
        }
      }
    }

    // --- 2. Human User Redirection vs Bot Sniffing ---
    const userAgent = request.headers.get('User-Agent') || '';
    const isBot = /bot|telegram|whatsapp|discord|facebook|slurp|facebookexternalhit|vkShare|twitter/i.test(userAgent);

    if (!isBot) {
      // It's a real person! Send them to the Vercel URL natively.
      const vUrl = new URL(request.url);
      vUrl.hostname = 'clashmusic.vercel.app';
      return Response.redirect(vUrl.toString(), 302);
    }

    // --- 3. Social Media Bot OpenGraph Injection ---
    const targetUrl = new URL(request.url);
    targetUrl.hostname = 'clashmusic.vercel.app';
    const response = await fetch(targetUrl.toString());

    if (!songId && !playlistId && !(pName && pData)) {
      return response;
    }

    try {
      let targetId = songId;
      let isPlaylist = false;
      let playlistName = '';

      // Handle Shortened Upstash Playlist Link
      if (!targetId && playlistId) {
        try {
          const plRes = await fetch(`${UPSTASH_URL}/get/pl_${playlistId}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
          });
          const plJson = await plRes.json();
          if (plJson.result) {
            let pl = plJson.result;
            if (typeof pl === 'string') {
              try { pl = JSON.parse(pl); } catch (e) {}
            }
            if (pl && pl.tracks && pl.tracks.length > 0) {
              targetId = typeof pl.tracks[0] === 'object' ? pl.tracks[0].id : pl.tracks[0];
              isPlaylist = true;
              playlistName = pl.name || 'Shared Playlist';
            }
          }
        } catch (err) {}
      }

      // Handle Base64 Playlist Link
      if (!targetId && pName && pData) {
        try {
          const ids = JSON.parse(atob(decodeURIComponent(pData)));
          if (Array.isArray(ids) && ids.length > 0) {
            targetId = ids[0];
            isPlaylist = true;
            playlistName = decodeURIComponent(pName);
          }
        } catch (err) {}
      }

      if (!targetId) return response;

      // Fetch target song metadata from JioSaavn API pool
      const API_POOL = [
        'https://jiosaavn-api-two-beta.vercel.app/api',
        'https://saavn.dev/api',
        'https://jio-savaan-private.vercel.app/api'
      ];

      let apiData = null;
      for (const base of API_POOL) {
        try {
          const apiRes = await fetch(`${base}/songs/${targetId}`);
          if (apiRes.ok) {
            apiData = await apiRes.json();
            if (apiData?.data && apiData.data.length > 0) break;
          }
        } catch(err) { continue; }
      }

      if (!apiData || !apiData.data || !apiData.data.length) return response;

      const song = apiData.data[0];
      const title = decodeURIComponent(song.name || song.title || 'Unknown Song');
      const artist = decodeURIComponent(song.artists?.primary?.map(a => a.name).join(', ') || song.primaryArtists || 'Unknown Artist');

      let image = '';
      if (Array.isArray(song.image)) {
        const hi = song.image.find(i => i.quality === '500x500');
        image = hi ? hi.url : song.image[song.image.length - 1].url;
      } else {
        image = song.image;
      }

      let finalTitle = '';
      let finalDesc = '';
      if (isPlaylist) {
        finalTitle = `${playlistName} | Shared Playlist`;
        finalDesc = `Listen to this curated collection featuring ${title} by ${artist} and more on Clash Musics.`;
      } else {
        finalTitle = `${title} | Clash Musics`;
        finalDesc = `Listen to ${artist} stream beautifully without limits.`;
      }

      class MetaInjector {
        element(element) {
          element.append(`<meta property="og:title" content="${finalTitle}">`, { html: true });
          element.append(`<meta property="og:description" content="${finalDesc}">`, { html: true });
          element.append(`<meta property="og:image" content="${image}">`, { html: true });
          element.append(`<meta name="twitter:image" content="${image}">`, { html: true });
          element.append(`<meta name="twitter:card" content="summary_large_image">`, { html: true });
          element.append(`<meta property="og:type" content="${isPlaylist ? 'music.playlist' : 'music.song'}">`, { html: true });
        }
      }

      return new HTMLRewriter()
        .on('head', new MetaInjector())
        .transform(response);

    } catch (e) {
      return response;
    }
  }
};
