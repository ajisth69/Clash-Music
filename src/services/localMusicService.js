import { Capacitor, registerPlugin } from '@capacitor/core';

const LocalAudioScanner = registerPlugin('LocalAudioScanner');

const DB_NAME = 'ToonTunesLocalMusicDB_v4';
const PREVIOUS_DB_NAMES = [
  'ToonTunesLocalMusicDB_v3',
  'ToonTunesLocalMusicDB_v2',
  'ToonTunesLocalMusicDB',
];
const DB_VERSION = 1;
const STORE_SONGS = 'local_songs';
const STORE_DIRECTORIES = 'saved_directories';

const SUPPORTED_EXTENSIONS = [
  '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.webm', '.wma',
  '.aiff', '.aif', '.aifc', '.alac', '.mp4', '.m4b', '.m4p', '.m4r',
  '.3gp', '.3gpp', '.amr', '.oga', '.ogv', '.ogx', '.spx', '.caf', '.mid', '.midi'
];

/**
 * Converts a content:// URI to a playable URL for the WebView.
 * On Android, Capacitor's convertFileSrc() rewrites content:// and file:// URIs
 * to https://localhost/_capacitor_content_/ or https://localhost/_capacitor_file_/
 * which the WebView can access. On web, returns the URL as-is.
 */
export function ensurePlayableUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  // Already a blob: or data: URL - works as-is
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  // On native platforms, convert content:// and file:// URIs
  if (Capacitor.isNativePlatform()) {
    if (url.startsWith('content://') || url.startsWith('file://')) {
      try {
        return Capacitor.convertFileSrc(url);
      } catch (e) {
        console.warn('convertFileSrc failed for:', url, e);
        return url;
      }
    }
  }
  
  return url;
}

export async function scanDeviceAudioNative() {
  if (Capacitor.isNativePlatform()) {
    try {
      if (LocalAudioScanner.requestAudioPermission) {
        const permRes = await LocalAudioScanner.requestAudioPermission().catch(() => null);
        if (permRes && permRes.granted === false) {
          console.warn('Audio permission was not granted by user');
        }
      }
      const res = await LocalAudioScanner.scanDeviceAudio();
      if (res && res.tracks && Array.isArray(res.tracks)) {
        const songs = res.tracks.map((t) => {
          // Convert content:// URIs for WebView playback
          const playableUrl = ensurePlayableUrl(t.url || t.streamUrl || t.downloadUrl);
          const coverUrl = t.coverUrl ? ensurePlayableUrl(t.coverUrl) : null;
          return {
            ...t,
            url: playableUrl,
            streamUrl: playableUrl,
            downloadUrl: playableUrl,
            coverUrl: coverUrl,
            fileSize: t.sizeBytes ? (t.sizeBytes / (1024 * 1024)).toFixed(2) + ' MB' : '0 MB',
            image: coverUrl ? [{ url: coverUrl }, { url: coverUrl }] : [{ url: '/logo.png' }],
            hasCover: !!t.coverUrl,
            bitrate: 'Local Audio',
            format: 'AUDIO',
            addedAt: Date.now()
          };
        });
        if (songs.length > 0) {
          await saveLocalSongs(songs);
        }
        return songs;
      }
    } catch (e) {
      console.warn('Native MediaStore scan error:', e);
    }
  }
  return null;
}

/**
 * Auto-scan device music on native platform.
 * Called automatically on app launch - no folder selection needed.
 * Like every music player - scans all audio on the device.
 */
export async function autoScanDeviceMusic() {
  if (!Capacitor.isNativePlatform()) return null;
  
  try {
    const scanned = await scanDeviceAudioNative();
    if (scanned && scanned.length > 0) {
      return scanned;
    }
  } catch (e) {
    console.warn('Auto-scan device music error:', e);
  }
  return null;
}

export async function checkPendingAudioIntent() {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalAudioScanner.getPendingAudioIntent();
      if (res && res.song) {
        // Convert content:// URI for WebView playback
        const song = res.song;
        const playableUrl = ensurePlayableUrl(song.url || song.streamUrl || song.downloadUrl);
        return {
          ...song,
          url: playableUrl,
          streamUrl: playableUrl,
          downloadUrl: playableUrl,
          image: [{ url: '/logo.png' }, { url: '/logo.png' }],
          hasCover: false,
          bitrate: 'External Audio',
          format: 'AUDIO'
        };
      }
    } catch (e) {
      console.warn('Pending intent check error:', e);
    }
  }
  return null;
}

export function listenToAudioIntent(callback) {
  if (Capacitor.isNativePlatform()) {
    try {
      return LocalAudioScanner.addListener('onAudioIntentReceived', (song) => {
        if (song && callback) {
          const playableUrl = ensurePlayableUrl(song.url || song.streamUrl || song.downloadUrl);
          callback({
            ...song,
            url: playableUrl,
            streamUrl: playableUrl,
            downloadUrl: playableUrl,
            image: [{ url: '/logo.png' }, { url: '/logo.png' }],
            hasCover: false,
            bitrate: 'External Audio',
            format: 'AUDIO'
          });
        }
      });
    } catch (e) {
      console.warn('Listen to audio intent error:', e);
    }
  }
  return null;
}


/**
 * Creates a codec-typed Blob Object URL for HTML5 Audio element.
 * Crucial for .opus, .flac, .ogg, .aac, and untyped files picked from local disk or IndexedDB.
 */
export function createPlayableBlobUrl(file, filenameHint = '', mimeTypeOverride = null) {
  if (!file) return null;

  if (mimeTypeOverride) {
    try {
      return URL.createObjectURL(new Blob([file], { type: mimeTypeOverride }));
    } catch (e) {
      return URL.createObjectURL(file);
    }
  }

  const nameStr = file.name || filenameHint || (typeof file === 'object' ? file.filePath || file.title || file.format || '' : '');
  const ext = nameStr.split('.').pop().toLowerCase();

  let type = file.type;

  // If file already has a specific codec/container MIME type, retain it!
  if (type && type !== 'application/octet-stream' && type !== 'binary/octet-stream') {
    if (type === 'audio/opus') {
      type = 'audio/ogg; codecs=opus';
    } else {
      try {
        return URL.createObjectURL(file);
      } catch (e) {}
    }
  }

  if (!type || type === 'application/octet-stream' || type === 'binary/octet-stream') {
    if (ext === 'opus') type = 'audio/ogg; codecs=opus';
    else if (ext === 'ogg' || ext === 'oga' || ext === 'spx') type = 'audio/ogg; codecs=opus';
    else if (ext === 'flac') type = 'audio/flac';
    else if (ext === 'mp3' || ext === 'mp2') type = 'audio/mpeg';
    else if (ext === 'm4a' || ext === 'aac' || ext === 'mp4' || ext === 'm4b' || ext === 'm4r' || ext === 'alac') type = 'audio/mp4';
    else if (ext === 'wav') type = 'audio/wav';
    else if (ext === 'aiff' || ext === 'aif' || ext === 'aifc') type = 'audio/aiff';
    else if (ext === 'webm') type = 'audio/webm; codecs=opus';
    else if (ext === 'wma') type = 'audio/x-ms-wma';
    else if (ext === 'amr') type = 'audio/amr';
    else if (ext === '3gp' || ext === '3gpp') type = 'audio/3gpp';
    else if (ext === 'caf') type = 'audio/x-caf';
    else if (ext === 'mid' || ext === 'midi') type = 'audio/midi';
    else type = 'audio/mpeg';
  }

  try {
    const typedBlob = new Blob([file], { type });
    return URL.createObjectURL(typedBlob);
  } catch (e) {
    return URL.createObjectURL(file);
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DIRECTORIES)) {
        db.createObjectStore(STORE_DIRECTORIES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Migration helper: runs ONCE per session. Copies records from older DBs then deletes them.
 */
let _migrationDone = false;
async function migrateOldDatabases(targetDb) {
  if (_migrationDone) return;
  _migrationDone = true;

  for (const oldDbName of PREVIOUS_DB_NAMES) {
    try {
      const oldReq = indexedDB.open(oldDbName);
      const oldDb = await new Promise((res) => {
        oldReq.onsuccess = () => res(oldReq.result);
        oldReq.onerror = () => res(null);
      });
      if (!oldDb) continue;

      if (oldDb.objectStoreNames.contains(STORE_SONGS)) {
        const songs = await new Promise((res) => {
          const tx = oldDb.transaction(STORE_SONGS, 'readonly');
          const store = tx.objectStore(STORE_SONGS);
          const req = store.getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => res([]);
        });

        if (songs.length > 0) {
          const tx = targetDb.transaction(STORE_SONGS, 'readwrite');
          const store = tx.objectStore(STORE_SONGS);
          songs.forEach((s) => store.put(s));
        }
      }

      if (oldDb.objectStoreNames.contains(STORE_DIRECTORIES)) {
        const dirs = await new Promise((res) => {
          const tx = oldDb.transaction(STORE_DIRECTORIES, 'readonly');
          const store = tx.objectStore(STORE_DIRECTORIES);
          const req = store.getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => res([]);
        });

        if (dirs.length > 0) {
          const tx = targetDb.transaction(STORE_DIRECTORIES, 'readwrite');
          const store = tx.objectStore(STORE_DIRECTORIES);
          dirs.forEach((d) => store.put(d));
        }
      }
      oldDb.close();
      // Delete the legacy database so it never re-imports
      try { indexedDB.deleteDatabase(oldDbName); } catch (e) {}
    } catch (err) {}
  }
}

/**
 * Fallback parser for audio filenames
 */
export function parseAudioFilename(filename) {
  const cleanName = filename.replace(/\.[^/.]+$/, '');
  if (cleanName.includes(' - ')) {
    const parts = cleanName.split(' - ');
    return {
      title: parts.slice(1).join(' - ').trim(),
      artist: parts[0].trim(),
      album: 'Local Collection',
    };
  }
  return {
    title: cleanName.replace(/_/g, ' ').trim(),
    artist: 'Local Artist',
    album: 'Local Collection',
  };
}

/**
 * Reads binary tags from MP3 (ID3v2) and FLAC (METADATA_BLOCK_PICTURE & VORBIS_COMMENT)
 */
async function parseBinaryTags(file) {
  const fallback = parseAudioFilename(file.name);
  const ext = file.name.split('.').pop().toLowerCase();

  try {
    const sliceSize = Math.min(file.size, 4 * 1024 * 1024);
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let title = fallback.title;
    let artist = fallback.artist;
    let album = fallback.album;
    let coverUrl = null;
    let isFlac = ext === 'flac';

    // 1. FLAC METADATA PARSER ('fLaC' signature: 0x66 0x4C 0x61 0x43)
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      isFlac = true;
      let offset = 4;

      while (offset + 4 <= bytes.length) {
        const headerByte = bytes[offset];
        const isLast = (headerByte & 0x80) !== 0;
        const blockType = headerByte & 0x7f;
        const blockLength =
          (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];

        offset += 4;
        if (offset + blockLength > bytes.length) break;

        // Block Type 4: VORBIS_COMMENT
        if (blockType === 4) {
          try {
            let p = offset;
            const vendorLen =
              bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
            p += 4 + vendorLen;

            const commentCount =
              bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
            p += 4;

            const decoder = new TextDecoder('utf-8');
            for (let i = 0; i < commentCount; i++) {
              if (p + 4 > offset + blockLength) break;
              const commentLen =
                bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
              p += 4;

              if (p + commentLen > offset + blockLength) break;
              const commentStr = decoder.decode(bytes.subarray(p, p + commentLen));
              p += commentLen;

              const eqIdx = commentStr.indexOf('=');
              if (eqIdx !== -1) {
                const key = commentStr.substring(0, eqIdx).toUpperCase();
                const val = commentStr.substring(eqIdx + 1).trim();
                if (val) {
                  if (key === 'TITLE') title = val;
                  if (key === 'ARTIST') artist = val;
                  if (key === 'ALBUM') album = val;
                }
              }
            }
          } catch (e) {}
        }

        // Block Type 6: PICTURE
        if (blockType === 6 && !coverUrl) {
          try {
            let p = offset + 4;
            const mimeLen =
              (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
            p += 4;

            let mime = '';
            for (let i = 0; i < mimeLen; i++) {
              mime += String.fromCharCode(bytes[p + i]);
            }
            p += mimeLen;

            const descLen =
              (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
            p += 4 + descLen;

            p += 16;

            const imgLen =
              (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
            p += 4;

            if (p + imgLen <= offset + blockLength) {
              const imgData = bytes.subarray(p, p + imgLen);
              let binaryStr = '';
              const chunkSize = 8192;
              for (let i = 0; i < imgData.length; i += chunkSize) {
                binaryStr += String.fromCharCode.apply(
                  null,
                  imgData.subarray(i, i + chunkSize)
                );
              }
              const mimeType = mime || 'image/jpeg';
              coverUrl = `data:${mimeType};base64,${btoa(binaryStr)}`;
            }
          } catch (e) {}
        }

        offset += blockLength;
        if (isLast) break;
      }
    }

    // 2. MP3 ID3v2 PARSER
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      let offset = 10;
      const totalHeaderSize =
        ((bytes[6] & 0x7f) << 21) |
        ((bytes[7] & 0x7f) << 14) |
        ((bytes[8] & 0x7f) << 7) |
        (bytes[9] & 0x7f);

      const limit = Math.min(bytes.length - 10, totalHeaderSize + 10);

      while (offset < limit) {
        if (offset + 10 > limit) break;
        const frameId = String.fromCharCode(
          bytes[offset],
          bytes[offset + 1],
          bytes[offset + 2],
          bytes[offset + 3]
        );

        if (!frameId.match(/^[A-Z0-9]{4}$/)) break;

        const frameSize =
          (bytes[offset + 4] << 24) |
          (bytes[offset + 5] << 16) |
          (bytes[offset + 6] << 8) |
          bytes[offset + 7];

        if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

        const frameDataOffset = offset + 10;

        if (frameId === 'TIT2' || frameId === 'TPE1' || frameId === 'TALB') {
          const encoding = bytes[frameDataOffset];
          let str = '';
          const textStart = frameDataOffset + 1;
          const textEnd = frameDataOffset + frameSize;

          if (encoding === 1 || encoding === 2) {
            const decoder = new TextDecoder('utf-16');
            str = decoder.decode(bytes.subarray(textStart, textEnd));
          } else {
            const decoder = new TextDecoder('utf-8');
            str = decoder.decode(bytes.subarray(textStart, textEnd));
          }
          str = str.replace(/\0/g, '').trim();
          if (str) {
            if (frameId === 'TIT2') title = str;
            if (frameId === 'TPE1') artist = str;
            if (frameId === 'TALB') album = str;
          }
        }

        if (frameId === 'APIC' && !coverUrl) {
          let p = frameDataOffset + 1;
          let mime = '';
          while (p < frameDataOffset + frameSize && bytes[p] !== 0) {
            mime += String.fromCharCode(bytes[p]);
            p++;
          }
          p++;
          p++;

          while (p < frameDataOffset + frameSize && bytes[p] !== 0) p++;
          p++;

          if (p < frameDataOffset + frameSize) {
            const imgData = bytes.subarray(p, frameDataOffset + frameSize);
            let binaryStr = '';
            const chunkSize = 8192;
            for (let i = 0; i < imgData.length; i += chunkSize) {
              binaryStr += String.fromCharCode.apply(
                null,
                imgData.subarray(i, i + chunkSize)
              );
            }
            const mimeType = mime || 'image/jpeg';
            coverUrl = `data:${mimeType};base64,${btoa(binaryStr)}`;
          }
        }

        offset += 10 + frameSize;
      }
    }

    return {
      title,
      artist,
      album,
      coverUrl,
      isFlac,
      format: isFlac ? 'FLAC' : ext.toUpperCase(),
    };
  } catch (err) {
    return {
      ...fallback,
      coverUrl: null,
      isFlac: ext === 'flac',
      format: ext.toUpperCase(),
    };
  }
}

/**
 * Native plugin registration and scanning functions
 */
export async function registerNativePlugins() {
  if (window.Capacitor && window.Capacitor.Plugins) {
    console.log('Native plugins registered');
  }
}

/**
 * Fast Ogg/Opus granulepos parser to calculate exact duration in 1ms
 */
async function parseOpusDurationFromOgg(file) {
  try {
    const sliceSize = Math.min(file.size, 65536);
    const buffer = await file.slice(Math.max(0, file.size - sliceSize)).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (let i = bytes.length - 14; i >= 0; i--) {
      if (bytes[i] === 0x4f && bytes[i + 1] === 0x67 && bytes[i + 2] === 0x67 && bytes[i + 3] === 0x53) {
        const low = bytes[i + 6] | (bytes[i + 7] << 8) | (bytes[i + 8] << 16) | (bytes[i + 9] << 24);
        const high = bytes[i + 10] | (bytes[i + 11] << 8) | (bytes[i + 12] << 16) | (bytes[i + 13] << 24);
        const granulepos = (high * 4294967296) + (low >>> 0);
        if (granulepos > 0) {
          const durSec = Math.round(granulepos / 48000);
          if (durSec > 0 && durSec < 86400) {
            return durSec;
          }
        }
      }
    }
  } catch (e) {}
  return 0;
}

/**
 * Preloads audio duration using Ogg granulepos, OfflineAudioContext, and HTML5 Audio element
 */
export async function getAudioDuration(file) {
  if (!file) return 0;

  // 1. Instant Ogg/Opus granulepos parser (1ms)
  try {
    const opusDur = await parseOpusDurationFromOgg(file);
    if (opusDur > 0) return opusDur;
  } catch (e) {}

  // 2. Offline AudioContext decoding (works without user gesture)
  try {
    const arrayBuffer = await file.arrayBuffer();
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OfflineCtx) {
      const offline = new OfflineCtx(1, 44100, 44100);
      const decoded = await offline.decodeAudioData(arrayBuffer);
      if (decoded && isFinite(decoded.duration) && decoded.duration > 0) {
        return Math.round(decoded.duration);
      }
    }
  } catch (e) {}

  // 3. HTML5 Audio preloader
  const html5Dur = await new Promise((resolve) => {
    const tempUrl = createPlayableBlobUrl(file, file.name);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = tempUrl;
    audio.onloadedmetadata = () => {
      const dur = isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : 0;
      URL.revokeObjectURL(tempUrl);
      resolve(dur);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      resolve(0);
    };
    audio.load();
    setTimeout(() => {
      try { URL.revokeObjectURL(tempUrl); } catch (e) {}
      resolve(0);
    }, 1500);
  });

  return html5Dur;
}

export async function saveDirectoryHandle(dirInfo) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DIRECTORIES, 'readwrite');
    const store = tx.objectStore(STORE_DIRECTORIES);
    const item = {
      id: dirInfo.id || 'dir_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: dirInfo.name || 'Custom Folder',
      path: dirInfo.path || '/storage/emulated/0/Music',
      handle: dirInfo.handle || null,
      addedAt: new Date().toISOString(),
    };
    store.put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedDirectories() {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_DIRECTORIES, 'readonly');
    const store = tx.objectStore(STORE_DIRECTORIES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function removeSavedDirectory(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DIRECTORIES, 'readwrite');
    const store = tx.objectStore(STORE_DIRECTORIES);
    store.delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLocalSongs(songs) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SONGS, 'readwrite');
    const store = tx.objectStore(STORE_SONGS);
    songs.forEach((song) => {
      // Strip temporary session-specific blob URLs (blob:http://...)
      // Do NOT strip fileBlob (the actual File/Blob object stored in IndexedDB)
      let streamUrl = song.streamUrl || song.url;
      if (typeof streamUrl === 'string' && streamUrl.startsWith('blob:')) {
        streamUrl = null;
      }
      let downloadUrl = song.downloadUrl;
      if (typeof downloadUrl === 'string' && downloadUrl.startsWith('blob:')) {
        downloadUrl = null;
      }

      const { url, image, ...persistentSong } = song;
      store.put({
        ...persistentSong,
        url: streamUrl,
        streamUrl: streamUrl,
        downloadUrl: downloadUrl,
      });
    });
    tx.oncomplete = () => resolve(songs);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalSongs() {
  const db = await openDatabase();
  await migrateOldDatabases(db);

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SONGS, 'readonly');
    const store = tx.objectStore(STORE_SONGS);
    const req = store.getAll();
    req.onsuccess = async () => {
      const records = req.result || [];
      const hydrated = [];
      for (const song of records) {
        let activeUrl = song.url || song.streamUrl;
        if (song.fileBlob && (song.fileBlob instanceof Blob || song.fileBlob instanceof File)) {
          try {
            activeUrl = createPlayableBlobUrl(song.fileBlob, song.filePath || song.name || song.title || song.format);
          } catch (e) {}
        }
        // Convert content:// URIs for WebView playback
        activeUrl = ensurePlayableUrl(activeUrl);
        
        // Convert cover URL too
        let coverUrl = song.coverUrl;
        if (coverUrl) {
          coverUrl = ensurePlayableUrl(coverUrl);
        }

        let songDuration = song.duration || 0;
        if (songDuration === 0 && song.fileBlob) {
          try {
            songDuration = await getAudioDuration(song.fileBlob);
          } catch (e) {}
        }

        if (activeUrl || song.fileBlob) {
          hydrated.push({
            ...song,
            duration: songDuration,
            name: song.title || song.name,
            url: activeUrl,
            streamUrl: activeUrl,
            downloadUrl: activeUrl,
            coverUrl: coverUrl,
            image: coverUrl ? [{ url: coverUrl }, { url: coverUrl }] : (song.image || [{ url: '/logo.png' }]),
          });
        }
      }
      // Auto-scan device on native if no cached songs (like every music player)
      if (records.length === 0 && Capacitor.isNativePlatform()) {
        const scanned = await scanDeviceAudioNative();
        if (scanned && scanned.length > 0) {
          resolve(scanned.map(ensureValidAudioUrl));
          return;
        }
      }
      resolve(hydrated);
    };
    req.onerror = () => resolve([]);
  });
}

export function ensureValidAudioUrl(song) {
  if (!song) return song;
  let activeUrl = song.url || song.streamUrl;
  if (song.fileBlob) {
    try {
      activeUrl = createPlayableBlobUrl(song.fileBlob, song.filePath || song.name || song.title || song.format);
    } catch (e) {}
  }
  // Convert content:// URIs for WebView playback
  activeUrl = ensurePlayableUrl(activeUrl);
  
  // Also convert cover URL
  let coverUrl = song.coverUrl;
  if (coverUrl) {
    coverUrl = ensurePlayableUrl(coverUrl);
  }
  
  return {
    ...song,
    name: song.title || song.name,
    url: activeUrl,
    streamUrl: activeUrl,
    downloadUrl: activeUrl,
    coverUrl: coverUrl,
    image: coverUrl ? [{ url: coverUrl }, { url: coverUrl }] : (song.image || [{ url: '/logo.png' }]),
  };
}

export async function clearLocalSongsCache() {
  const db = await openDatabase();
  const tx1 = db.transaction(STORE_SONGS, 'readwrite');
  tx1.objectStore(STORE_SONGS).clear();
  const tx2 = db.transaction(STORE_DIRECTORIES, 'readwrite');
  tx2.objectStore(STORE_DIRECTORIES).clear();
  // Safety: destroy any leftover legacy DBs
  PREVIOUS_DB_NAMES.forEach((n) => { try { indexedDB.deleteDatabase(n); } catch (e) {} });
  return true;
}

export async function deleteLocalSong(songId) {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SONGS, 'readwrite');
    tx.objectStore(STORE_SONGS).delete(songId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export function calculateLocalMusicStats(songs = []) {
  let totalSizeBytes = 0;
  let totalDurationSec = 0;
  let flacCount = 0;

  songs.forEach((s) => {
    totalSizeBytes += s.sizeBytes || 0;
    totalDurationSec += s.duration || 0;
    if (s.isFlac) flacCount++;
  });

  const totalMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);
  const totalGb = (totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
  const sizeDisplay = totalSizeBytes > 1024 * 1024 * 1024 ? `${totalGb} GB` : `${totalMb} MB`;

  const hours = Math.floor(totalDurationSec / 3600);
  const mins = Math.floor((totalDurationSec % 3600) / 60);
  const durationDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  return {
    count: songs.length,
    sizeDisplay,
    durationDisplay,
    flacCount,
  };
}

export async function scanFileObjects(fileList, dirName = 'Local Folder') {
  const songs = [];
  const files = Array.from(fileList);

  for (const file of files) {
    const isAudio =
      (file.type && file.type.startsWith('audio/')) ||
      SUPPORTED_EXTENSIONS.some((e) => file.name.toLowerCase().endsWith(e));
    if (!isAudio) continue;

    try {
      const tags = await parseBinaryTags(file);
      const duration = await getAudioDuration(file);
      const objectUrl = createPlayableBlobUrl(file, file.name);

      const coverArt = tags.coverUrl || '/logo.png';

      let bitrateText = tags.isFlac ? 'FLAC Lossless' : '320 kbps MP3';
      if (!tags.isFlac && duration > 0 && file.size > 0) {
        const kbps = Math.round((file.size * 8) / (duration * 1000));
        if (kbps > 0) bitrateText = `${kbps} kbps`;
      }

      const safeKey = encodeURIComponent(file.name) + '_' + file.size + '_' + file.lastModified;
      const songId = 'local_' + safeKey.replace(/[^a-zA-Z0-9_]/g, '_');

      const songItem = {
        id: songId,
        title: tags.title || parseAudioFilename(file.name).title,
        artist: tags.artist || 'Local Artist',
        album: tags.album || 'Local Collection',
        duration,
        url: objectUrl,
        downloadUrl: objectUrl,
        fileBlob: file, // Store actual File object in IndexedDB
        image: [
          { url: coverArt },
          { url: coverArt },
          { url: coverArt },
        ],
        coverUrl: coverArt,
        hasCover: !!tags.coverUrl,
        isLocal: true,
        format: tags.format || 'AUDIO',
        bitrate: bitrateText,
        isFlac: tags.isFlac,
        filePath: file.webkitRelativePath || file.name,
        folderName: dirName,
        sizeBytes: file.size,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        addedAt: Date.now(),
      };

      songs.push(songItem);
    } catch (err) {
      console.error('Error scanning file:', file.name, err);
    }
  }

  if (songs.length > 0) {
    await saveLocalSongs(songs);
  }

  return songs;
}

export async function requestNativeFolderPicker() {
  // On native (Android/iOS), use the native MediaStore scanner instead of web picker
  if (Capacitor.isNativePlatform()) {
    return await scanDeviceAudioNative();
  }
  
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files = [];

      async function readDirectory(handle, path = '') {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            files.push(file);
          } else if (entry.kind === 'directory') {
            await readDirectory(entry, path + entry.name + '/');
          }
        }
      }

      await readDirectory(dirHandle);

      await saveDirectoryHandle({
        name: dirHandle.name,
        path: '/' + dirHandle.name,
        handle: dirHandle,
      });

      return await scanFileObjects(files, dirHandle.name);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error selecting directory:', err);
      }
      throw err;
    }
  }
  return null;
}

export async function rescanSavedDirectories() {
  // On native, always use the MediaStore scanner (the authoritative source)
  if (Capacitor.isNativePlatform()) {
    return await scanDeviceAudioNative();
  }
  
  const dirs = await getSavedDirectories();
  const existingSongs = await getLocalSongs();

  for (const dirInfo of dirs) {
    if (dirInfo.handle && 'values' in dirInfo.handle) {
      try {
        let perm = await dirInfo.handle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') {
          perm = await dirInfo.handle.requestPermission({ mode: 'read' });
        }
        if (perm === 'granted') {
          const files = [];
          async function readDirectory(handle) {
            for await (const entry of handle.values()) {
              if (entry.kind === 'file') {
                const file = await entry.getFile();
                files.push(file);
              } else if (entry.kind === 'directory') {
                await readDirectory(entry);
              }
            }
          }
          await readDirectory(dirInfo.handle);

          if (files.length > 0) {
            const scanned = await scanFileObjects(files, dirInfo.name);

            // Remove songs from IndexedDB that are no longer on disk in this folder
            const scannedIds = new Set(scanned.map((s) => s.id));
            const oldInDir = existingSongs.filter((s) => s.folderName === dirInfo.name);
            for (const oldSong of oldInDir) {
              if (!scannedIds.has(oldSong.id)) {
                await deleteLocalSong(oldSong.id);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error rescanning directory:', dirInfo.name, err);
      }
    }
  }

  return await getLocalSongs();
}
