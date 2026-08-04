import { getShareWorkerUrl } from './shareService';
import { searchSongs } from './jiosaavnApi';

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parens and contents
    .replace(/\[.*?\]/g, '') // remove brackets and contents
    .replace(/[^a-z0-9\s]/g, '') // remove special chars
    .trim()
    .replace(/\s+/g, ' '); // collapse spaces
}

function isExactMatch(targetTitle, targetArtist, resultSong) {
  const normTargetTitle = normalizeText(targetTitle);
  // resultSong is mapped by formatTrack so it has .name and .artist
  const normResultTitle = normalizeText(resultSong.name);
  
  if (!normTargetTitle || !normResultTitle) return false;

  // Check if titles are very similar
  const titleMatches = normTargetTitle === normResultTitle || 
                       normResultTitle.includes(normTargetTitle) || 
                       normTargetTitle.includes(normResultTitle);
  
  if (!titleMatches) return false;

  // If artist is provided, verify at least one artist matches
  if (targetArtist) {
    const targetArtists = targetArtist.split(/[,&]| and /i).map(a => normalizeText(a)).filter(a => a.length > 1);
    
    // resultSong has .artist which is a formatted string
    let resultArtistsStr = normalizeText(resultSong.artist);

    if (targetArtists.length > 0 && resultArtistsStr) {
      const hasArtistMatch = targetArtists.some(artist => resultArtistsStr.includes(artist) || artist.includes(resultArtistsStr));
      if (!hasArtistMatch) return false;
    }
  }
  
  return true;
}

function getApiBase() {
  const workerUrl = getShareWorkerUrl();
  return workerUrl ? workerUrl.replace(/\/$/, '') : 'https://music.clashgram.workers.dev';
}

/**
 * Fetch raw track data from a Spotify playlist URL using the worker.
 * @param {string} spotifyUrl - The Spotify playlist URL.
 * @returns {Promise<{name: string, tracks: Array<{songName: string, artistName: string, image: string}>}>}
 */
export async function fetchSpotifyTracks(spotifyUrl) {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/spotify?url=${encodeURIComponent(spotifyUrl)}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Failed to fetch Spotify playlist');
  }
  return { name: json.name, tracks: json.tracks };
}

/**
 * Match a list of Spotify tracks against JioSaavn API and return the matched playable songs.
 * @param {Array<{songName: string, artistName: string}>} spotifyTracks - The raw tracks.
 * @param {Function} onProgress - Callback fired after each track is processed: (currentCount, totalCount)
 * @returns {Promise<Array<Object>>} The array of matched JioSaavn song objects.
 */
export async function matchTracksToJiosaavn(spotifyTracks, onProgress) {
  const matchedSongs = [];
  const total = spotifyTracks.length;

  // We'll process them in small batches to avoid hitting API limits too hard
  const BATCH_SIZE = 5;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = spotifyTracks.slice(i, i + BATCH_SIZE);
    
    // Process batch concurrently
    const batchPromises = batch.map(async (track) => {
      try {
        const query = `${track.songName} ${track.artistName}`.trim();
        const results = await searchSongs(query);
        
        if (results && results.length > 0) {
          // Find the best exact match instead of just taking the first random result
          const bestMatch = results.find(res => isExactMatch(track.songName, track.artistName, res));
          if (bestMatch) {
            return bestMatch;
          }
        }
      } catch (err) {
        console.error(`Failed to match track: ${track.songName}`, err);
      }
      return null;
    });

    const results = await Promise.all(batchPromises);
    for (const r of results) {
      if (r) matchedSongs.push(r);
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, total), total);
    }
  }

  return matchedSongs;
}
