/**
 * ═══════════════════════════════════════════
 *  api.js — Multi-API JioSaavn Integration
 * ═══════════════════════════════════════════
 *
 *  Integrates MULTIPLE JioSaavn API instances.
 *  Auto-detects which API is alive and uses it.
 *  Falls back silently to the next if one is down.
 */

/* ─────────── API Pool ─────────── */

const API_POOL = [
  'https://saavn.dev/api',
  'https://jiosaavn-api-two-beta.vercel.app/api',
  'https://jiosaavn-api-privatecvc2.vercel.app/api',
  'https://jio-savaan-private.vercel.app/api',
  'https://saavn-api-three.vercel.app/api',
  'https://jiosaavn-api-ts.vercel.app/api',
];

let activeAPI = null;       // The currently known-good API
let apiCheckDone = false;

/**
 * Probe each API in the pool and find the first that responds.
 * Called once at startup, cached afterward.
 */
async function findActiveAPI() {
  if (activeAPI) return activeAPI;

  console.log('[API] Probing', API_POOL.length, 'endpoints…');

  // Race all endpoints with a lightweight query
  const probes = API_POOL.map(async (base) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${base}/search/songs?query=test&limit=1`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json?.success || json?.data) {
          return base; // This one works!
        }
      }
    } catch { /* ignore */ }
    return null;
  });

  // Use Promise.allSettled and pick the first success
  const results = await Promise.allSettled(probes);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      activeAPI = r.value;
      console.log(`[API] ✓ Active endpoint: ${activeAPI}`);
      apiCheckDone = true;
      return activeAPI;
    }
  }

  // If none responded in parallel, try sequentially as last resort
  for (const base of API_POOL) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${base}/search/songs?query=arijit&limit=1`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        activeAPI = base;
        console.log(`[API] ✓ Active endpoint (sequential): ${activeAPI}`);
        apiCheckDone = true;
        return activeAPI;
      }
    } catch { /* next */ }
  }

  console.error('[API] ✗ No working API found!');
  apiCheckDone = true;
  return null;
}

/**
 * Smart fetch: tries the active API, on failure rotates to next.
 */
async function apiFetch(path, timeoutMs = 10000) {
  // Ensure we have an active API
  if (!activeAPI) await findActiveAPI();
  if (!activeAPI) return null;

  // Try current active
  let result = await safeFetch(`${activeAPI}${path}`, timeoutMs);
  if (result) return result;

  // Active failed — rotate through pool
  console.warn(`[API] ${activeAPI} failed, trying others…`);
  for (const base of API_POOL) {
    if (base === activeAPI) continue;
    result = await safeFetch(`${base}${path}`, timeoutMs);
    if (result) {
      activeAPI = base;
      console.log(`[API] Switched to: ${activeAPI}`);
      return result;
    }
  }

  return null;
}

/**
 * Generic fetch wrapper with error handling & timeout.
 */
async function safeFetch(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Normalise a raw song object from the API into our app's shape.
 */
function normaliseSong(raw) {
  if (!raw) return null;

  let image = '';
  if (Array.isArray(raw.image)) {
    const hi = raw.image.find(i => i.quality === '500x500');
    image = hi ? hi.url : (raw.image[raw.image.length - 1]?.url || '');
  } else if (typeof raw.image === 'string') {
    image = raw.image;
  }

  let streamUrl = '';
  if (Array.isArray(raw.downloadUrl)) {
    const q320 = raw.downloadUrl.find(d => d.quality === '320kbps');
    const q160 = raw.downloadUrl.find(d => d.quality === '160kbps');
    const any  = raw.downloadUrl[raw.downloadUrl.length - 1];
    streamUrl = q320?.url || q160?.url || any?.url || '';
  } else if (typeof raw.downloadUrl === 'string') {
    streamUrl = raw.downloadUrl;
  }

  let artist = '';
  if (raw.artists?.primary?.length) {
    artist = raw.artists.primary.map(a => a.name).join(', ');
  } else if (typeof raw.primaryArtists === 'string') {
    artist = raw.primaryArtists;
  } else if (typeof raw.artist === 'string') {
    artist = raw.artist;
  }

  let language = raw.language || '';

  let artists = [];
  if (raw.artists?.primary?.length) {
    artists = raw.artists.primary.map(a => ({ id: a.id || '', name: a.name || 'Unknown' }));
  } else if (typeof raw.primaryArtists === 'string') {
    artists = raw.primaryArtists.split(',').map(n => ({ id: '', name: n.trim() }));
  } else if (typeof raw.artist === 'string') {
    artists = raw.artist.split(',').map(n => ({ id: '', name: n.trim() }));
  }
  
  let artistString = artists.map(a => a.name).join(', ') || 'Unknown Artist';

  let albumId = '';
  if (raw.album && raw.album.id) {
    albumId = raw.album.id || '';
  }

  return {
    id:        raw.id   || '',
    title:     raw.name || raw.title || 'Unknown',
    artist:    artistString,
    artists:   artists,
    artistId:  artists.length ? artists[0].id : '',
    album:     raw.album?.name || raw.album || '',
    albumId:   albumId,
    image:     image,
    streamUrl: streamUrl,
    duration:  raw.duration || 0,
    language:  language,
  };
}

/* ─────────── Public API Methods ─────────── */

/**
 * Initialise the API — call at startup.
 */
export async function init() {
  return findActiveAPI();
}

/**
 * Get the active API base URL (for display/debugging).
 */
export function getActiveEndpoint() {
  return activeAPI;
}

/**
 * Search all categories by query string.
 */
export async function searchAll(query, limit = 10) {
  if (!query?.trim()) return null;
  const encoded = encodeURIComponent(query);
  const [songsRes, albumsRes, artistsRes] = await Promise.all([
    apiFetch(`/search/songs?query=${encoded}&limit=${limit * 2}`),
    apiFetch(`/search/albums?query=${encoded}&limit=${limit}`),
    apiFetch(`/search/artists?query=${encoded}&limit=${limit}`)
  ]);

  return {
    songs: songsRes?.data?.results?.map(normaliseSong).filter(Boolean) || [],
    albums: albumsRes?.data?.results || [],
    artists: artistsRes?.data?.results || []
  };
}

/**
 * Search songs by query string.
 */
export async function searchSongs(query, limit = 20, page = 1) {
  if (!query?.trim()) return [];
  const data = await apiFetch(`/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`);
  if (!data?.data?.results) return [];
  return data.data.results.map(normaliseSong).filter(Boolean);
}

/**
 * Fetch songs for a pre-defined category / playlist query.
 */
export async function fetchCategorySongs(query, limit = 15) {
  return searchSongs(query, limit);
}

/**
 * Get song details by ID.
 */
export async function getSongById(id) {
  if (!id) return null;
  const data = await apiFetch(`/songs/${id}`);
  if (!data?.data?.length) return null;
  return normaliseSong(data.data[0]);
}

/**
 * Fetch lyrics by song ID or metadata using LRCLIB as primary source.
 */
export async function getLyrics(songId, trackName = '', artistName = '', albumName = '', duration = 0) {
  if (trackName && artistName) {
    try {
      // LRCLIB /get enforces strict duration matching, meaning Mashups/Slowed edits
      // won't accidentally fetch the original song's lyrics.
      let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
      if (albumName) url += `&album_name=${encodeURIComponent(albumName)}`;
      if (duration) url += `&duration=${Math.round(duration)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          return data.syncedLyrics || data.plainLyrics || null;
        }
      }
    } catch { /* ignore fallback to jiosaavn */ }
  }

  if (!songId) return null;
  const data = await apiFetch(`/songs/${songId}/lyrics`);
  if (!data?.data) return null;
  // Handle varying JioSaavn proxy schema
  return data.data.lyrics || data.data.snippet || null;
}

/**
 * Fetch multiple songs by ID array (chunked 10 at a time safely).
 */
export async function getSongsByIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const songs = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const results = await Promise.all(chunk.map(id => getSongById(id)));
    songs.push(...results.filter(Boolean));
  }
  return songs;
}

/**
 * Fetch album details by ID.
 */
export async function getAlbumById(id) {
  if (!id) return null;
  const res = await apiFetch(`/albums?id=${id}`);
  if (!res?.data) return null;
  const albumData = res.data;
  return {
    id: albumData.id,
    name: albumData.name || albumData.title || '',
    image: (Array.isArray(albumData.image) && albumData.image.length > 0) ? 
           (albumData.image.find(i => i.quality === '500x500')?.url || albumData.image[albumData.image.length - 1].url) : 
           (typeof albumData.image === 'string' ? albumData.image : ''),
    songs: Array.isArray(albumData.songs) ? albumData.songs.map(normaliseSong).filter(Boolean) : []
  };
}

/**
 * Fetch artist details by ID.
 */
export async function getArtistById(id) {
  if (!id) return null;
  const res = await apiFetch(`/artists?id=${id}`);
  if (!res?.data) return null;
  const artistData = res.data;
  return {
    id: artistData.id,
    name: artistData.name || artistData.title || '',
    image: (Array.isArray(artistData.image) && artistData.image.length > 0) ? 
           (artistData.image.find(i => i.quality === '500x500')?.url || artistData.image[artistData.image.length - 1].url) : 
           (typeof artistData.image === 'string' ? artistData.image : ''),
    songs: Array.isArray(artistData.topSongs) ? artistData.topSongs.map(normaliseSong).filter(Boolean) : []
  };
}
