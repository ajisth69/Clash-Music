/**
 * visualizer.js — Audio Visualizer, EQ & Spatial Audio v3
 * Now with spatial modes: Normal, Concert Hall, Large Hall, Cave, Echo, Cathedral, Studio
 */

import * as Storage from './storage.js';

let audioCtx    = null;
let sourceNode  = null;
let analyser    = null;
let gainNode    = null;
let pannerNode  = null;
let convolverNode = null;
let convolverGain = null;
let dryGain     = null;
let hifiBassNode = null;
let hifiTrebleNode = null;
let hifiLoudnessNode = null;
let eqFilters   = [];
let initialized = false;
let corsBlocked = false;
let animFrameId = null;
let currentMode = 'bars';
let canvasEl    = null;
let canvasCtx   = null;

/* Spatial audio state */
let spatialEnabled  = false;
let spatialAngle    = 0;
let spatialInterval = null;
let currentSpatialMode = 'normal';

const EQ_BANDS = [60, 230, 910, 3600, 14000];

const PRESETS = {
  'Flat':       [0,  0,  0,  0,  0],
  'Bass Boost': [6,  4,  0,  0,  0],
  'Treble Boost':[0,  0,  0,  3,  6],
  'Vocal':      [-2, 0,  4,  3,  1],
  'Rock':       [4,  2, -1,  3,  4],
  'Pop':        [-1, 2,  4,  2, -1],
  'Jazz':       [3,  1, -1,  1,  3],
  'Classical':  [3,  1,  0,  1,  3],
  'Dance/EDM':  [5,  3,  0,  2,  4],
  'Hip-Hop':    [5,  3,  0,  1,  3],
  'Acoustic':   [3,  1,  1,  2,  2],
  'Deep Bass':  [8,  5,  0, -1, -2],
};

/* ── Spatial Mode Impulse Response Configs ── */
const SPATIAL_MODES = {
  normal:    { decay: 0.3,  delay: 0.01, wet: 0.15, roomSize: 0.2,  label: 'Normal' },
  concert:   { decay: 2.5,  delay: 0.04, wet: 0.45, roomSize: 0.8,  label: 'Concert Hall' },
  hall:      { decay: 3.5,  delay: 0.06, wet: 0.55, roomSize: 0.9,  label: 'Large Hall' },
  cave:      { decay: 5.0,  delay: 0.08, wet: 0.65, roomSize: 1.0,  label: 'Cave' },
  echo:      { decay: 1.8,  delay: 0.15, wet: 0.50, roomSize: 0.5,  label: 'Echo' },
  cathedral: { decay: 4.5,  delay: 0.07, wet: 0.60, roomSize: 0.95, label: 'Cathedral' },
  studio:    { decay: 0.6,  delay: 0.02, wet: 0.25, roomSize: 0.3,  label: 'Studio' },
};

/* Generate a synthetic impulse response buffer for reverb */
function generateImpulse(decay, delay, roomSize) {
  const sampleRate = audioCtx.sampleRate;
  const length     = Math.floor(sampleRate * (decay + delay));
  const buffer     = audioCtx.createBuffer(2, length, sampleRate);
  const delayS     = Math.floor(delay * sampleRate);

  const dataL = buffer.getChannelData(0);
  const dataR = buffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    if (i < delayS) {
      dataL[i] = 0;
      dataR[i] = 0;
      continue;
    }
    const t = (i - delayS) / (length - delayS);
    // Exponential decay with random noise for natural reverb
    const envelope = Math.pow(1 - t, 2 + roomSize * 4);

    dataL[i] = (Math.random() * 2 - 1) * envelope;
    dataR[i] = (Math.random() * 2 - 1) * envelope;

    // Add subtle early reflections
    if (t < 0.05) {
      const earlyRef = 0.5 * (1 - t / 0.05);
      dataL[i] += (Math.random() * 2 - 1) * earlyRef;
      dataR[i] += (Math.random() * 2 - 1) * earlyRef;
    }
  }
  return buffer;
}

export function initAudio(audioElement) {
  if (initialized) return true;
  try {
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    analyser   = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;

    // Panner for HRTF spatial
    pannerNode = audioCtx.createPanner();
    pannerNode.panningModel  = 'HRTF';
    pannerNode.distanceModel = 'inverse';
    pannerNode.refDistance   = 1;
    pannerNode.maxDistance   = 10000;
    pannerNode.rolloffFactor = 1;
    pannerNode.coneInnerAngle = 360;
    pannerNode.coneOuterAngle = 0;
    pannerNode.coneOuterGain  = 0;
    if (pannerNode.positionX) {
      pannerNode.positionX.value = 0;
      pannerNode.positionY.value = 0;
      pannerNode.positionZ.value = -1;
    } else {
      pannerNode.setPosition(0, 0, -1);
    }

    // Convolver for reverb modes
    convolverNode = audioCtx.createConvolver();
    convolverGain = audioCtx.createGain();
    convolverGain.gain.value = 0;
    dryGain = audioCtx.createGain();
    dryGain.gain.value = 1;

    // EQ filters
    eqFilters = EQ_BANDS.map((freq, i) => {
      const f = audioCtx.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : (i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking');
      if (f.type === 'peaking') f.Q.value = 1.4;
      f.frequency.value = freq;
      f.gain.value = 0;
      return f;
    });

    // Hi-Fi DSP Enhancer Nodes (Massive Dynamic EQ curve + Loudness)
    hifiBassNode = audioCtx.createBiquadFilter();
    hifiBassNode.type = 'lowshelf';
    hifiBassNode.frequency.value = 110; // 110Hz is perfectly reproduced by phone speakers (punchy mid-bass)
    hifiBassNode.gain.value = 0; // Toggled later

    hifiTrebleNode = audioCtx.createBiquadFilter();
    hifiTrebleNode.type = 'highshelf';
    hifiTrebleNode.frequency.value = 8000; // 8kHz for extreme crispness and air
    hifiTrebleNode.gain.value = 0;

    hifiLoudnessNode = audioCtx.createGain();
    hifiLoudnessNode.gain.value = 1.0; // Normal volume

    // Chain: source → HiFi Loudness → HiFi Bass → HiFi Treble → EQ → analyser → gain → destination
    sourceNode.connect(hifiLoudnessNode);
    hifiLoudnessNode.connect(hifiBassNode);
    hifiBassNode.connect(hifiTrebleNode);
    let prev = hifiTrebleNode;
    for (const f of eqFilters) { prev.connect(f); prev = f; }
    prev.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    initialized = true;
    corsBlocked = false;

    const saved = Storage.getEQPreset();
    if (saved && PRESETS[saved]) applyGains(PRESETS[saved]);
    else applyGains(Storage.getEQCustom());

    currentMode = Storage.getVisualizerMode();

    // Restore spatial & hifi settings
    currentSpatialMode = Storage.getSpatialMode() || 'normal';
    if (Storage.getSpatialAudioEnabled()) enableSpatialInternal(true);
    setHiFiDSP(Storage.getHiFiMode());

    console.log('[Visualizer] ✓ Web Audio API + HRTF Spatial + Hi-Fi DSP + Reverb Modes initialized');
    return true;
  } catch (err) {
    console.warn('[Visualizer] Web Audio init failed:', err.message);
    corsBlocked = true;
    initialized = false;
    try { if (sourceNode) { sourceNode.disconnect(); sourceNode.connect(audioCtx.destination); } } catch {}
    return false;
  }
}

export function resumeContext() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}

function applyGains(gains) {
  if (!gains || !eqFilters.length) return;
  eqFilters.forEach((f, i) => { f.gain.value = gains[i] || 0; });
}

export function setEQPreset(name) {
  if (PRESETS[name]) { applyGains(PRESETS[name]); Storage.saveEQPreset(name); return true; }
  return false;
}
export function setCustomEQ(gains) { applyGains(gains); Storage.saveEQCustom(gains); Storage.saveEQPreset('Custom'); }
export function setBandGain(idx, val) {
  if (eqFilters[idx]) {
    eqFilters[idx].gain.value = val;
    Storage.saveEQCustom(eqFilters.map(f => f.gain.value));
  }
}
export function getPresets()      { return PRESETS; }
export function getPresetNames()  { return Object.keys(PRESETS); }
export function getBandGains()    { return eqFilters.map(f => f.gain.value); }
export function getBandFreqs()    { return [...EQ_BANDS]; }
export function setVisualizerMode(m) { currentMode = m; Storage.saveVisualizerMode(m); }
export function getVisualizerMode()  { return currentMode; }
export function isInitialized()   { return initialized; }
export function isCorsBlocked()   { return corsBlocked; }

/* ── Hi-Fi DSP Enhancer ── */
export function setHiFiDSP(on) {
  if (!initialized || corsBlocked || !hifiBassNode || !hifiTrebleNode || !hifiLoudnessNode) return;
  
  // To make the quality "skyrocket" exactly like a hardware phone enhancer:
  // 1. Boost volume by +2.5dB (1.33x multiplier) for perceived loudness jump
  // 2. Massive +6.5dB mid-bass punch at 110Hz (perfect for phones)
  // 3. +5.5dB treble boost at 8kHz for crisp vocals and cymbals
  
  hifiLoudnessNode.gain.value = on ? 1.35 : 1.0;
  hifiBassNode.gain.value = on ? 6.5 : 0;
  hifiTrebleNode.gain.value = on ? 5.5 : 0;
}

/* ── Spatial Audio with Modes ── */
function rebuildSpatialChain() {
  if (!audioCtx || !gainNode || corsBlocked) return;

  // Disconnect gain from everything
  try { gainNode.disconnect(); } catch {}
  try { pannerNode.disconnect(); } catch {}
  try { convolverNode.disconnect(); } catch {}
  try { convolverGain.disconnect(); } catch {}
  try { dryGain.disconnect(); } catch {}

  if (!spatialEnabled) {
    // Direct: gain → destination
    gainNode.connect(audioCtx.destination);
    return;
  }

  const mode = SPATIAL_MODES[currentSpatialMode] || SPATIAL_MODES.normal;

  // Generate impulse for the selected mode
  try {
    convolverNode.buffer = generateImpulse(mode.decay, mode.delay, mode.roomSize);
  } catch (e) {
    console.warn('[Spatial] Impulse gen error:', e);
  }

  convolverGain.gain.value = mode.wet;
  dryGain.gain.value       = 1 - mode.wet * 0.3;  // Keep dry signal strong

  // Chain: gain → panner → dry+wet split → destination
  //   gain → panner → dryGain → destination
  //   gain → panner → convolver → convolverGain → destination
  gainNode.connect(pannerNode);
  pannerNode.connect(dryGain);
  pannerNode.connect(convolverNode);
  convolverNode.connect(convolverGain);
  dryGain.connect(audioCtx.destination);
  convolverGain.connect(audioCtx.destination);

  startSpatialAnimation();
}

function enableSpatialInternal(on) {
  if (!audioCtx || !pannerNode || !gainNode || corsBlocked) return;
  spatialEnabled = on;
  if (!on) stopSpatialAnimation();
  rebuildSpatialChain();
}

export function setSpatialAudio(on) {
  if (!initialized) return;
  enableSpatialInternal(on);
}

export function setSpatialMode(mode) {
  if (!SPATIAL_MODES[mode]) return;
  currentSpatialMode = mode;
  Storage.saveSpatialMode(mode);
  if (spatialEnabled) rebuildSpatialChain();
}

export function getSpatialMode()    { return currentSpatialMode; }
export function getSpatialModes()   { return SPATIAL_MODES; }
export function getSpatialEnabled() { return spatialEnabled; }

function startSpatialAnimation() {
  if (spatialInterval) return;
  spatialInterval = setInterval(() => {
    spatialAngle = (spatialAngle + 1.5) % 360;
    const rad = (spatialAngle * Math.PI) / 180;
    const x   = Math.sin(rad) * 3;
    const z   = Math.cos(rad) * 3 - 1;
    if (pannerNode) {
      if (pannerNode.positionX) {
        pannerNode.positionX.setTargetAtTime(x, audioCtx.currentTime, 0.1);
        pannerNode.positionZ.setTargetAtTime(z, audioCtx.currentTime, 0.1);
      } else {
        pannerNode.setPosition(x, 0, z);
      }
    }
  }, 50);
}

function stopSpatialAnimation() {
  if (spatialInterval) { clearInterval(spatialInterval); spatialInterval = null; }
  if (pannerNode) {
    if (pannerNode.positionX) {
      pannerNode.positionX.value = 0;
      pannerNode.positionY.value = 0;
      pannerNode.positionZ.value = -1;
    } else {
      pannerNode.setPosition(0, 0, -1);
    }
  }
}

/* ── Canvas Visualizer ── */
export function startVisualizer(canvas) {
  if (!canvas) return;
  canvasEl  = canvas;
  canvasCtx = canvas.getContext('2d');
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    canvasCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  };
  resize();
  if (window.ResizeObserver) { const ro = new ResizeObserver(resize); ro.observe(canvas); canvas._ro = ro; }
  if (animFrameId) cancelAnimationFrame(animFrameId);
  drawFrame();
}

export function stopVisualizer() {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (canvasEl?._ro) canvasEl._ro.disconnect();
  if (canvasCtx && canvasEl) {
    const r = canvasEl.getBoundingClientRect();
    canvasCtx.clearRect(0, 0, r.width, r.height);
  }
}

function drawFrame() {
  animFrameId = requestAnimationFrame(drawFrame);
  if (!canvasEl || !canvasCtx) return;
  const w = canvasEl.getBoundingClientRect().width;
  const h = canvasEl.getBoundingClientRect().height;
  canvasCtx.clearRect(0, 0, w, h);
  if (!analyser || corsBlocked || !Storage.getVisualizerEnabled()) return;
  const bufLen   = analyser.frequencyBinCount;
  const dataArr  = new Uint8Array(bufLen);
  switch (currentMode) {
    case 'bars':   drawBars(dataArr, bufLen, w, h);   break;
    case 'wave':   drawWave(dataArr, bufLen, w, h);   break;
    case 'circle': drawCircle(dataArr, bufLen, w, h); break;
    default:       drawBars(dataArr, bufLen, w, h);
  }
}

function drawBars(data, bufLen, w, h) {
  analyser.getByteFrequencyData(data);
  const n = Math.min(64, bufLen);
  const bw = (w / n) * 0.75, gap = (w / n) * 0.25;
  for (let i = 0; i < n; i++) {
    const val = data[i] / 255;
    const bh  = val * h * 0.85;
    const x   = i * (bw + gap);
    const hue = 260 + (i / n) * 80;
    canvasCtx.fillStyle = `hsla(${hue},${70 + val*30}%,${50 + val*20}%,${0.6 + val*0.4})`;
    canvasCtx.shadowColor = `hsla(${hue},80%,60%,0.3)`;
    canvasCtx.shadowBlur = 8;
    const r = Math.min(bw / 2, 4), y = h - bh;
    canvasCtx.beginPath();
    canvasCtx.moveTo(x+r,y); canvasCtx.lineTo(x+bw-r,y);
    canvasCtx.quadraticCurveTo(x+bw,y,x+bw,y+r); canvasCtx.lineTo(x+bw,h);
    canvasCtx.lineTo(x,h); canvasCtx.lineTo(x,y+r);
    canvasCtx.quadraticCurveTo(x,y,x+r,y); canvasCtx.fill();
  }
  canvasCtx.shadowBlur = 0;
}

function drawWave(data, bufLen, w, h) {
  analyser.getByteTimeDomainData(data);
  canvasCtx.lineWidth = 2.5; canvasCtx.strokeStyle = 'rgba(169,144,255,0.8)';
  canvasCtx.shadowColor = 'rgba(139,108,255,0.4)'; canvasCtx.shadowBlur = 12;
  canvasCtx.beginPath();
  const sw = w / bufLen; let x = 0;
  for (let i = 0; i < bufLen; i++) {
    const y = ((data[i]/128.0)*h)/2;
    i === 0 ? canvasCtx.moveTo(x,y) : canvasCtx.lineTo(x,y);
    x += sw;
  }
  canvasCtx.lineTo(w, h/2); canvasCtx.stroke();
  canvasCtx.strokeStyle = 'rgba(255,107,157,0.4)';
  canvasCtx.beginPath(); x = 0;
  for (let i = 0; i < bufLen; i++) {
    const y = h - ((data[i]/128.0)*h)/2;
    i === 0 ? canvasCtx.moveTo(x,y) : canvasCtx.lineTo(x,y);
    x += sw;
  }
  canvasCtx.lineTo(w, h/2); canvasCtx.stroke(); canvasCtx.shadowBlur = 0;
}

function drawCircle(data, bufLen, w, h) {
  analyser.getByteFrequencyData(data);
  const cx = w/2, cy = h/2, r = Math.min(w,h)*0.28, n = Math.min(80, bufLen);
  for (let i = 0; i < n; i++) {
    const val = data[i]/255;
    const angle = (i/n)*Math.PI*2 - Math.PI/2;
    const bl = val*r*0.8;
    const x1 = cx+Math.cos(angle)*r, y1 = cy+Math.sin(angle)*r;
    const x2 = cx+Math.cos(angle)*(r+bl), y2 = cy+Math.sin(angle)*(r+bl);
    const hue = (i/n)*360;
    canvasCtx.strokeStyle = `hsla(${hue},80%,65%,${0.5+val*0.5})`;
    canvasCtx.lineWidth = 2.5;
    canvasCtx.shadowColor = `hsla(${hue},80%,60%,0.3)`; canvasCtx.shadowBlur = 6;
    canvasCtx.beginPath(); canvasCtx.moveTo(x1,y1); canvasCtx.lineTo(x2,y2); canvasCtx.stroke();
  }
  canvasCtx.shadowBlur = 0;
  canvasCtx.strokeStyle = 'rgba(139,108,255,0.15)'; canvasCtx.lineWidth = 1.5;
  canvasCtx.beginPath(); canvasCtx.arc(cx,cy,r,0,Math.PI*2); canvasCtx.stroke();
}

export function connectSecondaryAudio(audioElement) {
  if (!audioCtx || corsBlocked) return null;
  try { const src = audioCtx.createMediaElementSource(audioElement); src.connect(gainNode); return src; }
  catch { return null; }
}
