const BASE_URL = 'https://jiosavan.clashgram.workers.dev/api';

// In-Memory Fast Cache for Artist & Album Pages (0ms instant re-loads)
const artistCache = new Map();
const albumCache = new Map();

// Helper to decode HTML entities
function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Helper to normalize artist name key (removes dots, extra spaces)
export function normalizeArtistKey(name) {
  if (!name) return '';
  return name.replace(/\./g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Format track output for app consumption
export function formatTrack(raw) {
  if (!raw) return null;
  
  // Extract high quality image
  let image = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  if (Array.isArray(raw.image) && raw.image.length > 0) {
    const bestImg = raw.image.find(i => i.quality === '500x500') || raw.image[raw.image.length - 1];
    image = bestImg?.url || image;
  }

  // Extract direct download/stream audio URLs
  let streamUrl = '';
  let downloadUrls = [];
  if (Array.isArray(raw.downloadUrl) && raw.downloadUrl.length > 0) {
    downloadUrls = raw.downloadUrl;
    const bestStream = raw.downloadUrl.find(d => d.quality === '320kbps') || 
                       raw.downloadUrl.find(d => d.quality === '160kbps') || 
                       raw.downloadUrl[raw.downloadUrl.length - 1];
    streamUrl = bestStream?.url || '';
  }

  // Extract primary artists name string
  let artistName = 'Unknown Artist';
  if (typeof raw.artists === 'string') {
    artistName = raw.artists;
  } else if (raw.artists?.primary && Array.isArray(raw.artists.primary)) {
    artistName = raw.artists.primary.map(a => a.name).join(', ');
  } else if (raw.artists?.all && Array.isArray(raw.artists.all)) {
    artistName = raw.artists.all.map(a => a.name).join(', ');
  } else if (raw.primaryArtists) {
    artistName = raw.primaryArtists;
  }

  return {
    id: raw.id || String(Math.random()),
    name: cleanText(raw.name || raw.title || 'Untitled Song'),
    artist: cleanText(artistName),
    album: cleanText(raw.album?.name || raw.album || 'Single'),
    albumId: raw.album?.id || raw.albumId || '',
    duration: raw.duration ? Number(raw.duration) : 180,
    image: image.replace('http://', 'https://'),
    streamUrl: streamUrl.replace('http://', 'https://'),
    downloadUrls: downloadUrls,
    year: raw.year || '',
    language: raw.language || '',
    playCount: raw.playCount || 0
  };
}

// 1. Search Songs
export async function searchSongs(query, page = 1, limit = 40) {
  try {
    const res = await fetch(`${BASE_URL}/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    const json = await res.json();
    if (json.success && json.data?.results) {
      return json.data.results.map(formatTrack);
    }
    return [];
  } catch (err) {
    console.error('Error searching songs:', err);
    return [];
  }
}

// 2. Search Albums
export async function searchAlbums(query) {
  try {
    const res = await fetch(`${BASE_URL}/search/albums?query=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json.success && json.data?.results) {
      return json.data.results.map(item => ({
        id: item.id,
        name: cleanText(item.name),
        artist: cleanText(item.artists?.primary?.[0]?.name || 'Various Artists'),
        year: item.year,
        image: item.image?.[item.image.length - 1]?.url?.replace('http://', 'https://') || ''
      }));
    }
    return [];
  } catch (err) {
    console.error('Error searching albums:', err);
    return [];
  }
}

// 3. Search Artists
export async function searchArtists(query) {
  try {
    const res = await fetch(`${BASE_URL}/search/artists?query=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json.success && json.data?.results) {
      return json.data.results.map(item => ({
        id: item.id,
        name: cleanText(item.name),
        role: item.role || 'Artist',
        image: item.image?.[item.image.length - 1]?.url?.replace('http://', 'https://') || ''
      }));
    }
    return [];
  } catch (err) {
    console.error('Error searching artists:', err);
    return [];
  }
}

// 4. Get Song Details by ID
export async function getSongById(id) {
  try {
    const res = await fetch(`${BASE_URL}/songs?ids=${id}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return formatTrack(json.data[0]);
    }
    return null;
  } catch (err) {
    console.error('Error getting song by ID:', err);
    return null;
  }
}

// 5. Get Trending Songs
export async function getTrendingSongs() {
  try {
    const tracks = await searchSongs('Top Bollywood Hits', 1, 20);
    if (tracks.length > 0) return tracks;
    return await searchSongs('Arijit Singh', 1, 20);
  } catch (err) {
    console.error('Error fetching trending songs:', err);
    return [];
  }
}

// 6. Get Official Registered Artist Page Data (PARALLEL PROMISE FETCH & IN-MEMORY CACHED FOR MAXIMUM SPEED)
export async function getArtistFullData(artistName) {
  const normKey = normalizeArtistKey(artistName);

  // 1. Instant Cache Hit (0ms load time)
  if (artistCache.has(normKey)) {
    return artistCache.get(normKey);
  }

  try {
    // 2. Parallel Promises: Fetch artist profile search AND Page 1 songs simultaneously
    const [searchRes, page1Songs, page2Songs] = await Promise.all([
      searchArtists(artistName),
      searchSongs(artistName, 1, 40),
      searchSongs(artistName, 2, 40)
    ]);

    // Verified artist MUST match name AND have an official headshot URL (/artists/)
    const exactMatch = Array.isArray(searchRes) ? searchRes.find(r => {
      const resKey = normalizeArtistKey(r.name);
      const hasOfficialHeadshot = r.image && r.image.includes('/artists/');
      return resKey === normKey && hasOfficialHeadshot;
    }) : null;

    if (!exactMatch) {
      const unverifiedResult = {
        artistInfo: { id: '', name: artistName, image: null, isVerified: false },
        songs: []
      };
      artistCache.set(normKey, unverifiedResult);
      return unverifiedResult;
    }

    const artistInfo = {
      id: exactMatch.id || '',
      name: cleanText(exactMatch.name),
      image: exactMatch.image,
      role: exactMatch.role || 'Artist',
      isVerified: true
    };

    // Deduplicate songs
    const songMap = new Map();
    [...page1Songs, ...page2Songs].forEach(song => {
      if (song && song.id && !songMap.has(song.id)) {
        songMap.set(song.id, song);
      }
    });

    const result = {
      artistInfo,
      songs: Array.from(songMap.values())
    };

    // Save to Cache for 0ms future re-opens
    artistCache.set(normKey, result);
    return result;
  } catch (err) {
    return {
      artistInfo: { id: '', name: artistName, image: null, isVerified: false },
      songs: []
    };
  }
}

// 7. Get Official Registered Album Page Data (PARALLEL FETCH & CACHED)
export async function getAlbumFullData(albumNameOrId) {
  const normKey = typeof albumNameOrId === 'string' ? albumNameOrId.toLowerCase().trim() : String(albumNameOrId);

  // 1. Instant Cache Hit
  if (albumCache.has(normKey)) {
    return albumCache.get(normKey);
  }

  try {
    let albumId = albumNameOrId;
    let fallbackInfo = null;

    if (isNaN(albumNameOrId) && typeof albumNameOrId === 'string') {
      const searchRes = await searchAlbums(albumNameOrId);
      const key = albumNameOrId.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

      const exactMatch = searchRes.find(r => {
        const resKey = r.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        return resKey === key;
      });

      if (exactMatch) {
        albumId = exactMatch.id;
        fallbackInfo = exactMatch;
      } else {
        const invalidResult = {
          albumInfo: { id: '', name: albumNameOrId, isVerified: false },
          songs: []
        };
        albumCache.set(normKey, invalidResult);
        return invalidResult;
      }
    }

    const res = await fetch(`${BASE_URL}/albums?id=${albumId}`);
    const json = await res.json();

    if (json.success && json.data && json.data.id) {
      const rawSongs = json.data.songs || [];
      const songs = rawSongs.map(formatTrack);
      const result = {
        albumInfo: {
          id: json.data.id,
          name: cleanText(json.data.name),
          artist: cleanText(json.data.artists?.primary?.[0]?.name || json.data.artist || 'Various Artists'),
          image: json.data.image?.[json.data.image.length - 1]?.url?.replace('http://', 'https://') || fallbackInfo?.image || '',
          year: json.data.year || '',
          isVerified: true
        },
        songs
      };
      albumCache.set(normKey, result);
      return result;
    }

    return {
      albumInfo: { id: '', name: albumNameOrId, isVerified: false },
      songs: []
    };
  } catch (err) {
    return {
      albumInfo: { id: '', name: albumNameOrId, isVerified: false },
      songs: []
    };
  }
}
