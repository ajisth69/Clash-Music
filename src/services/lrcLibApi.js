const LRCLIB_BASE_URL = 'https://lrclib.net/api';

/**
 * Parse LRC string format like:
 * [00:12.34] Lyric line text here
 * [00:15.00] Next line
 * into an array of { time: seconds, text: string }
 */
export function parseLrc(lrcText) {
  if (!lrcText) return [];

  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;
      
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        result.push({ time: timeInSeconds, text });
      }
    }
  }

  // Sort by timestamp
  return result.sort((a, b) => a.time - b.time);
}

/**
 * Fetch synced lyrics from LrcLib API
 */
export async function fetchSyncedLyrics(trackName, artistName, duration) {
  try {
    const cleanTrack = trackName ? trackName.replace(/\(.*\)|\[.*\]/g, '').trim() : '';
    const cleanArtist = artistName ? artistName.split(',')[0].trim() : '';

    // First try exact match with get endpoint
    let url = `${LRCLIB_BASE_URL}/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    if (duration) {
      url += `&duration=${Math.round(duration)}`;
    }

    let response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.syncedLyrics) {
        return {
          synced: true,
          lines: parseLrc(data.syncedLyrics),
          plain: data.plainLyrics || ''
        };
      } else if (data.plainLyrics) {
        return {
          synced: false,
          lines: data.plainLyrics.split('\n').map(text => ({ time: 0, text })),
          plain: data.plainLyrics
        };
      }
    }

    // Fallback: search endpoint if exact get fails
    const searchUrl = `${LRCLIB_BASE_URL}/search?q=${encodeURIComponent(`${cleanTrack} ${cleanArtist}`)}`;
    response = await fetch(searchUrl);
    if (response.ok) {
      const searchData = await response.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        // Find best item with syncedLyrics
        const itemWithSynced = searchData.find(item => item.syncedLyrics) || searchData[0];
        if (itemWithSynced.syncedLyrics) {
          return {
            synced: true,
            lines: parseLrc(itemWithSynced.syncedLyrics),
            plain: itemWithSynced.plainLyrics || ''
          };
        } else if (itemWithSynced.plainLyrics) {
          return {
            synced: false,
            lines: itemWithSynced.plainLyrics.split('\n').map(text => ({ time: 0, text })),
            plain: itemWithSynced.plainLyrics
          };
        }
      }
    }

    return { synced: false, lines: [], plain: 'No lyrics available for this song.' };
  } catch (err) {
    console.error('Error fetching lyrics from LrcLib:', err);
    return { synced: false, lines: [], plain: 'Could not load lyrics.' };
  }
}
