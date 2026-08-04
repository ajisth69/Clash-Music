/**
 * ToonTunes Social Media Open Graph (OG) Share Cloudflare Worker
 * -------------------------------------------------------------
 * Deploy this script on Cloudflare Workers (https://workers.cloudflare.com)
 * 
 * ENVIRONMENT VARIABLES / CONSTANTS:
 * - FRONTEND_URL: The URL of your hosted ToonTunes Web App (e.g., https://your-app.pages.dev)
 * 
 * HOW IT WORKS:
 * 1. Crawlers (WhatsApp, Telegram, Discord, Twitter/X, iMessage, Facebook) hit worker URL:
 *    - Example: https://share.toontunes.workers.dev/?song=12345
 *    - Worker fetches song metadata from JioSaavn API and returns HTML with <meta property="og:image">,
 *      <meta property="og:title">, <meta property="og:description"> for rich social previews!
 * 2. Real Human Visitors opening the link in a browser are automatically redirected to the Web App!
 */

const FRONTEND_URL = 'https://clashmusic.vercel.app'; // Change this to your deployed Web App URL
const API_BASE = 'https://jiosavan.clashgram.workers.dev/api';
const UPSTASH_URL = 'https://inviting-moccasin-222921.upstash.io';
const SPOTIFY_CLIENT_ID = '85d955692d73429b941dda4676485f84'; // Public ID

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetFrontend = env.FRONTEND_URL || FRONTEND_URL;

    // --- API ENDPOINTS FOR FRONTEND (Hiding Upstash Token) ---
    if (url.pathname === '/api/playlist') {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      if (request.method === 'POST') {
        try {
          const playlist = await request.json();
          const shortId = Math.random().toString(36).substring(2, 10);
          const key = `pl_${shortId}`;
          
          await fetch(`${UPSTASH_URL}/set/${key}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.UPSTASH_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(playlist)
          });

          return new Response(JSON.stringify({ success: true, id: shortId }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      }

      if (request.method === 'GET') {
        try {
          const id = url.searchParams.get('id');
          if (!id) throw new Error('Missing playlist ID');
          
          const res = await fetch(`${UPSTASH_URL}/get/pl_${id}`, {
            headers: { Authorization: `Bearer ${env.UPSTASH_TOKEN}` }
          });
          const json = await res.json();
          
          let playlistData = json.result;
          if (typeof playlistData === 'string') {
            try { playlistData = JSON.parse(playlistData); } catch (e) {}
          }

          return new Response(JSON.stringify({ success: true, data: playlistData }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      }
    }

    if (url.pathname === '/api/spotify') {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      if (request.method === 'GET') {
        try {
          const playlistUrl = url.searchParams.get('url');
          if (!playlistUrl) throw new Error('Missing Spotify Playlist URL');

          // Extract ID from URL
          let playlistId = playlistUrl;
          if (playlistUrl.includes('spotify.com/playlist/')) {
            playlistId = playlistUrl.split('spotify.com/playlist/')[1].split('?')[0];
          }

          // 1. Get Spotify Access Token
          const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              Authorization: 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)
            },
            body: 'grant_type=client_credentials'
          });
          
          const tokenText = await tokenRes.text();
          let tokenJson;
          try {
            tokenJson = JSON.parse(tokenText);
          } catch (e) {
            throw new Error(`Spotify Auth Error (${tokenRes.status}): ${tokenText.slice(0, 100)}`);
          }
          
          if (!tokenJson.access_token) throw new Error('Failed to authenticate with Spotify: ' + tokenText.slice(0, 50));
          const accessToken = tokenJson.access_token;

          // 2. Fetch Playlist Details
          const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          });
          
          const plText = await plRes.text();
          let plJson;
          try {
            plJson = JSON.parse(plText);
          } catch (e) {
            throw new Error(`Spotify API Error (${plRes.status}): ${plText.slice(0, 100)}`);
          }
          
          if (plJson.error) throw new Error(plJson.error.message);

          const playlistName = plJson.name;
          const tracks = [];

          // Parse first page
          if (plJson.tracks && plJson.tracks.items) {
            for (const item of plJson.tracks.items) {
              if (item.track && item.track.name) {
                tracks.push({
                  songName: item.track.name,
                  artistName: item.track.artists ? item.track.artists.map(a => a.name).join(', ') : '',
                  image: item.track.album && item.track.album.images && item.track.album.images.length > 0 
                         ? item.track.album.images[0].url : ''
                });
              }
            }
          }

          return new Response(JSON.stringify({ success: true, name: playlistName, tracks }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      }
    }

    // --- STANDARD SOCIAL SHARING OG TAG GENERATOR ---
    const songId = url.searchParams.get('song') || url.pathname.split('/song/')[1];
    const albumName = url.searchParams.get('album') || url.pathname.split('/album/')[1];
    const artistName = url.searchParams.get('artist') || url.pathname.split('/artist/')[1];
    const playlistId = url.searchParams.get('playlist') || url.pathname.split('/playlist/')[1];

    const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
    const isCrawler = /bot|facebookexternalhit|whatsapp|telegram|twitterbot|discordbot|slackbot|applebot|linkedinbot|embedly/i.test(userAgent);

    let title = 'ToonTunes • Playful Cartoon Music';
    let description = 'Stream high quality cartoon music on ToonTunes!';
    let image = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
    let redirectUrl = targetFrontend;

    try {
      if (songId) {
        redirectUrl = `${targetFrontend}/?song=${encodeURIComponent(songId)}`;
        const apiRes = await fetch(`${API_BASE}/songs?ids=${encodeURIComponent(songId)}`);
        const json = await apiRes.json();
        if (json.success && Array.isArray(json.data) && json.data[0]) {
          const song = json.data[0];
          title = `${song.name || 'Song'} - ${song.primaryArtists || song.artists || 'Artist'}`;
          description = `Listen to ${song.name} from album ${song.album?.name || song.album || 'Single'} on ToonTunes!`;
          if (Array.isArray(song.image) && song.image.length > 0) {
            image = song.image[song.image.length - 1]?.url || image;
          }
        }
      } else if (albumName) {
        const decodedAlbum = decodeURIComponent(albumName);
        redirectUrl = `${targetFrontend}/?album=${encodeURIComponent(decodedAlbum)}`;
        const apiRes = await fetch(`${API_BASE}/search/albums?query=${encodeURIComponent(decodedAlbum)}`);
        const json = await apiRes.json();
        if (json.success && json.data?.results?.[0]) {
          const album = json.data.results[0];
          title = `Album: ${album.name || decodedAlbum}`;
          description = `Listen to official album ${album.name} on ToonTunes!`;
          if (Array.isArray(album.image) && album.image.length > 0) {
            image = album.image[album.image.length - 1]?.url || image;
          }
        }
      } else if (artistName) {
        const decodedArtist = decodeURIComponent(artistName);
        redirectUrl = `${targetFrontend}/?artist=${encodeURIComponent(decodedArtist)}`;
        const apiRes = await fetch(`${API_BASE}/search/artists?query=${encodeURIComponent(decodedArtist)}`);
        const json = await apiRes.json();
        if (json.success && json.data?.results?.[0]) {
          const artist = json.data.results[0];
          title = `Artist: ${artist.name || decodedArtist}`;
          description = `Explore songs & discography of ${artist.name} on ToonTunes!`;
          if (Array.isArray(artist.image) && artist.image.length > 0) {
            image = artist.image[artist.image.length - 1]?.url || image;
          }
        }
      } else if (playlistId) {
        redirectUrl = `${targetFrontend}/?playlist=${encodeURIComponent(playlistId)}`;
        const apiRes = await fetch(`${UPSTASH_URL}/get/pl_${playlistId}`, {
          headers: { Authorization: `Bearer ${env.UPSTASH_TOKEN}` }
        });
        const json = await apiRes.json();
        if (json.result) {
          let pl = json.result;
          if (typeof pl === 'string') {
            try { pl = JSON.parse(pl); } catch (e) {}
          }
          if (pl && pl.name) {
            title = `Mix: ${pl.name}`;
            description = `${pl.description || 'Custom Cartoon Mix'} • ${pl.tracks?.length || 0} Tracks`;
            if (pl.tracks && pl.tracks[0] && pl.tracks[0].image) {
              image = pl.tracks[0].image;
            }
          }
        }
      }
    } catch (err) {
      console.error('Worker error:', err);
    }

    image = image.replace('http://', 'https://');

    if (!isCrawler && (songId || albumName || artistName || playlistId)) {
      return Response.redirect(redirectUrl, 302);
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="music.song">
  <meta property="og:site_name" content="ToonTunes">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="500">
  <meta property="og:image:height" content="500">
  <meta property="og:url" content="${escapeHtml(redirectUrl)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <script>
    window.location.href = "${escapeHtml(redirectUrl)}";
  </script>
</head>
<body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0F172A; color: white;">
  <h2>🎵 ${escapeHtml(title)}</h2>
  <img src="${escapeHtml(image)}" style="width: 250px; height: 250px; border-radius: 16px; border: 3px solid black;" />
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(redirectUrl)}" style="color: #38BDF8; font-weight: bold;">Click here to open in ToonTunes</a></p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, max-age=3600'
      }
    });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
