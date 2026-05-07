# Clash Musics

a web-based music player that streams from JioSaavn. built this because i wanted something clean that just works without account signups or ads.

## what it does

- search and play any song from JioSaavn's library
- auto-detects which API mirror is alive (has like 6 fallbacks)
- liked songs, playlists, play history — all saved locally
- "made for you" recommendations based on what you listen to
- audio visualizer (bars/wave/circle) + 5-band EQ with presets
- crossfade, gapless playback
- lyrics (pulls from LRCLIB + JioSaavn)
- share songs/playlists via link
- download songs
- sleep timer, keyboard shortcuts, drag-and-drop queue
- themes (dark, amoled, midnight, purple haze, sunset)
- works on mobile too — telegram mini app compatible

## running locally

just need a static server since it uses ES modules. included a powershell script:

```
./serve.ps1
```

opens on `http://localhost:8080`

or use whatever server you want — python, live-server, etc:

```
python -m http.server 8080
npx serve .
```

## project structure

```
index.html      — main page, all the markup
styles.css      — everything visual
main.js         — entry point, boots the app, loads categories
api.js          — JioSaavn API integration with multi-endpoint failover
player.js       — audio engine (play, pause, queue, shuffle, crossfade, etc)
storage.js      — localStorage wrapper + taste/recommendation engine
ui.js           — DOM manipulation, event handlers, all the UI logic
visualizer.js   — Web Audio API visualizer + equalizer
serve.ps1       — local dev server (powershell)
```

## tech

- vanilla js, no frameworks, no build step
- Web Audio API for visualizer + EQ
- JioSaavn unofficial API (saavn.dev + mirrors)
- LRCLIB for synced lyrics
- ColorThief for dynamic accent colors from album art

## keyboard shortcuts

| key | action |
|-----|--------|
| `Space` | play/pause |
| `→` / `←` | next / prev |
| `↑` / `↓` | volume |
| `/` | focus search |
| `S` | shuffle |
| `R` | repeat |
| `F` | fullscreen player |
| `Q` | queue |
| `L` | like current song |
| `M` | mute |
| `Esc` | close overlays |

## license

MIT — do whatever you want with it

---

made by [ajisth](https://github.com/ajisth)
