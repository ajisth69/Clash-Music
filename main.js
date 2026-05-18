// main.js — app entry point v2

import * as API     from './api.js';
import * as Player  from './player.js';
import * as Storage from './storage.js';
import * as UI      from './ui.js';

/* ── Detect Telegram Mini App ── */
const isTelegram = !!(window.Telegram?.WebApp);
if (isTelegram) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  document.body.classList.add('tg-miniapp');
}

/* ── Category definitions with multi-query infinite support ── */
const CATEGORIES = [
  {
    rowId: 'row-anime',
    label: 'Anime OSTs',
    queries: [
      'Dikz', 'Rage The Rapper anime', 'In Lofi Chill',
      'anime rap hindi', 'anime opening song', 'lofi anime beats',
      'naruto soundtrack', 'attack on titan ost', 'demon slayer ost',
      'one piece soundtrack', 'anime instrumental', 'jujutsu kaisen ost',
    ],
    page: 1, fetching: false,
  },
  {
    rowId: 'row-bollywood',
    label: 'Bollywood Hits',
    queries: ['bollywood hits 2024', 'arijit singh latest', 'new hindi songs 2024', 'bollywood popular'],
    page: 1, fetching: false,
  },
  {
    rowId: 'row-global',
    label: 'Global Top Charts',
    queries: ['top english hits 2024', 'billboard hot 100', 'pop hits 2024', 'trending english songs'],
    page: 1, fetching: false,
  },
  {
    rowId: 'row-lofi',
    label: 'Lo-Fi & Chill',
    queries: [
      'lofi hip hop', 'lofi beats study', 'chill music relax',
      'lo fi chill', 'lofi songs hindi', 'chillhop music',
      'lofi playlist', 'relaxing music beats', 'night lofi',
    ],
    page: 1, fetching: false,
  },
  {
    rowId: 'row-punjabi',
    label: 'Punjabi Bangers',
    queries: ['punjabi hits 2024', 'diljit dosanjh', 'sidhu moosewala', 'ap dhillon latest', 'punjabi songs trending'],
    page: 1, fetching: false,
  },
  {
    rowId: 'row-golden',
    label: 'Golden Era Classics',
    queries: ['old hindi golden songs', 'kishore kumar hits', 'lata mangeshkar classic', 'retro bollywood 90s', 'mohammad rafi songs'],
    page: 1, fetching: false,
  },
];

/* ── "Your Taste" infinite state ── */
let tastePage     = 1;
let tasteFetching = false;
let tasteQueries  = [];
let tasteHeard    = new Set();

async function boot() {
  console.log('%c♫ Clash Musics v2', 'color:#8b6cff;font-size:20px;font-weight:900;');

  UI.initUI();
  Player.restoreState();
  setGreeting();

  const endpoint = await API.init();
  if (!endpoint) { UI.showToast('Cannot connect. Check internet.', 'ph ph-wifi-x'); return; }

  await UI.processShareLink();
  await Promise.all([loadCategories(), loadYourTaste()]);
  wireSearch();
  initHomeInfiniteScroll();
}

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

/* ── Load all category sections ── */
async function loadCategories() {
  await Promise.allSettled(
    CATEGORIES.map(async (cat) => {
      const container = document.getElementById(cat.rowId);
      if (!container) return;
      try {
        const songs = await fetchCategoryPage(cat, 1);
        UI.renderSongRow(container, songs);
        // Attach horizontal infinite scroll
        attachRowInfiniteScroll(cat, container);
      } catch {
        container.innerHTML = `<p style="color:var(--text-muted);padding:16px;font-size:0.8rem;">Could not load.</p>`;
      }
    })
  );
}

/* ── Fetch one page for a category (rotates through queries) ── */
async function fetchCategoryPage(cat, page) {
  const perQuery = 8;
  const results  = await Promise.allSettled(
    cat.queries.map(q => API.searchSongs(q, perQuery, page))
  );
  const seen  = new Set();
  let songs = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      r.value.forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); songs.push(s); } });
    }
  });
  // Shuffle
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }
  return songs.slice(0, 24);
}

/* ── Horizontal infinite scroll per row ── */
function attachRowInfiniteScroll(cat, container) {
  container.addEventListener('scroll', async () => {
    if (cat.fetching) return;
    const nearEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 200;
    if (!nearEnd) return;
    cat.fetching = true;
    cat.page++;
    try {
      const more = await fetchCategoryPage(cat, cat.page);
      if (more.length) UI.appendSongRow(container, more);
    } catch { /* skip */ }
    cat.fetching = false;
  }, { passive: true });
}

/* ── Your Taste — Advanced Personalized Feed ── */
async function loadYourTaste() {
  const section = document.getElementById('section-taste');
  const row     = document.getElementById('row-taste');
  const tag     = document.getElementById('taste-tag');
  if (!section || !row) return;

  tasteQueries = Storage.getTasteQueries();
  const summary = Storage.getTasteSummary();

  if (tasteQueries.length === 0) { section.classList.add('hidden'); return; }

  section.classList.remove('hidden');

  if (summary && tag) {
    if (summary.topMood && summary.topArtists.length > 0)
      tag.textContent = `${summary.topMood} × ${summary.topArtists[0]}`;
    else if (summary.topArtists.length > 0)
      tag.textContent = summary.topArtists.slice(0, 2).join(' & ');
  }

  tasteHeard = Storage.getHeardSongIds(80);
  const songs = await fetchTastePage(1);
  if (songs.length) {
    UI.renderSongRow(row, songs);
    attachTasteInfiniteScroll(row);
  } else {
    section.classList.add('hidden');
  }
}

async function fetchTastePage(page) {
  const results = await Promise.allSettled(
    tasteQueries.map(q => API.searchSongs(q, 10, page))
  );
  const seen = new Set();
  let pool = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      for (const s of r.value) {
        // Exclude heard songs (listened ≥80%)
        if (!seen.has(s.id) && !tasteHeard.has(s.id)) {
          seen.add(s.id);
          pool.push(s);
        }
      }
    }
  }
  // Weighted shuffle — kept simple via Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 20);
}

function attachTasteInfiniteScroll(row) {
  row.addEventListener('scroll', async () => {
    if (tasteFetching) return;
    const nearEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 200;
    if (!nearEnd) return;
    tasteFetching = true;
    tastePage++;
    try {
      const more = await fetchTastePage(tastePage);
      if (more.length) UI.appendSongRow(row, more);
      else {
        // Recycle from page 1 with new shuffle
        tastePage = 1;
        const recycled = await fetchTastePage(tastePage);
        if (recycled.length) UI.appendSongRow(row, recycled);
      }
    } catch { /* skip */ }
    tasteFetching = false;
  }, { passive: true });
}

/* ── Vertical infinite scroll on home (load more sections) ── */
function initHomeInfiniteScroll() {
  const sentinel = document.getElementById('home-scroll-sentinel');
  if (!sentinel) return;
  const observer = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting) return;
    // When user hits bottom, reload all categories with next page
    for (const cat of CATEGORIES) {
      const container = document.getElementById(cat.rowId);
      if (!container || cat.fetching) continue;
      cat.fetching = true;
      cat.page++;
      try {
        const more = await fetchCategoryPage(cat, cat.page);
        if (more.length) UI.appendSongRow(container, more);
      } catch { /* skip */ }
      cat.fetching = false;
    }
  }, { rootMargin: '300px' });
  observer.observe(sentinel);
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
        const results = await API.searchAll(q, 15);
        UI.showSearchResults(results, q);
        UI.saveRecentSearch(q);
      } catch { UI.showToast('Search failed', 'ph ph-warning-circle'); }
    }, 350);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; input.blur(); UI.showHome(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (!q) return;
      input.blur();
      UI.showToast(`Searching "${q}"...`, 'ph ph-spinner spin-anim');
      API.searchAll(q, 15)
        .then(r => { UI.showSearchResults(r, q); UI.saveRecentSearch(q); })
        .catch(() => UI.showToast('Search failed', 'ph ph-warning-circle'));
    }
  });
}

boot();
