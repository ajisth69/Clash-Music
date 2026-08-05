import { getShareWorkerUrl } from './shareService';

function getApiBase() {
  const workerUrl = getShareWorkerUrl();
  return workerUrl ? workerUrl.replace(/\/$/, '') : 'https://music.clashgram.workers.dev';
}

export async function uploadPlaylist(playlist) {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
