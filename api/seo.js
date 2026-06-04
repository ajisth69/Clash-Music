const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CLOUDFLARE_API_URL = "https://jiosavan.ajisth007.workers.dev/api";
const APP_NAME = "Clash Musics";

/**
 * Escapes special HTML characters to prevent tag breaks.
 */
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = async (req, res) => {
  const reqUrl = req.url || "";
  const isTrack = reqUrl.startsWith('/track/');
  const isAlbum = reqUrl.startsWith('/album/');
  
  let id = "";
  if (isTrack) id = reqUrl.split('/track/')[1]?.split('?')[0];
  if (isAlbum) id = reqUrl.split('/album/')[1]?.split('?')[0];

  // Load the baseline index.html file from the local workspace
  const htmlPath = path.join(process.cwd(), 'index.html');
  let html = "";
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (err) {
    console.error("Vercel Lambda failed to read index.html:", err);
    return res.status(500).send("Base application template unavailable.");
  }

  // Absolute fallback: if no ID or no route matched, serve untouched HTML
  if (!id) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }

  try {
    // ------------------------------------------
    // 1. DYNAMIC SSR SEO ENGINE FOR TRACKS
    // ------------------------------------------
    if (isTrack) {
      const apiRes = await axios.get(`${CLOUDFLARE_API_URL}/songs/${id}`, { timeout: 5000 });
      const songData = apiRes.data;
      
      if (!songData || !songData.success || !songData.data?.length) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }
      const song = songData.data[0];

      // Metadata normalization
      const title = song.name || song.title || "Unknown Track";
      let artist = "Unknown Artist";
      if (song.artists?.primary?.length) {
        artist = song.artists.primary.map(a => a.name).join(", ");
      } else if (typeof song.primaryArtists === "string") {
        artist = song.primaryArtists;
      } else if (typeof song.artist === "string") {
        artist = song.artist;
      }
      const albumName = song.album?.name || song.album || "Single";
      
      let coverUrl = "";
      if (Array.isArray(song.image)) {
        const hi = song.image.find(i => i.quality === "500x500");
        coverUrl = hi ? hi.url : (song.image[song.image.length - 1]?.url || "");
      } else if (typeof song.image === "string") {
        coverUrl = song.image;
      }
      if (coverUrl && coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;

      let streamUrl = "";
      if (Array.isArray(song.downloadUrl)) {
        const q320 = song.downloadUrl.find(d => d.quality === "320kbps");
        const q160 = song.downloadUrl.find(d => d.quality === "160kbps");
        const any  = song.downloadUrl[song.downloadUrl.length - 1];
        streamUrl = q320?.url || q160?.url || any?.url || "";
      } else if (typeof song.downloadUrl === "string") {
        streamUrl = song.downloadUrl;
      }
      const duration = song.duration || 0;

      const seoTitle = `${title} by ${artist} | ${APP_NAME}`;
      const seoDescription = `Stream "${title}" by ${artist} on ${APP_NAME}. Enjoy high-fidelity 320kbps audio, synchronized lyrics, and responsive visualizers.`;

      // Rich OG/Twitter cards
      const openGraphTags = `
        <title>${escapeHtml(seoTitle)}</title>
        <meta name="description" content="${escapeHtml(seoDescription)}" />
        <meta property="og:title" content="${escapeHtml(seoTitle)}" />
        <meta property="og:description" content="${escapeHtml(seoDescription)}" />
        <meta property="og:image" content="${escapeHtml(coverUrl)}" />
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content="https://${req.headers.host}${reqUrl}" />
        <meta property="og:site_name" content="${escapeHtml(APP_NAME)}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
        <meta name="twitter:description" content="${escapeHtml(seoDescription)}" />
        <meta name="twitter:image" content="${escapeHtml(coverUrl)}" />
        ${duration ? `<meta property="music:duration" content="${duration}" />` : ""}
      `;

      // MusicRecording JSON-LD Structured Schema
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "MusicRecording",
        "name": title,
        "image": coverUrl,
        "url": `https://${req.headers.host}${reqUrl}`,
        "byArtist": {
          "@type": "MusicGroup",
          "name": artist
        },
        "inAlbum": {
          "@type": "MusicAlbum",
          "name": albumName
        }
      };
      if (duration) jsonLd.duration = `PT${duration}S`;
      if (streamUrl) jsonLd.audio = streamUrl;

      const jsonLdScript = `
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      `;

      // Remove existing title and description tags from base HTML to prevent duplication
      html = html.replace(/<title>[^]*?<\/title>/gi, '');
      html = html.replace(/<meta name="description"[^]*?\/>/gi, '');
      
      const headInjection = openGraphTags + jsonLdScript;
      html = html.replace('</head>', `${headInjection}\n</head>`);
    }

    // ------------------------------------------
    // 2. DYNAMIC SSR SEO ENGINE FOR ALBUMS
    // ------------------------------------------
    if (isAlbum) {
      const apiRes = await axios.get(`${CLOUDFLARE_API_URL}/albums?id=${id}`, { timeout: 5000 });
      const albumData = apiRes.data;
      
      if (!albumData || !albumData.success || !albumData.data) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }
      const album = albumData.data;

      const albumName = album.name || album.title || "Unknown Album";
      let artist = "Unknown Artist";
      if (album.artists?.primary?.length) {
        artist = album.artists.primary.map(a => a.name).join(", ");
      } else if (typeof album.primaryArtists === "string") {
        artist = album.primaryArtists;
      } else if (typeof album.artist === "string") {
        artist = album.artist;
      }

      let coverUrl = "";
      if (Array.isArray(album.image)) {
        const hi = album.image.find(i => i.quality === "500x500");
        coverUrl = hi ? hi.url : (album.image[album.image.length - 1]?.url || "");
      } else if (typeof album.image === "string") {
        coverUrl = album.image;
      }
      if (coverUrl && coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;

      const songsCount = Array.isArray(album.songs) ? album.songs.length : 0;

      const seoTitle = `${albumName} by ${artist} | ${APP_NAME}`;
      const seoDescription = `Listen to the album "${albumName}" by ${artist} on ${APP_NAME}. Featuring ${songsCount} tracks with high-fidelity streaming audio.`;

      const openGraphTags = `
        <title>${escapeHtml(seoTitle)}</title>
        <meta name="description" content="${escapeHtml(seoDescription)}" />
        <meta property="og:title" content="${escapeHtml(seoTitle)}" />
        <meta property="og:description" content="${escapeHtml(seoDescription)}" />
        <meta property="og:image" content="${escapeHtml(coverUrl)}" />
        <meta property="og:type" content="music.album" />
        <meta property="og:url" content="https://${req.headers.host}${reqUrl}" />
        <meta property="og:site_name" content="${escapeHtml(APP_NAME)}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
        <meta name="twitter:description" content="${escapeHtml(seoDescription)}" />
        <meta name="twitter:image" content="${escapeHtml(coverUrl)}" />
      `;

      // Compile tracks for the MusicAlbum schema
      const tracksList = Array.isArray(album.songs) ? album.songs.map((s, index) => {
        let sArtist = "Unknown Artist";
        if (s.artists?.primary?.length) {
          sArtist = s.artists.primary.map(a => a.name).join(", ");
        } else if (typeof s.primaryArtists === "string") {
          sArtist = s.primaryArtists;
        } else if (typeof s.artist === "string") {
          sArtist = s.artist;
        }
        return {
          "@type": "MusicRecording",
          "position": index + 1,
          "name": s.name || s.title || "Unknown Track",
          "byArtist": {
            "@type": "MusicGroup",
            "name": sArtist
          }
        };
      }) : [];

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "MusicAlbum",
        "name": albumName,
        "image": coverUrl,
        "url": `https://${req.headers.host}${reqUrl}`,
        "byArtist": {
          "@type": "MusicGroup",
          "name": artist
        },
        "numTracks": songsCount
      };
      if (tracksList.length > 0) jsonLd.track = tracksList;

      const jsonLdScript = `
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      `;

      html = html.replace(/<title>[^]*?<\/title>/gi, '');
      html = html.replace(/<meta name="description"[^]*?\/>/gi, '');
      
      const headInjection = openGraphTags + jsonLdScript;
      html = html.replace('</head>', `${headInjection}\n</head>`);
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (err) {
    console.error("Vercel SEO serverless lambda failed, executing fallback:", err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }
};
