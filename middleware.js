export const config = {
  matcher: ['/'],
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

export default async function middleware(request) {
  const url = new URL(request.url);
  const songId = url.searchParams.get('song');
  const playlistId = url.searchParams.get('playlist');
  const albumName = url.searchParams.get('album');
  const artistName = url.searchParams.get('artist');

  const userAgent = request.headers.get('user-agent') || '';
  const isCrawler = /bot|facebookexternalhit|whatsapp|telegram|twitterbot|discordbot|slackbot|applebot|linkedinbot|embedly/i.test(userAgent);

  // If a social media crawler hits the root URL with a query param
  if (isCrawler && (songId || playlistId || albumName || artistName)) {
    const API_BASE = 'https://jiosavan.clashgram.workers.dev/api';
    const UPSTASH_URL = 'https://inviting-moccasin-222921.upstash.io';
    const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;
    const targetFrontend = 'https://clashmusic.vercel.app';
    
    let title = 'ToonTunes • Playful Cartoon Music';
    let description = 'Stream high quality cartoon music on ToonTunes!';
    let image = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
    let redirectUrl = `${targetFrontend}${url.search}`;

    try {
      if (songId) {
        const apiRes = await fetch(`${API_BASE}/songs?ids=${encodeURIComponent(songId)}`);
        const json = await apiRes.json();
        if (json.success && Array.isArray(json.data) && json.data[0]) {
          const song = json.data[0];
          let artistStr = 'Artist';
          if (song.primaryArtists && typeof song.primaryArtists === 'string') {
            artistStr = song.primaryArtists;
          } else if (song.artists && song.artists.primary && song.artists.primary[0]) {
            artistStr = song.artists.primary.map(a => a.name).join(', ');
          }
          
          title = `${song.name || 'Song'} - ${artistStr}`;
          description = `Listen to ${song.name} from album ${song.album?.name || song.album || 'Single'} on ToonTunes!`;
          if (Array.isArray(song.image) && song.image.length > 0) {
            image = song.image[song.image.length - 1]?.url || image;
          }
        }
      } else if (albumName) {
        const decodedAlbum = decodeURIComponent(albumName);
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
        const apiRes = await fetch(`${UPSTASH_URL}/get/pl_${playlistId}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
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
      console.error('Middleware fetch error:', err);
    }

    image = image.replace('http://', 'https://');

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
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // Allow normal users to load the standard Vite React app (index.html)
}
