/**
 *  visualizer.js — Audio Visualizer & Equalizer
 *
 *  Features:
 *    • Web Audio API 5-band EQ with 12 presets
 *    • 3 visualizer modes: Bars, Wave, Circle
 *    • CORS-safe: if audio source is tainted,
 *      EQ/visualizer are disabled but music keeps playing
 */

import * as Storage from './storage.js';

/* ── State ── */
let audioCtx = null;
let sourceNode = null;
let analyser = null;
let gainNode = null;
let eqFilters = [];
let initialized = false;
let corsBlocked = false;
let animFrameId = null;
let currentMode = 'bars';
let canvasEl = null;
let canvasCtx = null;

/* ── EQ Frequency Bands ── */
const EQ_BANDS = [60, 230, 910, 3600, 14000]; // Hz

/* ── 12 Presets ── */
const PRESETS = {
  'Flat': [0, 0, 0, 0, 0],
  'Bass Boost': [6, 4, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 3, 6],
  'Vocal': [-2, 0, 4, 3, 1],
  'Rock': [4, 2, -1, 3, 4],
  'Pop': [-1, 2, 4, 2, -1],
  'Jazz': [3, 1, -1, 1, 3],
  'Classical': [3, 1, 0, 1, 3],
  'Dance/EDM': [5, 3, 0, 2, 4],
  'Hip-Hop': [5, 3, 0, 1, 3],
  'Acoustic': [3, 1, 1, 2, 2],
  'Deep Bass': [8, 5, 0, -1, -2],
};

/* ── Init: Connect audio element to Web Audio API ── */
export function initAudio(audioElement) {
  if (initialized) return true;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Create source from the audio element
    sourceNode = audioCtx.createMediaElementSource(audioElement);

    // Create analyser
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Create gain node
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;

    // Create 5-band EQ filters
    eqFilters = EQ_BANDS.map((freq, i) => {
      const filter = audioCtx.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === EQ_BANDS.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.4;
      }
      filter.frequency.value = freq;
      filter.gain.value = 0;
      return filter;
    });

    // Chain: source → EQ filters → analyser → gain → destination
    let prev = sourceNode;
    for (const filter of eqFilters) {
      prev.connect(filter);
      prev = filter;
    }
    prev.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    initialized = true;
    corsBlocked = false;

    // Apply saved preset
    const savedPreset = Storage.getEQPreset();
    if (savedPreset && PRESETS[savedPreset]) {
      applyGains(PRESETS[savedPreset]);
    } else {
      const custom = Storage.getEQCustom();
      applyGains(custom);
    }

    currentMode = Storage.getVisualizerMode();

    console.log('[Visualizer] ✓ Web Audio API initialized');
    return true;
  } catch (err) {
    console.warn('[Visualizer] Web Audio init failed (CORS?):', err.message);
    corsBlocked = true;
    initialized = false;

    // If source was already connected and failed, reconnect directly
    // so music keeps playing without EQ
    try {
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode.connect(audioCtx.destination);
      }
    } catch {
      // Audio element plays natively without Web Audio, which is fine
    }

    return false;
  }
}

/* ── Resume AudioContext (must be called from user gesture) ── */
export function resumeContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => { });
  }
}

/* ── Apply gain values to EQ filters ── */
function applyGains(gains) {
  if (!gains || !eqFilters.length) return;
  eqFilters.forEach((f, i) => {
    f.gain.value = gains[i] || 0;
  });
}

/* ── Set EQ Preset by name ── */
export function setEQPreset(name) {
  if (PRESETS[name]) {
    applyGains(PRESETS[name]);
    Storage.saveEQPreset(name);
    return true;
  }
  return false;
}

/* ── Set custom band gains ── */
export function setCustomEQ(gains) {
  applyGains(gains);
  Storage.saveEQCustom(gains);
  Storage.saveEQPreset('Custom');
}

/* ── Get single band gain ── */
export function setBandGain(bandIdx, value) {
  if (eqFilters[bandIdx]) {
    eqFilters[bandIdx].gain.value = value;
    const gains = eqFilters.map(f => f.gain.value);
    Storage.saveEQCustom(gains);
  }
}

/* ── Get all presets ── */
export function getPresets() { return PRESETS; }
export function getPresetNames() { return Object.keys(PRESETS); }
export function getBandGains() { return eqFilters.map(f => f.gain.value); }
export function getBandFreqs() { return [...EQ_BANDS]; }

/* ── Visualizer Mode ── */
export function setVisualizerMode(mode) {
  currentMode = mode;
  Storage.saveVisualizerMode(mode);
}

export function getVisualizerMode() { return currentMode; }
export function isInitialized() { return initialized; }
export function isCorsBlocked() { return corsBlocked; }

/* CANVAS VISUALIZER */

export function startVisualizer(canvas) {
  if (!canvas) return;
  canvasEl = canvas;
  canvasCtx = canvas.getContext('2d');

  // Handle high DPI
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    canvasCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  };
  resize();

  // Observe resize
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas._resizeObserver = ro;
  }

  if (animFrameId) cancelAnimationFrame(animFrameId);
  drawFrame();
}

export function stopVisualizer() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (canvasEl?._resizeObserver) {
    canvasEl._resizeObserver.disconnect();
  }
  if (canvasCtx && canvasEl) {
    const w = canvasEl.getBoundingClientRect().width;
    const h = canvasEl.getBoundingClientRect().height;
    canvasCtx.clearRect(0, 0, w, h);
  }
}

function drawFrame() {
  animFrameId = requestAnimationFrame(drawFrame);
  if (!canvasEl || !canvasCtx) return;

  const w = canvasEl.getBoundingClientRect().width;
  const h = canvasEl.getBoundingClientRect().height;
  canvasCtx.clearRect(0, 0, w, h);

  if (!analyser || corsBlocked || !Storage.getVisualizerEnabled()) return;

  const bufLen = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufLen);

  switch (currentMode) {
    case 'bars': drawBars(dataArray, bufLen, w, h); break;
    case 'wave': drawWave(dataArray, bufLen, w, h); break;
    case 'circle': drawCircle(dataArray, bufLen, w, h); break;
    default: drawBars(dataArray, bufLen, w, h);
  }
}

/* ── Bar Visualizer ── */
function drawBars(dataArray, bufLen, w, h) {
  analyser.getByteFrequencyData(dataArray);

  const barCount = Math.min(64, bufLen);
  const barWidth = (w / barCount) * 0.75;
  const gap = (w / barCount) * 0.25;

  for (let i = 0; i < barCount; i++) {
    const val = dataArray[i] / 255;
    const barH = val * h * 0.85;
    const x = i * (barWidth + gap);

    // Gradient from accent to pink
    const hue = 260 + (i / barCount) * 80;
    const sat = 70 + val * 30;
    const light = 50 + val * 20;

    canvasCtx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${0.6 + val * 0.4})`;
    canvasCtx.shadowColor = `hsla(${hue}, 80%, 60%, 0.3)`;
    canvasCtx.shadowBlur = 8;

    // Rounded bar
    const radius = Math.min(barWidth / 2, 4);
    const y = h - barH;
    canvasCtx.beginPath();
    canvasCtx.moveTo(x + radius, y);
    canvasCtx.lineTo(x + barWidth - radius, y);
    canvasCtx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    canvasCtx.lineTo(x + barWidth, h);
    canvasCtx.lineTo(x, h);
    canvasCtx.lineTo(x, y + radius);
    canvasCtx.quadraticCurveTo(x, y, x + radius, y);
    canvasCtx.fill();
  }
  canvasCtx.shadowBlur = 0;
}

/* ── Wave Visualizer ── */
function drawWave(dataArray, bufLen, w, h) {
  analyser.getByteTimeDomainData(dataArray);

  canvasCtx.lineWidth = 2.5;
  canvasCtx.strokeStyle = 'rgba(169, 144, 255, 0.8)';
  canvasCtx.shadowColor = 'rgba(139, 108, 255, 0.4)';
  canvasCtx.shadowBlur = 12;

  canvasCtx.beginPath();
  const sliceWidth = w / bufLen;
  let x = 0;
  for (let i = 0; i < bufLen; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * h) / 2;
    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
    x += sliceWidth;
  }
  canvasCtx.lineTo(w, h / 2);
  canvasCtx.stroke();

  // Mirror wave
  canvasCtx.strokeStyle = 'rgba(255, 107, 157, 0.4)';
  canvasCtx.beginPath();
  x = 0;
  for (let i = 0; i < bufLen; i++) {
    const v = dataArray[i] / 128.0;
    const y = h - (v * h) / 2;
    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
    x += sliceWidth;
  }
  canvasCtx.lineTo(w, h / 2);
  canvasCtx.stroke();
  canvasCtx.shadowBlur = 0;
}

/* ── Circle Visualizer ── */
function drawCircle(dataArray, bufLen, w, h) {
  analyser.getByteFrequencyData(dataArray);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.28;
  const barCount = Math.min(80, bufLen);

  for (let i = 0; i < barCount; i++) {
    const val = dataArray[i] / 255;
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
    const barLen = val * radius * 0.8;

    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(angle) * (radius + barLen);
    const y2 = cy + Math.sin(angle) * (radius + barLen);

    const hue = (i / barCount) * 360;
    canvasCtx.strokeStyle = `hsla(${hue}, 80%, 65%, ${0.5 + val * 0.5})`;
    canvasCtx.lineWidth = 2.5;
    canvasCtx.shadowColor = `hsla(${hue}, 80%, 60%, 0.3)`;
    canvasCtx.shadowBlur = 6;

    canvasCtx.beginPath();
    canvasCtx.moveTo(x1, y1);
    canvasCtx.lineTo(x2, y2);
    canvasCtx.stroke();
  }

  // Inner ring glow
  canvasCtx.shadowBlur = 0;
  canvasCtx.strokeStyle = 'rgba(139, 108, 255, 0.15)';
  canvasCtx.lineWidth = 1.5;
  canvasCtx.beginPath();
  canvasCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  canvasCtx.stroke();
}

/* ── Connect a secondary audio element (for crossfade) ── */
export function connectSecondaryAudio(audioElement) {
  if (!audioCtx || corsBlocked) return null;
  try {
    const src = audioCtx.createMediaElementSource(audioElement);
    // Connect through the same EQ chain
    let prev = src;
    for (const filter of eqFilters) {
      // EQ filters are shared, so secondary audio connects to destination directly
      // (sharing biquad filters across sources is not possible)
      // Instead, connect to gain → destination
    }
    // For secondary audio: source → gain → destination (no EQ during crossfade)
    src.connect(gainNode);
    return src;
  } catch {
    return null;
  }
}
