import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Helper to sanitize filenames for OS compatibility
function sanitizeFilename(name) {
  if (!name) return 'Track';
  return name.replace(/[/\\?%*:|"<>]/g, '').trim();
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

    if (onProgress) onProgress(90, 'Saving MP3 file...');
    saveAs(mp3Blob, fileName);
    if (onProgress) onProgress(100, 'Downloaded!');
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
    // Check if user clicked cancel
    if (abortSignal?.aborted) {
      throw new Error('Download cancelled');
    }

    const track = tracks[i];
    const cleanTitle = sanitizeFilename(track.name);
    const cleanArtist = sanitizeFilename(track.artist);
    const trackFileName = `${i + 1}. ${cleanTitle} - ${cleanArtist}.mp3`;

    if (onProgress) {
      const pct = Math.round((completed / tracks.length) * 85);
      onProgress(pct, `Packaging MP3 track ${i + 1} of ${tracks.length}: ${track.name}`);
    }

    try {
      if (track.streamUrl) {
        const response = await fetch(track.streamUrl, { signal: abortSignal });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const mp3Blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
          folder.file(trackFileName, mp3Blob);
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

  if (onProgress) onProgress(90, 'Compressing MP3 ZIP archive...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  if (abortSignal?.aborted) {
    throw new Error('Download cancelled');
  }

  saveAs(zipBlob, `${folderName}.zip`);
  if (onProgress) onProgress(100, 'MP3 ZIP Archive downloaded!');
}
