import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { saveLocalSongs } from './localMusicService';
import { getDisplayImage } from './musicApi';

// Register native Android MediaStore Public Downloads Plugin
const PublicDownloads = registerPlugin('PublicDownloads');

// Helper to sanitize filenames for OS compatibility
function sanitizeFilename(name) {
  if (!name) return 'Track';
  return name.replace(/[/\\?%*:|"<>]/g, '').trim();
}

/**
 * Helper to fetch a remote image URL and convert it to a persistent base64 data URL for offline storage
 */
async function fetchImageAsBase64(url) {
  if (!url || typeof url !== 'string' || url.startsWith('data:') || url.startsWith('blob:') || url.includes('/logo.png')) {
    return url;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return url;
  }
}

/**
 * Helper to auto-register a downloaded song blob into local IndexedDB with full metadata & thumbnail
 */
async function registerDownloadedTrack(track, mp3Blob, cleanTitle, cleanArtist) {
  try {
    const rawCoverUrl = getDisplayImage(track);
    const coverUrl = await fetchImageAsBase64(rawCoverUrl);

    const songTitle = track.name || track.title || cleanTitle;
    const artistName = typeof track.artist === 'string'
      ? track.artist
      : (track.artist?.name || track.artists?.primary?.[0]?.name || track.subtitle || cleanArtist);
    const albumName = typeof track.album === 'string'
      ? track.album
      : (track.album?.name || 'Downloaded Songs');
    const songDuration = track.duration || 0;

    const localRecord = {
      id: 'local_dl_' + (track.id || Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
      title: songTitle,
      name: songTitle,
      artist: artistName,
      album: albumName,
      fileBlob: mp3Blob,
      sizeBytes: mp3Blob.size,
      fileSize: (mp3Blob.size / (1024 * 1024)).toFixed(2) + ' MB',
      duration: songDuration,
      isLocal: true,
      coverUrl: coverUrl && coverUrl !== '/logo.png' ? coverUrl : null,
      hasCover: !!(coverUrl && coverUrl !== '/logo.png'),
      image: coverUrl ? [{ url: coverUrl }, { url: coverUrl }] : [{ url: '/logo.png' }],
      addedAt: Date.now()
    };
    await saveLocalSongs([localRecord]);
  } catch (err) {
    console.warn('Failed to auto-register downloaded song to local library:', err);
  }
}

/**
 * Saves a Blob file directly into Android system MediaStore Downloads folder (on native)
 * or via browser download prompt (on web).
 */
async function saveBlobFile(blob, fileName, onProgress = null) {
  if (Capacitor.isNativePlatform()) {
    try {
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
      const totalSize = blob.size;
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      const mimeType = fileName.endsWith('.zip') ? 'application/zip' : 'audio/mpeg';

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkBlob = blob.slice(start, end);

        const chunkBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result;
            const base64 = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(chunkBlob);
        });

        const isFirst = i === 0;
        const isLast = i === totalChunks - 1;

        if (onProgress && totalChunks > 1) {
          const writePct = 85 + Math.round(((i + 1) / totalChunks) * 15);
          onProgress(writePct, `Saving ${fileName} to system Downloads (${i + 1}/${totalChunks})...`);
        }

        const res = await PublicDownloads.saveChunkedToPublicDownloads({
          fileName,
          chunkBase64,
          isFirst,
          isLast,
          mimeType,
        });

        if (isLast && res && (res.success || res.uri || res.path)) {
          return;
        }
      }
      return;
    } catch (err) {
      console.warn('Native Android chunked Downloads folder save error, falling back to web saveAs:', err);
    }
  }

  saveAs(blob, fileName);
}

/**
 * Downloads a single track audio file strictly as a .mp3 file
 */
export async function downloadSingleSong(track, onProgress = null, abortSignal = null) {
  if (!track || !track.streamUrl) {
    throw new Error('No audio stream URL available for download.');
  }

  const cleanTitle = sanitizeFilename(track.name);
  const cleanArtist = sanitizeFilename(track.artist);
  const fileName = `${cleanTitle} - ${cleanArtist}.mp3`;

  try {
    if (onProgress) onProgress(15, 'Fetching MP3 audio stream...');
    const response = await fetch(track.streamUrl, { signal: abortSignal });
    if (!response.ok) throw new Error('Failed to fetch audio stream');

    const arrayBuffer = await response.arrayBuffer();
    const mp3Blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

    if (onProgress) onProgress(80, 'Saving MP3 to Downloads & Local Library...');
    await saveBlobFile(mp3Blob, fileName, onProgress);
    await registerDownloadedTrack(track, mp3Blob, cleanTitle, cleanArtist);

    if (onProgress) onProgress(100, 'Saved to Downloads folder & Local Library!');
  } catch (err) {
    if (err.name === 'AbortError' || abortSignal?.aborted) {
      throw new Error('Download cancelled');
    }
    console.warn('Direct fetch failed, using MP3 download fallback link:', err);
    
    const link = document.createElement('a');
    link.href = track.streamUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (onProgress) onProgress(100, 'Downloaded via direct MP3 link!');
  }
}

/**
 * Downloads multiple tracks in a playlist/artist collection as a single .zip file containing strictly .mp3 files
 */
export async function downloadPlaylistAsZip(playlistName, tracks, onProgress = null, abortSignal = null) {
  if (!tracks || tracks.length === 0) {
    throw new Error('No tracks available to download.');
  }

  const zip = new JSZip();
  const folderName = sanitizeFilename(playlistName) || 'Music Collection';
  const folder = zip.folder(folderName);
  let completed = 0;

  for (let i = 0; i < tracks.length; i++) {
    if (abortSignal?.aborted) {
      throw new Error('Download cancelled');
    }

    const track = tracks[i];
    const cleanTitle = sanitizeFilename(track.name);
    const cleanArtist = sanitizeFilename(track.artist);
    const trackFileName = `${i + 1}. ${cleanTitle} - ${cleanArtist}.mp3`;

    if (onProgress) {
      const pct = Math.round((completed / tracks.length) * 70);
      onProgress(pct, `Packaging MP3 track ${i + 1} of ${tracks.length}: ${track.name}`);
    }

    try {
      if (track.streamUrl) {
        const response = await fetch(track.streamUrl, { signal: abortSignal });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const mp3Blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
          folder.file(trackFileName, mp3Blob);
          await registerDownloadedTrack(track, mp3Blob, cleanTitle, cleanArtist);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortSignal?.aborted) {
        throw new Error('Download cancelled');
      }
      console.warn(`Could not download track ${track.name}:`, err);
    }
    completed++;
  }

  if (abortSignal?.aborted) {
    throw new Error('Download cancelled');
  }

  if (onProgress) onProgress(75, 'Packaging ZIP archive...');
  // Use compression: 'STORE' to bypass heavy CPU/RAM re-compression on already compressed MP3 files
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

  if (abortSignal?.aborted) {
    throw new Error('Download cancelled');
  }

  const zipFileName = `${folderName}.zip`;
  await saveBlobFile(zipBlob, zipFileName, onProgress);
  if (onProgress) onProgress(100, 'MP3 ZIP Archive saved to Downloads!');
}
