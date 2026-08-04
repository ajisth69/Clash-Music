// Service for social sharing and link generation

export function getShareWorkerUrl() {
  try {
    return localStorage.getItem('toon_share_worker_url') || '';
  } catch {
    return '';
  }
}

export function setShareWorkerUrl(url) {
  try {
    if (url) {
      const cleanUrl = url.trim().replace(/\/$/, '');
      localStorage.setItem('toon_share_worker_url', cleanUrl);
    } else {
      localStorage.removeItem('toon_share_worker_url');
    }
  } catch {}
}

export function buildShareLink({ type, id, name, artist }) {
  const baseUrl = window.location.origin;

  if (type === 'song') {
    return `${baseUrl}?song=${encodeURIComponent(id)}`;
  } else if (type === 'album') {
    return `${baseUrl}?album=${encodeURIComponent(name)}`;
  } else if (type === 'artist') {
    return `${baseUrl}?artist=${encodeURIComponent(name)}`;
  } else if (type === 'playlist') {
    return `${baseUrl}?playlist=${encodeURIComponent(id)}`;
  }
  return window.location.href;
}

export async function shareItem({ type, id, name, artist }) {
  const shareUrl = buildShareLink({ type, id, name, artist });
  const title = name ? `${name}${artist ? ` - ${artist}` : ''}` : 'ToonTunes';
  const text = `Listen to ${title} on ToonTunes Playful Cartoon Music!`;

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
