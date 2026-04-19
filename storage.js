/**
 * ═══════════════════════════════════════════
 *  storage.js — Persistence & Taste Engine
 * ═══════════════════════════════════════════
 */

const KEYS = {
  VOLUME:    'clash_volume',
  LAST:      'clash_lastPlayed',
  HISTORY:   'clash_history',
  LIKED:     'clash_liked',
  PLAYLISTS: 'clash_playlists',
};

function readJSON(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ── Volume ── */
export function getVolume() {
  const v = parseFloat(localStorage.getItem(KEYS.VOLUME));
  return isNaN(v) ? 0.7 : Math.min(1, Math.max(0, v));
}
export function saveVolume(vol) { localStorage.setItem(KEYS.VOLUME, String(vol)); }

/* ── Last Played ── */
export function getLastPlayed() { return readJSON(KEYS.LAST, null); }
export function saveLastPlayed(song) { if (song) writeJSON(KEYS.LAST, song); }

/* ── History ── */
export function getHistory() { return readJSON(KEYS.HISTORY, []); }

export function addToHistory(song) {
  if (!song?.id) return;
  let h = getHistory().filter(s => s.id !== song.id);
  h.unshift(song);
  if (h.length > 10) h = h.slice(0, 10);
  writeJSON(KEYS.HISTORY, h);
}

/* ── Liked ── */
export function getLiked() { return readJSON(KEYS.LIKED, []); }
export function isLiked(id) { return getLiked().some(s => s.id === id); }

export function toggleLike(song) {
  if (!song?.id) return false;
  let liked = getLiked();
  const idx = liked.findIndex(s => s.id === song.id);
  if (idx > -1) { liked.splice(idx, 1); writeJSON(KEYS.LIKED, liked); return false; }
  liked.unshift(song); writeJSON(KEYS.LIKED, liked); return true;
}

/* ══════════════════════════════════════════
   TASTE ENGINE — Smarter Recommendations
   ══════════════════════════════════════════

   Strategy:
   ─────────
   1. Score artists by frequency × recency (recent plays = higher weight)
   2. Extract mood keywords from song titles (love, sad, party, etc.)
   3. Build diverse queries mixing:
      • Top-scored artists → "Artist best songs"
      • Artist pairs → "Artist1 Artist2" (cross-pollination)
      • Mood-based → "sad hindi songs" / "party bollywood"
      • Language-based → most listened language
      • "Because you liked X" → use a loved song's title
   4. De-duplicate, shuffle, exclude already-heard songs
*/

const MOOD_KEYWORDS = {
  romantic: ['love', 'pyar', 'ishq', 'dil', 'heart', 'romance', 'baby', 'darling', 'mohabbat', 'tumse'],
  sad:      ['sad', 'dard', 'broken', 'cry', 'miss', 'alone', 'judai', 'bewafa', 'tanha', 'pain'],
  party:    ['party', 'dance', 'dj', 'beat', 'club', 'bass', 'vibe', 'fire', 'lit', 'moves'],
  chill:    ['chill', 'lofi', 'relax', 'peace', 'calm', 'sleep', 'rain', 'drive', 'night'],
  hype:     ['rap', 'hip hop', 'hustle', 'king', 'boss', 'squad', 'gang', 'flex', 'grind'],
};

function detectMoods(songs) {
  const moodScores = {};

  songs.forEach(song => {
    const text = `${song.title} ${song.album || ''}`.toLowerCase();
    for (const [mood, words] of Object.entries(MOOD_KEYWORDS)) {
      for (const w of words) {
        if (text.includes(w)) {
          moodScores[mood] = (moodScores[mood] || 0) + 1;
          break; // one match per mood per song
        }
      }
    }
  });

  return Object.entries(moodScores)
    .sort((a, b) => b[1] - a[1])
    .map(([mood]) => mood);
}

function scoreArtists(songs) {
  const scores = {};

  songs.forEach((song, index) => {
    if (!song.artist) return;
    // Recency weight: newer songs (lower index) score higher
    const recencyBoost = Math.max(1, 5 - index * 0.3);

    song.artist.split(/,\s*/).forEach(a => {
      const name = a.trim();
      if (name && name !== 'Unknown Artist' && name.length > 1) {
        scores[name] = (scores[name] || 0) + recencyBoost;
      }
    });
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => ({ name, score }));
}

export function getTasteQueries() {
  const history = getHistory();
  const liked   = getLiked();

  // Merge with liked songs weighted 2x (user explicitly chose them)
  const allSongs = [];
  liked.forEach(s => { allSongs.push(s); allSongs.push(s); }); // double weight
  history.forEach(s => allSongs.push(s));

  if (allSongs.length < 2) return [];

  const scoredArtists = scoreArtists(allSongs);
  const moods = detectMoods(allSongs);
  const topArtists = scoredArtists.slice(0, 6);

  // Detect dominant language
  const langCount = {};
  allSongs.forEach(s => {
    if (s.language) langCount[s.language] = (langCount[s.language] || 0) + 1;
  });
  const topLang = Object.entries(langCount).sort((a,b) => b[1]-a[1])[0]?.[0] || '';

  const queries = [];

  // 1. Top artist deep-dive
  if (topArtists[0]) queries.push(`${topArtists[0].name} songs`);

  // 2. Second artist discovery
  if (topArtists[1]) queries.push(`${topArtists[1].name} latest`);

  // 3. Cross-pollination (artist pair)
  if (topArtists.length >= 3) {
    queries.push(`${topArtists[0].name} ${topArtists[2].name}`);
  }

  // 4. Mood-based query
  if (moods[0]) {
    const moodLang = topLang && topLang !== 'english' ? ` ${topLang}` : '';
    queries.push(`${moods[0]}${moodLang} songs`);
  }

  // 5. "Because you liked…" — random liked song's title
  if (liked.length > 0) {
    const pick = liked[Math.floor(Math.random() * Math.min(liked.length, 5))];
    const clean = pick.title.replace(/[^a-zA-Z\u0900-\u097F\s]/g, '').trim();
    if (clean.length > 2) queries.push(clean);
  }

  // 6. Lesser-known artist (for discovery)
  if (topArtists.length >= 4) {
    queries.push(`${topArtists[3].name} best`);
  }

  // 7. Language + vibe combo
  if (topLang && moods[1]) {
    queries.push(`${topLang} ${moods[1]} songs`);
  }

  return [...new Set(queries)].slice(0, 5);
}

export function getTasteSummary() {
  const history = getHistory();
  const liked   = getLiked();
  if (history.length === 0 && liked.length === 0) return null;

  const all = [...liked, ...liked, ...history]; // liked weighted 2x
  const scored = scoreArtists(all);
  const topArtists = scored.slice(0, 3).map(a => a.name);
  const moods = detectMoods(all);

  return {
    totalListened: history.length,
    totalLiked: liked.length,
    topArtists,
    topMood: moods[0] || null,
  };
}

/* ══════════════════════════════════════════
   CUSTOM PLAYLISTS 
   ══════════════════════════════════════════ */

export function getPlaylists() {
  return readJSON(KEYS.PLAYLISTS, []);
}

export function createPlaylist(name) {
  if (!name || !name.trim()) return null;
  const pList = getPlaylists();
  const newPlaylist = {
    id: 'pl_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: name.trim(),
    songs: []
  };
  pList.push(newPlaylist);
  writeJSON(KEYS.PLAYLISTS, pList);
  return newPlaylist;
}

export function addToPlaylist(playlistId, song) {
  if (!playlistId || !song?.id) return false;
  const pList = getPlaylists();
  const playlist = pList.find(p => p.id === playlistId);
  if (!playlist) return false;
  
  // Prevent strict duplicates in the same playlist
  if (playlist.songs.some(s => s.id === song.id)) return false;
  
  playlist.songs.push(song);
  writeJSON(KEYS.PLAYLISTS, pList);
  return true;
}
