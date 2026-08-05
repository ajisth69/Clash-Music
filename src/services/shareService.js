import { uploadPlaylist } from './playlistDb';

export function getShareWorkerUrl() {
  try {
    return localStorage.getItem('clash_share_worker_url') || localStorage.getItem('toon_share_worker_url') || '';
  } catch {
    return '';
  }
}

export function setShareWorkerUrl(url) {
  try {
    if (url) {
      const cleanUrl = url.trim().replace(/\/$/, '');
      localStorage.setItem('clash_share_worker_url', cleanUrl);
    } else {
      localStorage.removeItem('clash_share_worker_url');
      localStorage.removeItem('toon_share_worker_url');
    }
  } catch {}
}

export async function buildShareLink({ type, id, name, artist, tracks, description }) {
  const isWeb = typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1');
  const baseUrl = isWeb ? window.location.origin : 'https://clashmusic.vercel.app';

  if (type === 'song') {
    return `${baseUrl}/?song=${encodeURIComponent(id)}`;
  } else if (type === 'album') {
    return `${baseUrl}/?album=${encodeURIComponent(name)}`;
  } else if (type === 'artist') {
    return `${baseUrl}/?artist=${encodeURIComponent(name)}`;
  } else if (type === 'playlist') {
    // 1. Attempt Upstash Short Link first
    try {
      if (Array.isArray(tracks) && tracks.length > 0) {
        const shortId = await uploadPlaylist({
          name: name || 'My Playlist',
          description: description || 'Shared Playlist',
          tracks: tracks
        });
        if (shortId) {
          return `${baseUrl}/?playlist=${encodeURIComponent(shortId)}`;
        }
      }
    } catch (err) {
      console.warn('Failed to generate shortened playlist URL, falling back to base64 payload:', err);
    }

    // 2. Fallback to stateless base64 pName & pData
    let trackIds = [];
    if (Array.isArray(tracks) && tracks.length > 0) {
      trackIds = tracks.map(t => typeof t === 'object' ? (t.id || t.songId) : t).filter(Boolean);
    } else if (Array.isArray(id)) {
      trackIds = id;
    }
    const pNameStr = encodeURIComponent(name || 'My Playlist');
    const pDataStr = encodeURIComponent(btoa(JSON.stringify(trackIds)));
    return `${baseUrl}/?pName=${pNameStr}&pData=${pDataStr}`;
  }
  return window.location.href;
}

export async function shareItem({ type, id, name, artist, tracks, description }) {
  const shareUrl = await buildShareLink({ type, id, name, artist, tracks, description });
  const title = name ? `${name}${artist ? ` - ${artist}` : ''}` : 'Clash Music';
  const text = `Listen to ${title} on Clash Music!`;

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url: shareUrl
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, method: 'aborted' };
    }
  }

  // Fallback to clipboard copy
  try {
    await navigator.clipboard.writeText(shareUrl);
    return { success: true, method: 'clipboard', url: shareUrl };
  } catch (err) {
    return { success: false, method: 'error', error: err.message };
  }
}
