// api.js — Clash Musics Backend Node.js API client

// All API requests now go through our Node.js backend proxy at /api/*
// This prevents CORS issues entirely and avoids reliance on unstable public proxies.

const API_BASE = '/api';

// core fetch
async function apiFetch(path, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[API] ${res.status} from backend for ${path}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    console.error(`[API] Network error fetching ${path}:`, e.message);
    return null;
  }
}

// lowest level fetch — removed, apiFetch handles it all now

// public helper — no longer needed since backend handles CORS
function buildUrl(url) {
  return url;
}

// normalize the raw API response into a consistent shape
export function normaliseSong(raw) {
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

// --- public API ---

export async function init() {
  console.log('[API] Using Node.js Backend API Proxy');
  return true;
}

export function getActiveEndpoint() {
  return API_BASE;
}

// exported so ui.js can proxy stream/download URLs through the same CORS proxy
export { buildUrl as proxyUrl };

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

export async function searchSongs(query, limit = 20, page = 1) {
  if (!query?.trim()) return [];
  const data = await apiFetch(`/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`);
  if (!data?.data?.results) return [];
  return data.data.results.map(normaliseSong).filter(Boolean);
}

export async function fetchCategorySongs(query, limit = 15) {
  return searchSongs(query, limit);
}

export async function getSongById(id) {
  if (!id) return null;
  const data = await apiFetch(`/songs/${id}`);
  if (!data?.data?.length) return null;
  return normaliseSong(data.data[0]);
}

// tries LRCLIB first (better for mashups/edits since it checks duration),
// falls back to jiosaavn lyrics endpoint
export async function getLyrics(songId, trackName = '', artistName = '', albumName = '', duration = 0) {
  if (trackName && artistName) {
    try {
      let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
      if (albumName) url += `&album_name=${encodeURIComponent(albumName)}`;
      if (duration) url += `&duration=${Math.round(duration)}`;

      const res = await fetch(buildUrl(url));
      if (res.ok) {
        const data = await res.json();
        if (data) {
          return data.syncedLyrics || data.plainLyrics || null;
        }
      }
    } catch { /* fall through to jiosaavn */ }
  }

  if (!songId) return null;
  const data = await apiFetch(`/songs/${songId}/lyrics`);
  if (!data?.data) return null;
  return data.data.lyrics || data.data.snippet || null;
}

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

export async function getArtistById(id) {
  if (!id) return null;
  // high songCount to get a decent discography instead of the default 5-10
  const res = await apiFetch(`/artists?id=${id}&songCount=100&albumCount=50`);
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
