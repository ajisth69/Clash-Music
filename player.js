/**
 * ═══════════════════════════════════════════
 *  player.js — Audio Engine (Final)
 *  Shuffle, Repeat, Queue management
 * ═══════════════════════════════════════════
 */

import * as Storage from './storage.js';

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'auto';

let playlist   = [];
let currentIdx = -1;
let currentSong = null;
let shuffleOn  = false;
let repeatMode = 0; // 0=off, 1=all, 2=one

function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(`player:${name}`, { detail }));
}

function decode(str) {
  if (!str) return '';
  const d = document.createElement('textarea');
  d.innerHTML = str;
  return d.value;
}

/* ── Public ── */

export function playSong(song, list = [], idx = 0) {
  if (!song?.streamUrl) {
    emit('error', { message: 'No playable URL for this song.' });
    return;
  }
  playlist   = list.length ? list : [song];
  currentIdx = idx;
  currentSong = song;

  audio.src = song.streamUrl;

  Storage.saveLastPlayed(song);
  Storage.addToHistory(song);
  emit('trackchange', { song });

  audio.play().then(() => {
    emit('play');
  }).catch(err => {
    console.error('[Player] Audio play blocked:', err);
    emit('pause'); // Rollback the UI state!
    if (err.name === 'NotAllowedError') {
      emit('error', { message: 'Autoplay blocked. Tap Play to start! 🎵' });
    } else {
      emit('error', { message: 'Playback failed.' });
    }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: decode(song.title),
      artist: decode(song.artist),
      album: decode(song.album || 'Clash Musics'),
      artwork: [
        { src: song.image, sizes: '500x500', type: 'image/jpeg' }
      ]
    });
  }
}

export function toggle() {
  if (!currentSong) return;
  if (audio.paused) { 
    audio.play().then(() => emit('play')).catch(() => emit('pause')); 
  } else { 
    audio.pause(); 
    emit('pause'); 
  }
}

export function pause() { audio.pause(); emit('pause'); }

export function next() {
  if (!playlist.length) return;
  let nextIdx;
  if (shuffleOn) {
    nextIdx = Math.floor(Math.random() * playlist.length);
    if (nextIdx === currentIdx && playlist.length > 1) {
      nextIdx = (nextIdx + 1) % playlist.length;
    }
  } else {
    nextIdx = (currentIdx + 1) % playlist.length;
  }
  playSong(playlist[nextIdx], playlist, nextIdx);
}

export function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (!playlist.length) return;
  const prevIdx = (currentIdx - 1 + playlist.length) % playlist.length;
  playSong(playlist[prevIdx], playlist, prevIdx);
}

export function seekTo(pct) {
  if (!isFinite(audio.duration)) return;
  audio.currentTime = (pct / 100) * audio.duration;
}

export function skip(seconds) {
  if (!audio.src || isNaN(audio.duration)) return;
  audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), audio.duration);
}

export function setVolume(vol) {
  audio.volume = Math.min(1, Math.max(0, vol));
  Storage.saveVolume(audio.volume);
}

export function getVolume()     { return audio.volume; }
export function getCurrentSong(){ return currentSong; }
export function isPlaying()     { return !audio.paused; }
export function getDuration()   { return audio.duration || 0; }
export function getCurrentTime(){ return audio.currentTime || 0; }
export function getPlaylist()   { return playlist; }
export function getCurrentIdx() { return currentIdx; }

/* ── Shuffle ── */
export function toggleShuffle() {
  shuffleOn = !shuffleOn;
  emit('shufflechange', { shuffle: shuffleOn });
  return shuffleOn;
}
export function isShuffleOn() { return shuffleOn; }

/* ── Repeat ── */
export function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  emit('repeatchange', { repeat: repeatMode });
  return repeatMode;
}
export function getRepeatMode() { return repeatMode; }

/* ── Restore ── */
export function restoreState() {
  const vol = Storage.getVolume();
  audio.volume = vol;
  const last = Storage.getLastPlayed();
  if (last) { 
    currentSong = last; 
    playlist = [last];
    currentIdx = 0;
    audio.src = last.streamUrl; // Crucial for play() to work on toggle!
    emit('trackchange', { song: last }); 
  }
}

/* ── Events ── */
audio.addEventListener('timeupdate', () => {
  if (!isFinite(audio.duration)) return;
  emit('timeupdate', {
    current:  audio.currentTime,
    duration: audio.duration,
    percent:  (audio.currentTime / audio.duration) * 100,
  });
});

audio.addEventListener('ended', () => {
  emit('ended');
  if (repeatMode === 2) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else if (repeatMode === 1 || currentIdx < playlist.length - 1) {
    next();
  } else {
    emit('pause');
  }
});

audio.addEventListener('progress', () => {
  if (audio.buffered.length > 0 && isFinite(audio.duration)) {
    const buffered = (audio.buffered.end(audio.buffered.length - 1) / audio.duration) * 100;
    emit('buffered', { percent: buffered });
  }
});

audio.addEventListener('waiting', () => emit('buffering'));
audio.addEventListener('canplay', () => emit('canplay'));
audio.addEventListener('error', () => emit('error', { message: 'Audio error.' }));

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => { if (audio.paused) { audio.play().catch(()=>{}); emit('play'); } });
  navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); emit('pause'); });
  navigator.mediaSession.setActionHandler('previoustrack', prev);
  navigator.mediaSession.setActionHandler('nexttrack', next);
}
