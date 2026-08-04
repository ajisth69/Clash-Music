import { getShareWorkerUrl } from './shareService';

// Fallback to localhost during dev, or deployed worker in production
function getApiBase() {
  const workerUrl = getShareWorkerUrl();
  return workerUrl ? workerUrl.replace(/\/$/, '') : 'https://music.clashgram.workers.dev';
}

/**
 * Upload a playlist to the Cloudflare Worker which securely stores it in Upstash Redis.
 * @param {Object} playlist - The playlist object (name, description, tracks).
 * @returns {Promise<string>} The generated short ID.
 */
export async function uploadPlaylist(playlist) {
  try {
    const apiBase = getApiBase();
    
    const res = await fetch(`${apiBase}/api/playlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(playlist)
    });
    
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to upload playlist');
    }
    
    return json.id;
  } catch (err) {
    console.error('Failed to upload playlist:', err);
    throw err;
  }
}

/**
 * Fetch a playlist by its short ID from the Cloudflare Worker (Upstash Redis).
 * @param {string} shortId - The playlist ID to fetch.
 * @returns {Promise<Object|null>} The playlist object, or null if not found.
 */
export async function fetchPlaylist(shortId) {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/playlist?id=${encodeURIComponent(shortId)}`);
    
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch playlist');
    }
    
    return json.data;
  } catch (err) {
    console.error('Failed to fetch playlist:', err);
    return null;
  }
}
