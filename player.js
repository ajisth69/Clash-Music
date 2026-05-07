/**
 *  player.js — Audio Engine (v4 — Premium+)
 *  Shuffle, Repeat, Queue, Crossfade, Gapless
 */

import * as Storage from './storage.js';
import * as Vis from './visualizer.js';

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'auto';

/* Secondary audio for crossfade */
const audio2 = new Audio();
audio2.crossOrigin = 'anonymous';
audio2.preload = 'auto';

let playlist = [];
let currentIdx = -1;
let currentSong = null;
let shuffleOn = false;
let repeatMode = 0; // 0=off, 1=all, 2=one

/* Crossfade state */
let activeAudio = audio;   // Which audio element is currently "primary"
let crossfading = false;
let crossfadeTimer = null;
let crossfadeInterval = null;

/* Sleep timer */
let sleepTimerId = null;
let sleepEndTime = null;

/* Visualizer init flag */
let visInitAttempted = false;

function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(`player:${name}`, { detail }));
}

function decode(str) {
  if (!str) return '';
  const d = document.createElement('textarea');
  d.innerHTML = str;
  return d.value;
}

/* ── Try to init Web Audio (first user gesture) ── */
function tryInitVisualizer() {
  if (visInitAttempted) return;
  visInitAttempted = true;
  const ok = Vis.initAudio(activeAudio);
  if (!ok) {
    console.warn('[Player] Visualizer/EQ unavailable (CORS). Music plays normally.');
  }
}

/* ── Public ── */

export function playSong(song, list = [], idx = 0) {
  if (!song?.streamUrl) {
    emit('error', { message: 'No playable URL for this song.' });
    return;
  }

  // Init visualizer on first play
  tryInitVisualizer();
  Vis.resumeContext();

  const crossfadeEnabled = Storage.getCrossfadeEnabled();
  const crossfadeDur = Storage.getCrossfadeDuration();

  // If crossfade is on and we have a currently playing song, do crossfade
  if (crossfadeEnabled && crossfadeDur > 0 && currentSong && !activeAudio.paused) {
    doCrossfade(song, list, idx, crossfadeDur);
    return;
  }

  // Normal play
  playlist = list.length ? list : [song];
  currentIdx = idx;
  currentSong = song;

  activeAudio.src = song.streamUrl;

  Storage.saveLastPlayed(song);
  Storage.saveQueue(playlist, currentIdx);
  Storage.addToHistory(song);
  emit('trackchange', { song });

  activeAudio.play().then(() => {
    emit('play');
  }).catch(err => {
    console.error('[Player] Audio play blocked:', err);
    emit('pause');
    if (err.name === 'NotAllowedError') {
      emit('error', { message: 'Autoplay blocked. Tap Play to start! 🎵' });
    } else {
      emit('error', { message: 'Playback failed.' });
    }
  });

  setMediaSession(song);
  preloadNext(list, idx);
}

/* ── Crossfade transition ── */
function doCrossfade(song, list, idx, duration) {
  if (crossfading) return; // prevent double crossfade
  crossfading = true;

  const outgoing = activeAudio;
  const incoming = (outgoing === audio) ? audio2 : audio;

  // Set up incoming
  incoming.src = song.streamUrl;
  incoming.volume = 0;
  incoming.currentTime = 0;

  playlist = list.length ? list : [song];
  currentIdx = idx;
  currentSong = song;

  Storage.saveLastPlayed(song);
  Storage.saveQueue(playlist, currentIdx);
  Storage.addToHistory(song);
  emit('trackchange', { song });

  const startVol = outgoing.volume;
  const steps = 30;
  const stepTime = (duration * 1000) / steps;
  let step = 0;

  incoming.play().catch(() => { });

  if (crossfadeInterval) clearInterval(crossfadeInterval);
  crossfadeInterval = setInterval(() => {
    step++;
    const progress = step / steps;
    outgoing.volume = Math.max(0, startVol * (1 - progress));
    incoming.volume = Math.min(startVol, startVol * progress);

    if (step >= steps) {
      clearInterval(crossfadeInterval);
      crossfadeInterval = null;
      outgoing.pause();
      outgoing.volume = startVol;
      outgoing.src = '';
      activeAudio = incoming;
      crossfading = false;
      emit('play');
    }
  }, stepTime);

  setMediaSession(song);
  preloadNext(list, idx);
}

/* ── Preload next track for gapless ── */
function preloadNext(list, idx) {
  if (!Storage.getGapless() && !Storage.getCrossfadeEnabled()) return;
  const nextIdx = (idx + 1) % list.length;
  if (list[nextIdx]?.streamUrl) {
    const inactive = (activeAudio === audio) ? audio2 : audio;
    inactive.src = list[nextIdx].streamUrl;
    inactive.preload = 'auto';
  }
}

export function toggle() {
  if (!currentSong) return;
  Vis.resumeContext();
  if (activeAudio.paused) {
    activeAudio.play().then(() => emit('play')).catch(() => emit('pause'));
  } else {
    activeAudio.pause();
    emit('pause');
  }
}

export function pause() { activeAudio.pause(); emit('pause'); }

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
  if (activeAudio.currentTime > 3) { activeAudio.currentTime = 0; return; }
  if (!playlist.length) return;
  const prevIdx = (currentIdx - 1 + playlist.length) % playlist.length;
  playSong(playlist[prevIdx], playlist, prevIdx);
}

export function seekTo(pct) {
  if (!isFinite(activeAudio.duration)) return;
  activeAudio.currentTime = (pct / 100) * activeAudio.duration;
}

export function skip(seconds) {
  if (!activeAudio.src || isNaN(activeAudio.duration)) return;
  activeAudio.currentTime = Math.min(Math.max(activeAudio.currentTime + seconds, 0), activeAudio.duration);
}

export function setVolume(vol) {
  const v = Math.min(1, Math.max(0, vol));
  audio.volume = v;
  audio2.volume = v;
  Storage.saveVolume(v);
}

export function getVolume() { return activeAudio.volume; }
export function getCurrentSong() { return currentSong; }
export function isPlaying() { return !activeAudio.paused; }
export function getDuration() { return activeAudio.duration || 0; }
export function getCurrentTime() { return activeAudio.currentTime || 0; }
export function getPlaylist() { return playlist; }
export function getCurrentIdx() { return currentIdx; }
export function getAudioElement() { return activeAudio; }

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

/* ── Queue Reorder (Drag-and-Drop) ── */
export function reorderQueue(fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= playlist.length) return;
  if (toIdx < 0 || toIdx >= playlist.length) return;

  const [moved] = playlist.splice(fromIdx, 1);
  playlist.splice(toIdx, 0, moved);

  // Adjust currentIdx
  if (currentIdx === fromIdx) {
    currentIdx = toIdx;
  } else if (fromIdx < currentIdx && toIdx >= currentIdx) {
    currentIdx--;
  } else if (fromIdx > currentIdx && toIdx <= currentIdx) {
    currentIdx++;
  }

  Storage.saveQueue(playlist, currentIdx);
  emit('queuechange');
}

/* ── Sleep Timer ── */
export function setSleepTimer(minutes) {
  clearSleepTimerFn();
  if (!minutes || minutes <= 0) return;

  sleepEndTime = Date.now() + minutes * 60 * 1000;
  Storage.saveSleepTimer(sleepEndTime);

  sleepTimerId = setTimeout(() => {
    pause();
    emit('sleeptimer', { message: 'Sleep timer ended' });
    clearSleepTimerFn();
  }, minutes * 60 * 1000);

  emit('sleeptimerstart', { minutes, endTime: sleepEndTime });
}

export function clearSleepTimerFn() {
  if (sleepTimerId) clearTimeout(sleepTimerId);
  sleepTimerId = null;
  sleepEndTime = null;
  Storage.clearSleepTimer();
}

export function getSleepEndTime() { return sleepEndTime; }

/* ── Restore ── */
export function restoreState() {
  const vol = Storage.getVolume();
  audio.volume = vol;
  audio2.volume = vol;
  const last = Storage.getLastPlayed();
  const savedQueue = Storage.getQueue();
  const savedIdx = Storage.getQueueIdx();

  if (last) {
    currentSong = last;
    playlist = savedQueue.length ? savedQueue : [last];
    currentIdx = savedQueue.length ? savedIdx : 0;
    activeAudio.src = last.streamUrl;
    emit('trackchange', { song: last });
  }
}

/* ── Media Session ── */
function setMediaSession(song) {
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

/* ── Events — bind to BOTH audio elements ── */
function bindAudioEvents(el) {
  el.addEventListener('timeupdate', () => {
    if (el !== activeAudio) return;
    if (!isFinite(el.duration)) return;

    // Check for crossfade trigger
    const crossfadeEnabled = Storage.getCrossfadeEnabled();
    const crossfadeDur = Storage.getCrossfadeDuration();
    if (crossfadeEnabled && crossfadeDur > 0 && !crossfading) {
      const remaining = el.duration - el.currentTime;
      if (remaining <= crossfadeDur && remaining > 0 && playlist.length > 1) {
        // Auto-trigger crossfade to next
        if (repeatMode !== 2) {
          let nextIdx = shuffleOn
            ? Math.floor(Math.random() * playlist.length)
            : (currentIdx + 1) % playlist.length;
          if (nextIdx !== currentIdx && playlist[nextIdx]) {
            doCrossfade(playlist[nextIdx], playlist, nextIdx, remaining);
          }
        }
      }
    }

    emit('timeupdate', {
      current: el.currentTime,
      duration: el.duration,
      percent: (el.currentTime / el.duration) * 100,
    });
  });

  el.addEventListener('ended', () => {
    if (el !== activeAudio) return;
    emit('ended');
    if (repeatMode === 2) {
      el.currentTime = 0;
      el.play().catch(() => { });
    } else if (repeatMode === 1 || currentIdx < playlist.length - 1) {
      next();
    } else {
      emit('pause');
    }
  });

  el.addEventListener('progress', () => {
    if (el !== activeAudio) return;
    if (el.buffered.length > 0 && isFinite(el.duration)) {
      const buffered = (el.buffered.end(el.buffered.length - 1) / el.duration) * 100;
      emit('buffered', { percent: buffered });
    }
  });

  el.addEventListener('waiting', () => { if (el === activeAudio) emit('buffering'); });
  el.addEventListener('canplay', () => { if (el === activeAudio) emit('canplay'); });
  el.addEventListener('error', () => { if (el === activeAudio) emit('error', { message: 'Audio error.' }); });
}

bindAudioEvents(audio);
bindAudioEvents(audio2);

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => { if (activeAudio.paused) { activeAudio.play().catch(() => { }); emit('play'); } });
  navigator.mediaSession.setActionHandler('pause', () => { activeAudio.pause(); emit('pause'); });
  navigator.mediaSession.setActionHandler('previoustrack', prev);
  navigator.mediaSession.setActionHandler('nexttrack', next);
}
