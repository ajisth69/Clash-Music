# 🎵 Clash Music

A high-performance, feature-rich music streaming application, installable **Progressive Web App (PWA)**, and native mobile experience built with **React 19**, **Vite**, **TailwindCSS v4**, and **Capacitor 6**. 

Clash Music combines online streaming, local audio library management, offline music playback (opens offline directly from URL without internet), Spotify playlist importing, and P2P sharing into a sleek, responsive dark-mode UI.

---

## ✨ Features

- **🌐 Progressive Web App (PWA)**: Fully installable PWA with offline URL loading via Service Worker (`sw.js`). Opens and plays offline tracks even without an active internet connection!
- **🚀 Online Streaming & Search**: Search and stream millions of high-quality songs, top charts, playlists, albums, and artist discographies powered by backend music API services.
- **📱 Native Android Support**: Full Capacitor 6 integration including hardware back button handling, native Android status bar styling, and mobile-optimized touch controls.
- **📂 Multi-Format Audio Support**: Stream, import, and play **any audio format** including **AAC**, **OPUS**, **OGG**, **FLAC**, **MP3**, **WAV**, **M4A / ALAC**, **WebM**, **WMA**, **AIFF**, **3GP**, and **AMR** with automatic tag parsing and cover art extraction.
- **⚡ Offline Playback & Storage**: Save your favorite tracks locally into IndexedDB (`playlistDb.js`) for seamless offline listening anywhere.
- **🟢 Spotify Import**: Easily import tracks and playlists from Spotify metadata.
- **🤝 Peer-to-Peer & Cloud Sharing**: WebRTC peer sharing via `PeerJS` and Cloudflare Worker endpoints for custom track link sharing.
- **🎨 Modern Dark Aesthetic**: Built with glassmorphism, fluid responsive layouts, Framer Motion animations, interactive audio visualizer, docked player bar, and expandable full-screen player.
- **📦 Backup & Restore**: Export and import your library, favorites, and playlists in `.json` or `.zip` format.

---

## 🛠️ Tech Stack

- **Frontend Core**: [React 19](https://react.dev/), [Vite 8](https://vitejs.dev/), JavaScript (ESM)
- **Styling & Animations**: [TailwindCSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **Icons & UI**: [Lucide React](https://lucide.dev/), Canvas Confetti
- **Mobile Native**: [@capacitor/core](https://capacitorjs.com/), `@capacitor/android`, `@capacitor/app`, `@capacitor/status-bar`
- **Audio & Media**: HTML5 Audio API, `jsmediatags`, `jszip`, `file-saver`
- **Networking & P2P**: `peerjs`, `@vercel/edge`, Cloudflare Workers

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.x` or higher
- **npm**: `v9.x` or higher
- *(Optional for Android build)* **Android Studio** & **JDK 17+**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ajisth69/Clash-Music.git
   cd Clash-Music
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` (or the port specified in terminal) in your browser.

---

## 📜 Available Scripts

- `npm run dev` — Starts Vite dev server with hot module replacement (HMR).
- `npm run build` — Builds production-ready web assets in `dist/`.
- `npm run preview` — Locally previews the production build.
- `npm run lint` — Runs `oxlint` for fast code linting.
- `npm run assets:generate` — Generates mobile icons and splash assets for Capacitor Android.

---

## 📱 Mobile Build (Android)

To sync web build with the Capacitor Android project:

```bash
# 1. Build the web app
npm run build

# 2. Sync files with Capacitor
npx cap sync android

# 3. Open project in Android Studio
npx cap open android
```

---

## 📁 Project Structure

```text
clash-music/
├── android/                   # Capacitor Android native project
├── public/                    # Static assets (logo, favicons)
├── src/
│   ├── assets/                # Design assets
│   ├── components/            # UI components (DockedPlayer, MaximizedPlayerModal, HomeView, etc.)
│   ├── context/               # Global state (AudioContext, LibraryContext)
│   ├── services/              # API, Local DB, File Importers & Share utilities
│   ├── App.jsx                # Main Application routing & layout
│   ├── index.css              # Global styles & Tailwind CSS imports
│   └── main.jsx               # Application entry point
├── worker/                    # Cloudflare Share Worker script
├── capacitor.config.json      # Capacitor configuration
├── vite.config.js             # Vite configuration
└── package.json               # Dependencies and scripts
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

