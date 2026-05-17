<h1 align="center">🎵 Clash Musics</h1>

<p align="center">
  <strong>The Ultimate Next-Generation Premium Music Streaming Experience</strong><br>
  <em>Powered by a robust Node.js Backend, featuring Hardware-Level DSP, True 320kbps Hi-Fi Audio, and 7 Immersive Spatial Reverb Modes.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-5.0-blueviolet.svg?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20PWA%20%7C%20Mobile-success.svg?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Backend-Node.js-green.svg?style=flat-square" alt="Node.js">
  <img src="https://img.shields.io/badge/API-JioSaavn%20Integration-orange.svg?style=flat-square" alt="API">
</p>

---

## 🚀 Overview

**Clash Musics** is an advanced, premium, full-stack web application designed to completely revolutionize how you listen to music on the web. Moving far beyond generic web players, Clash Musics utilizes a sophisticated **Node.js API Proxy** and **Web Audio API DSP** (Digital Signal Processing) to deliver studio-quality sound straight to your headphones and mobile speakers.

Whether you're looking for deep bass punch, crystal clear high-frequency air, or the illusion of listening to your favorite tracks in a massive Cathedral or an intimate Studio, Clash Musics provides an unrivaled, buttery-smooth listening experience on both desktop and mobile.

---

## 🔥 Extreme Features

### 🎧 **True 320kbps Hi-Fi Audio & Hardware-Level DSP**
- **Hi-Fi Mode:** Instantly bypasses standard 160kbps compression by routing audio through our custom Node.js backend proxy, forcing the delivery of pristine 320kbps uncompressed streams.
- **Dynamic Mobile Exciter EQ:** When Hi-Fi is toggled, our Web Audio engine injects a powerful `BiquadFilter` DSP stack:
  - **+6.5dB Bass Punch @ 110Hz:** Perfectly tuned for mobile phone speakers and headphones to deliver massive thumps without muddying vocals.
  - **+5.5dB Crisp Air @ 8kHz:** Enhances vocal clarity, cymbals, and spatial separation.
  - **+35% Volume Boost:** A perceptual loudness jump for an instantly "OP" sound profile.

### 🌌 **Advanced Spatial Audio & Reverb Engine**
- Integrated `ConvolverNode` architecture utilizing synthetic Impulse Responses.
- **7 Immersive Acoustic Environments:**
  - 🛋️ **Normal** (Standard Stereo)
  - 🏟️ **Concert Hall** (Massive reflections)
  - 🏛️ **Large Hall** (Deep echoes)
  - 🕳️ **Cave** (Dark, bouncing resonance)
  - 🗣️ **Echo** (Distinct slapback)
  - ⛪ **Cathedral** (Heavenly, infinite decay)
  - 🎙️ **Studio** (Tight, warm intimacy)
- **Dynamic HRTF Panning:** Wraps the audio around your head for a true surround-sound experience.

### 📱 **Buttery-Smooth Mobile UI/UX**
- **Zero Tap Delay:** Fully integrated `touch-action: manipulation` for instantaneous interaction.
- **Hardware GPU Acceleration:** 3D tilted song cards animate at a flawless 60fps utilizing `will-change: transform`.
- **Native App Feel:** Completely eliminates browser pull-to-refresh and horizontal swipe-back navigation (`overscroll-behavior`).
- **Dynamic Safe Areas:** Fully compatible with modern edge-to-edge iOS and Android screens (`env(safe-area-inset-bottom)`).
- **Responsive Mobile Menus:** Easy access to Hi-Fi and Spatial chips right from the Player Bar's 3-dot "More Menu."

### ⚙️ **Robust Node.js Backend Architecture**
- **API Proxy Failover Pool:** Frontend API calls no longer rely on fragile CORS proxies. All requests are routed securely through the local Node.js server (`/api/*`), which recursively fails over across multiple JioSaavn API mirrors to guarantee 100% uptime.
- **Audio Proxy:** Bypasses browser CORS restrictions while supporting `206 Partial Content` range requests for seamless scrubbing/seeking.

---

## 🛠️ Tech Stack & Technologies

- **Frontend:** Vanilla JS, HTML5, CSS3 (No bloat, extremely fast).
- **Audio Engine:** Web Audio API (`ConvolverNode`, `BiquadFilterNode`, `PannerNode`, `AnalyserNode`).
- **Backend:** Node.js (Dependency-free `http`, `https` for blazing fast Serverless cold starts).
- **Deployment:** Ready for Vercel Serverless out-of-the-box (`vercel.json` included).
- **Data Source:** JioSaavn API Integration (via robust proxy failover).

---

## 💻 Installation & Usage

Because Clash Musics is built to be ultra-lightweight, it requires **zero NPM modules**.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ajisth69/Clash-Music.git
   cd Clash-Music
   ```

2. **Start the Node.js Server:**
   ```bash
   node server.js
   ```

3. **Enjoy the Music:**
   Open your browser and navigate to `http://localhost:3001`.

---

## 🔒 Security & Conduct
- Please read our [Security Policy](SECURITY.md) for information on reporting vulnerabilities.
- Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in the community.

---

## 🏷️ Tags / Keywords (SEO)
`music-player` `streaming` `audio-engine` `jiosaavn-api` `spatial-audio` `hifi-streaming` `320kbps` `dsp` `web-audio-api` `convolver` `reverb` `nodejs` `proxy-server` `mobile-first` `pwa` `telegram-mini-app` `glassmorphism` `equalizer` `biquad-filter` `javascript`
