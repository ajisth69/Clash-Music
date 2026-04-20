/**
 * ═══════════════════════════════════════════
 *  main.js — Entry Point (v3 — Premium)
 * ═══════════════════════════════════════════
 */

import * as API     from './api.js';
import * as Player  from './player.js';
import * as Storage from './storage.js';
import * as UI      from './ui.js';

/* ── Categories ── */
const CATEGORIES = [
  { rowId: 'row-anime',     query: 'anime opening song japanese',   label: 'Anime OSTs' },
  { rowId: 'row-bollywood', query: 'bollywood latest hits 2024',    label: 'Bollywood Hits' },
  { rowId: 'row-global',    query: 'top english hits 2024',         label: 'Global Top Charts' },
  { rowId: 'row-lofi',      query: 'lofi chill beats hindi',        label: 'Lo-Fi & Chill' },
  { rowId: 'row-punjabi',   query: 'punjabi hits latest 2024 sidhu',label: 'Punjabi Bangers' },
  { rowId: 'row-golden',    query: 'old hindi golden songs classic', label: 'Golden Era Classics' },
];

/* ── Boot ── */
async function boot() {
  console.log('%c♫ Clash Musics', 'color:#8b6cff;font-size:20px;font-weight:900;');

  UI.initUI();
  Player.restoreState();
  setGreeting();

  // Init API (multi-failover probe)
  const endpoint = await API.init();
  if (!endpoint) {
    UI.showToast('Cannot connect. Check your internet.', 'ph ph-wifi-x');
    return;
  }

  // Intercept shared URLs
  await UI.processShareLink();

  // Load everything
  await Promise.all([
    loadCategories(),
    loadRecommendations(),
  ]);

  wireSearch();
}

/* ── Greeting ── */
function setGreeting() {
  const el = document.getElementById('hero-greeting');
  if (!el) return;
  const h = new Date().getHours();
  if (h < 5)       el.textContent = 'Night owl mode 🦉';
  else if (h < 12) el.textContent = 'Good morning ☀️';
  else if (h < 17) el.textContent = 'Good afternoon';
  else if (h < 21) el.textContent = 'Good evening ✨';
  else             el.textContent = 'Good night 🌙';
}

/* ── Categories ── */
async function loadCategories() {
  await Promise.allSettled(
    CATEGORIES.map(async (cat) => {
      const container = document.getElementById(cat.rowId);
      if (!container) return;
      try {
        const songs = await API.fetchCategorySongs(cat.query, 15);
        UI.renderSongRow(container, songs);
      } catch {
        container.innerHTML = `<p style="color:var(--text-muted);padding:16px;font-size:0.8rem;">Could not load.</p>`;
      }
    })
  );
}

/* ── Your Taste — Recommendation Engine ── */
async function loadRecommendations() {
  const section = document.getElementById('section-taste');
  const row     = document.getElementById('row-taste');
  const tag     = document.getElementById('taste-tag');
  if (!section || !row) return;

  const queries = Storage.getTasteQueries();
  const summary = Storage.getTasteSummary();

  if (queries.length === 0) { section.classList.add('hidden'); return; }

  section.classList.remove('hidden');

  // Update tag
  if (summary && tag) {
    if (summary.topMood && summary.topArtists.length > 0) {
      tag.textContent = `${summary.topMood} × ${summary.topArtists[0]}`;
    } else if (summary.topArtists.length > 0) {
      tag.textContent = summary.topArtists.slice(0, 2).join(' & ');
    }
  }

  try {
    const results = await Promise.allSettled(
      queries.map(q => API.searchSongs(q, 8))
    );

    const seen = new Set();
    const historyIds = new Set(Storage.getHistory().map(s => s.id));
    let recs = [];

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        for (const song of r.value) {
          if (!seen.has(song.id) && !historyIds.has(song.id)) {
            seen.add(song.id);
            recs.push(song);
          }
        }
      }
    }

    // Fisher-Yates shuffle
    for (let i = recs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [recs[i], recs[j]] = [recs[j], recs[i]];
    }

    recs = recs.slice(0, 15);

    if (recs.length > 0) {
      UI.renderSongRow(row, recs);
    } else {
      section.classList.add('hidden');
    }
  } catch {
    section.classList.add('hidden');
  }
}

/* ── Search ── */
let searchTimer = null;

function wireSearch() {
  const input = document.getElementById('search-input');

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) { UI.showHome(); return; }

    searchTimer = setTimeout(async () => {
      try {
        // Now using global searchAll instead of just songs
        const results = await API.searchAll(q, 15);
        UI.showSearchResults(results, q);
      } catch {
        UI.showToast('Search failed', 'ph ph-warning-circle');
      }
    }, 350);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { 
      input.value = ''; 
      input.blur(); 
      UI.showHome(); 
      return; 
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (!q) return;
      
      input.blur(); // close mobile keyboard
      UI.showToast(`Searching for "${q}"...`, 'ph ph-spinner spin-anim');
      API.searchAll(q, 15)
        .then(results => UI.showSearchResults(results, q))
        .catch(() => UI.showToast('Search failed', 'ph ph-warning-circle'));
    }
  });
}

boot();
