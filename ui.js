/**
 * ═══════════════════════════════════════════
 *  ui.js — Final UI Controller
 *
 *  Features:
 *    • Custom cursor with hover states
 *    • 3D card tilt on mouse move
 *    • Ripple effect on buttons
 *    • Intersection Observer scroll reveals
 *    • Now Playing fullscreen overlay
 *    • Queue panel
 *    • Keyboard shortcuts modal
 *    • Scroll-to-top
 *    • Ambient glow
 *    • Duration badges on cards
 * ═══════════════════════════════════════════
 */

import * as Player  from './player.js';
import * as Storage from './storage.js';
import * as Api     from './api.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ── DOM Refs ── */
const viewHome      = $('#view-home');
const viewSearch    = $('#view-search');
const viewLiked     = $('#view-liked');
const viewPlaylists = $('#view-playlists');
const viewHistory   = $('#view-history');

const searchInput        = $('#search-input');
const searchResultsTitle = $('#search-results-title');
const searchResultsGrid  = $('#search-results-grid');
const likedGrid          = $('#liked-songs-grid');
const likedEmpty         = $('#liked-empty');
const historyGrid        = $('#history-grid');
const historyEmpty       = $('#history-empty');

const playerSong     = $('#player-song');
const playerArtist   = $('#player-artist');
const playerArt      = $('#player-art');
const artWrap        = $('.player-bar__art-wrap');
const playerLikeBtn  = $('#player-like-btn');
const playerLikeIcon = $('#player-like-icon');
const playerDlBtn    = $('#player-dl-btn');

const btnHome       = $('#btn-home');
const btnLiked      = $('#btn-liked');
const btnPlaylists  = $('#btn-playlists');
const btnHistory    = $('#btn-history');
const toastBox      = $('#toast-container');
const ambientGlow   = $('#ambient-glow');

/* ── State ── */
let currentSearchQuery = '';
let currentSearchPage  = 1;
let isFetchingMore     = false;
let currentPlaylistSong = null; // For modal


/* ══════════════════════════════
   HELPERS
   ══════════════════════════════ */

function decode(str) {
  const t = document.createElement('textarea');
  t.innerHTML = str || '';
  return t.value;
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function fmtDuration(sec) {
  if (!sec) return '';
  return fmtTime(sec);
}

/* ── Toast ── */
export function showToast(msg, icon = 'ph ph-check-circle') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="${icon}"></i><span>${msg}</span>`;
  toastBox.appendChild(t);
  setTimeout(() => {
    t.classList.add('toast--removing');
    t.addEventListener('animationend', () => t.remove());
  }, 3000);
}

/* ── Download ── */
async function downloadSong(song, btn = null) {
  if (!song?.streamUrl) { showToast('No download URL', 'ph ph-warning-circle'); return; }
  const name = decode(song.title).replace(/[<>:"/\\|?*]+/g, '').trim();
  const art  = decode(song.artist).replace(/[<>:"/\\|?*]+/g, '').trim();
  const file = `${name} - ${art}.m4a`;

  if (btn) { btn.classList.add('downloading'); const i = btn.querySelector('i'); if (i) i.className = 'ph ph-spinner'; }
  showToast(`Downloading…`, 'ph ph-download-simple');

  try {
    const res = await fetch(song.streamUrl, { mode: 'cors' });
    if (!res.ok) throw 0;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('Downloaded ✓', 'ph ph-check-circle');
  } catch {
    const a = document.createElement('a');
    a.href = song.streamUrl; a.download = file; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    showToast('Opened in new tab — save from there', 'ph ph-arrow-square-out');
  } finally {
    if (btn) { btn.classList.remove('downloading'); const i = btn.querySelector('i'); if (i) i.className = 'ph ph-download-simple'; }
  }
}

/* ── Ambient Glow ── */
function updateGlow(img) {
  if (!ambientGlow) return;
  if (!img) { ambientGlow.classList.remove('active'); return; }
  ambientGlow.style.background = `url("${img}") center/cover no-repeat`;
  ambientGlow.classList.add('active');
}

/* Custom cursor removed — native cursor is smoother */

/* ══════════════════════════════
   RIPPLE EFFECT
   ══════════════════════════════ */
function addRipple(el, e) {
  const rect = el.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top  = (e.clientY - rect.top - size / 2) + 'px';
  el.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

/* ══════════════════════════════
   3D CARD TILT
   ══════════════════════════════ */
function initCardTilt(card) {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(600px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-4px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
}

/* ══════════════════════════════
   SCROLL REVEAL
   ══════════════════════════════ */
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        observer.unobserve(en.target);
      }
    });
  }, { threshold: 0.1 });

  $$('.reveal').forEach(el => observer.observe(el));
}

/* ══════════════════════════════
   SCROLL TO TOP
   ══════════════════════════════ */
function initScrollTop() {
  const btn = $('#scroll-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('hidden', window.scrollY < 400);
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ══════════════════════════════
   SONG CARD
   ══════════════════════════════ */
function createSongCard(song, list, idx) {
  const card = document.createElement('div');
  card.className = 'song-card';
  card.dataset.songId = song.id;

  const liked = Storage.isLiked(song.id);
  const dur = fmtDuration(song.duration);

  card.innerHTML = `
    <div class="song-card__img-wrap">
      <img class="song-card__img" src="${song.image}" alt="${decode(song.title)}"
        loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23181822%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23444%22 font-size=%2250%22%3E♫%3C/text%3E%3C/svg%3E'" />
      <div class="song-card__overlay">
        <button class="song-card__play-btn" aria-label="Play"><i class="ph-fill ph-play"></i></button>
      </div>
      ${dur ? `<span class="song-card__duration">${dur}</span>` : ''}
      <button class="song-card__like-btn ${liked ? 'liked' : ''}" aria-label="Like"><i class="${liked ? 'ph-fill' : 'ph'} ph-heart"></i></button>
      <button class="song-card__playlist-btn" aria-label="Add to Playlist"><i class="ph-bold ph-plus"></i></button>
      <button class="song-card__share-btn" aria-label="Share Song"><i class="ph ph-share-network"></i></button>
      <button class="song-card__dl-btn" aria-label="Download"><i class="ph ph-download-simple"></i></button>
    </div>
    <div class="song-card__info">
      <div class="song-card__title" title="${decode(song.title)}">${decode(song.title)}</div>
      <div class="song-card__artist" title="${decode(song.artist)}">${decode(song.artist)}</div>
    </div>
  `;

  // Play
  const play = () => Player.playSong(song, list, idx);
  card.querySelector('.song-card__play-btn').addEventListener('click', (e) => { addRipple(e.currentTarget, e); play(); });
  card.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    play();
  });

  // Like
  card.querySelector('.song-card__like-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const l = Storage.toggleLike(song);
    syncCardLike(card, l);
    syncPlayerLike();
    showToast(l ? `Liked "${decode(song.title)}"` : 'Removed', l ? 'ph-fill ph-heart' : 'ph ph-heart-break');
  });

  // Playlist Add
  card.querySelector('.song-card__playlist-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openPlaylistModal(song);
  });

  // Share
  card.querySelector('.song-card__share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?songId=${song.id}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!', 'ph ph-link');
    });
  });

  // Download
  const dlBtn = card.querySelector('.song-card__dl-btn');
  dlBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadSong(song, dlBtn); });

  // 3D tilt
  initCardTilt(card);

  return card;
}

function syncCardLike(card, liked) {
  const btn = card.querySelector('.song-card__like-btn');
  const ico = btn?.querySelector('i');
  if (!btn || !ico) return;
  btn.classList.toggle('liked', liked);
  ico.className = liked ? 'ph-fill ph-heart' : 'ph ph-heart';
}

/* ══════════════════════════════
   RENDER
   ══════════════════════════════ */
export function renderSongRow(container, songs) {
  container.innerHTML = '';
  if (!songs?.length) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:8px;font-size:0.8rem;">No songs found</p>';
    return;
  }
  songs.forEach((s, i) => container.appendChild(createSongCard(s, songs, i)));
  highlightPlaying();
}

/* ══════════════════════════════
   VIEW MANAGEMENT
   ══════════════════════════════ */
function hideAll() {
  [viewHome, viewSearch, viewLiked, viewPlaylists, viewHistory].forEach(v => v?.classList.add('hidden'));
  [btnHome, btnLiked, btnPlaylists, btnHistory].forEach(b => b?.classList.remove('active'));
}

export function showHome() {
  hideAll();
  viewHome.classList.remove('hidden');
  btnHome.classList.add('active');
  searchInput.value = '';
  initReveal();
}

let searchObserver = null;

export function showSearchResults(results, query, isAppend = false) {
  hideAll();
  viewSearch.classList.remove('hidden');
  searchResultsTitle.textContent = `Results for "${query}"`;
  
  if (!isAppend) {
    searchResultsGrid.innerHTML = '';
    currentSearchQuery = query;
    currentSearchPage = 1;
    isFetchingMore = false;
  }
  
  if (!results?.length) {
    if (!isAppend) searchResultsGrid.innerHTML = '<p style="color:var(--text-muted);padding:20px;">No results.</p>';
    $('#search-loading-spinner')?.classList.add('hidden');
    return;
  }
  
  results.forEach((s, i) => searchResultsGrid.appendChild(createSongCard(s, results, i)));
  
  // Show spinner and mount observer
  const spinner = $('#search-loading-spinner');
  if (spinner) {
    spinner.classList.remove('hidden');
    if (!searchObserver) {
      searchObserver = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore && currentSearchQuery) {
          isFetchingMore = true;
          currentSearchPage++;
          const nextResults = await Api.searchSongs(currentSearchQuery, 20, currentSearchPage);
          if (nextResults?.length) {
            showSearchResults(nextResults, currentSearchQuery, true);
          } else {
            spinner.classList.add('hidden'); // no more results
          }
          isFetchingMore = false;
        }
      }, { rootMargin: '100px' });
      searchObserver.observe(spinner);
    }
  }
}

function showLiked() {
  hideAll();
  viewLiked.classList.remove('hidden');
  btnLiked.classList.add('active');
  const liked = Storage.getLiked();
  likedGrid.innerHTML = '';
  if (!liked.length) { likedEmpty.classList.remove('hidden'); return; }
  likedEmpty.classList.add('hidden');
  liked.forEach((s, i) => likedGrid.appendChild(createSongCard(s, liked, i)));
}

function showHistory() {
  hideAll();
  viewHistory.classList.remove('hidden');
  btnHistory.classList.add('active');
  const hist = Storage.getHistory();
  historyGrid.innerHTML = '';
  if (!hist.length) { historyEmpty.classList.remove('hidden'); return; }
  historyEmpty.classList.add('hidden');
  hist.forEach((s, i) => historyGrid.appendChild(createSongCard(s, hist, i)));
}

function showPlaylists() {
  hideAll();
  viewPlaylists.classList.remove('hidden');
  btnPlaylists.classList.add('active');
  
  const pContainer = $('#playlists-container');
  const emptyState = $('#playlists-empty');
  const pList = Storage.getPlaylists();
  
  pContainer.innerHTML = '';
  
  if (!pList.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  
  pList.forEach(p => {
    // Render Playlist Header
    const hdr = document.createElement('div');
    hdr.style.marginBottom = '20px';
    hdr.style.display = 'flex';
    hdr.style.alignItems = 'center';
    hdr.style.gap = '12px';
    
    hdr.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.2rem; margin: 0;">${decode(p.name)}</h3>
      <button class="playlist-share-btn" data-id="${p.id}" title="Share Playlist" style="background:rgba(255,255,255,0.05); border:none; border-radius:4px; padding:6px; color:#fff; cursor:pointer;" aria-label="Share Playlist"><i class="ph ph-share-network"></i></button>
    `;
    pContainer.appendChild(hdr);
    
    // Bind share event
    const shareBtn = hdr.querySelector('.playlist-share-btn');
    shareBtn.addEventListener('click', () => {
      const ids = p.songs.map(s => s.id);
      const b64 = btoa(JSON.stringify(ids));
      const url = `${window.location.origin}${window.location.pathname}?pName=${encodeURIComponent(p.name)}&pData=${encodeURIComponent(b64)}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Playlist link copied!', 'ph ph-link');
      });
    });
    
    // Render Playlist Songs Grid
    const grid = document.createElement('div');
    grid.className = 'search-results-grid'; // Reusing grid class
    grid.style.padding = '0 0 16px 0';
    
    if (!p.songs.length) {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size: 0.85rem;">Empty playlist</p>';
    } else {
      p.songs.forEach((s, i) => grid.appendChild(createSongCard(s, p.songs, i)));
    }
    pContainer.appendChild(grid);
  });
}

/* ══════════════════════════════
   PLAYER UI SYNC
   ══════════════════════════════ */
export function updatePlayerUI(song) {
  if (!song) return;
  playerSong.textContent = decode(song.title);
  playerArtist.textContent = decode(song.artist);
  playerArt.src = song.image || '';
  playerArt.onerror = () => { playerArt.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23181822'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%23444' font-size='22'%3E♫%3C/text%3E%3C/svg%3E"; };
  syncPlayerLike();
  updateGlow(song.image);
  document.title = `${decode(song.title)} — Clash Musics`;

  // Now Playing overlay
  const npArt   = $('#np-art');
  const npBg    = $('#np-bg');
  const npTitle  = $('#np-title');
  const npArtist = $('#np-artist');
  if (npArt)   npArt.src = song.image || '';
  if (npBg)    npBg.style.backgroundImage = `url("${song.image}")`;
  if (npTitle) npTitle.textContent = decode(song.title);
  if (npArtist) npArtist.textContent = decode(song.artist);
}

function syncPlayerLike() {
  const s = Player.getCurrentSong();
  if (!s) return;
  const liked = Storage.isLiked(s.id);
  playerLikeBtn.classList.toggle('liked', liked);
  playerLikeIcon.className = liked ? 'ph-fill ph-heart' : 'ph ph-heart';
}

export function setPlayingState(playing) {
  const icon = $('#play-icon');
  const npIcon = $('#np-play-icon');
  if (icon) icon.className = playing ? 'ph-fill ph-pause' : 'ph-fill ph-play';
  if (npIcon) npIcon.className = playing ? 'ph-fill ph-pause' : 'ph-fill ph-play';
  artWrap?.classList.toggle('spinning', playing);
}

export function updateProgress(pct) {
  const bar = $('#progress-bar');
  if (bar) bar.style.width = `${pct}%`;
}

export function updateTime(cur, dur) {
  const el = $('#player-time');
  if (el) el.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;

  const npCur = $('#np-time-current');
  const npDur = $('#np-time-duration');
  const npSeek = $('#np-seek');
  if (npCur) npCur.textContent = fmtTime(cur);
  if (npDur) npDur.textContent = fmtTime(dur);
  if (npSeek && dur) npSeek.value = (cur / dur) * 100;
}

export function highlightPlaying() {
  const cur = Player.getCurrentSong();
  $$('.song-card').forEach(c => c.classList.toggle('is-playing', c.dataset.songId === cur?.id));
}

/* ══════════════════════════════
   QUEUE PANEL
   ══════════════════════════════ */
function renderQueue() {
  const list  = $('#queue-list');
  const panel = $('#queue-panel');
  if (!list || !panel) return;

  const pl = Player.getPlaylist();
  const ci = Player.getCurrentIdx();
  list.innerHTML = '';

  if (!pl.length) {
    list.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center;font-size:0.8rem;">Queue is empty</p>';
    return;
  }

  pl.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = `queue-item${i === ci ? ' active' : ''}`;
    item.innerHTML = `
      <span class="queue-item__num">${i + 1}</span>
      <img class="queue-item__art" src="${song.image}" alt="" loading="lazy" onerror="this.style.display='none'" />
      <div class="queue-item__text">
        <div class="queue-item__title">${decode(song.title)}</div>
        <div class="queue-item__artist">${decode(song.artist)}</div>
      </div>
    `;
    item.addEventListener('click', () => Player.playSong(song, pl, i));
    list.appendChild(item);
  });
}

function toggleQueue() {
  const panel = $('#queue-panel');
  if (!panel) return;
  const showing = !panel.classList.contains('hidden');
  if (showing) {
    panel.classList.add('hidden');
  } else {
    renderQueue();
    panel.classList.remove('hidden');
  }
}

/* ══════════════════════════════
   NOW PLAYING OVERLAY
   ══════════════════════════════ */
let npOpen = false;

function openNowPlaying() {
  const overlay = $('#np-overlay');
  if (!overlay || npOpen) return;
  npOpen = true;
  overlay.classList.remove('hidden');
  overlay.style.animation = 'npSlideIn 0.45s var(--ease) forwards';
  document.body.style.overflow = 'hidden';
}

function closeNowPlaying() {
  const overlay = $('#np-overlay');
  if (!overlay || !npOpen) return;
  overlay.style.animation = 'npSlideOut 0.35s var(--ease) forwards';
  overlay.addEventListener('animationend', function handler() {
    overlay.removeEventListener('animationend', handler);
    overlay.classList.add('hidden');
    overlay.style.animation = '';
    document.body.style.overflow = '';
    npOpen = false;
  });
}

function toggleNowPlaying() {
  npOpen ? closeNowPlaying() : openNowPlaying();
}

/* ══════════════════════════════
   PLAYLIST MODAL & LYRICS
   ══════════════════════════════ */
function openPlaylistModal(song) {
  currentPlaylistSong = song;
  const modal = $('#playlist-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderPlaylistsInModal();
}

function closePlaylistModal() {
  const modal = $('#playlist-modal');
  if (modal) modal.classList.add('hidden');
  currentPlaylistSong = null;
}

function renderPlaylistsInModal() {
  const listParams = $('#playlist-list');
  if (!listParams) return;
  listParams.innerHTML = '';
  const pList = Storage.getPlaylists();
  
  if (!pList.length) {
    listParams.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); padding: 10px;">No playlists yet. Create one above!</p>';
    return;
  }
  
  pList.forEach(p => {
    const row = document.createElement('div');
    row.className = 'playlist-rowItem';
    row.innerHTML = `<span>${decode(p.name)}</span> <span style="font-size:0.7rem; color:var(--text-muted);">${p.songs.length} ♫</span>`;
    
    // Add logic
    row.addEventListener('click', () => {
      const res = Storage.addToPlaylist(p.id, currentPlaylistSong);
      if (res === 'added') {
        showToast(`Added to "${decode(p.name)}"`, 'ph ph-check-circle');
      } else if (res === 'full') {
        showToast('Playlist is full (Max 50)', 'ph ph-warning-limit');
      } else {
        showToast(`Already in "${decode(p.name)}"`, 'ph ph-info');
      }
      closePlaylistModal();
    });
    listParams.appendChild(row);
  });
}

function toggleLyricsPanel() {
  const pnl = $('#np-lyrics-panel');
  if (!pnl) return;
  
  const isHidden = pnl.classList.contains('hidden');
  if (isHidden) {
    const song = Player.getCurrentSong();
    if (!song) return;
    
    const ctn = $('#np-lyrics-content');
    ctn.textContent = 'Loading lyrics...';
    pnl.classList.remove('hidden');
    
    Api.getLyrics(song.id).then(lyrics => {
      if (!lyrics) ctn.textContent = "Lyrics not available for this track.";
      else ctn.textContent = lyrics.replace(/<br\s*\/?>/gi, '\n');
    }).catch(() => { ctn.textContent = "Error fetching lyrics."; });
  } else {
    pnl.classList.add('hidden');
  }
}

/* ══════════════════════════════
   SHUFFLE / REPEAT UI
   ══════════════════════════════ */
function syncShuffleUI() {
  const btn = $('#btn-shuffle');
  const npBtn = $('#np-shuffle');
  const on = Player.isShuffleOn();
  btn?.classList.toggle('active', on);
  npBtn?.classList.toggle('active', on);
}

function syncRepeatUI() {
  const btn = $('#btn-repeat');
  const npBtn = $('#np-repeat');
  const mode = Player.getRepeatMode();

  [btn, npBtn].forEach(b => {
    if (!b) return;
    b.classList.toggle('active', mode > 0);
    const i = b.querySelector('i');
    if (i) i.className = mode === 2 ? 'ph ph-repeat-once' : 'ph ph-repeat';
  });
}

/* ══════════════════════════════
   GLOBAL BOOT (URL PARSING)
   ══════════════════════════════ */
export async function processShareLink() {
  const params = new URLSearchParams(window.location.search);
  const songId = params.get('songId');
  const pName = params.get('pName');
  const pData = params.get('pData');

  if (songId) {
    const s = await Api.getSongById(songId);
    if (s) Player.playSong(s, [s], 0);
    // Cleanup URL
    window.history.replaceState(null, '', window.location.pathname);
  } else if (pName && pData) {
    try {
      const ids = JSON.parse(atob(decodeURIComponent(pData)));
      if (Array.isArray(ids) && ids.length) {
        showToast('Fetching shared playlist...', 'ph ph-spinner spin-anim');
        const songs = await Api.getSongsByIds(ids);
        if (songs.length) {
          Storage.importPlaylist(decodeURIComponent(pName), songs);
          showToast(`Saved "${decode(pName)}" to Playlists!`, 'ph-fill ph-check-circle');
          // Navigate to playlists tab optionally
          setTimeout(showPlaylists, 1500);
        } else {
          showToast('Failed to load playlist songs.', 'ph ph-x-circle');
        }
      }
    } catch (e) {
      console.warn('Invalid playlist payload', e);
      showToast('Corrupted playlist link.', 'ph ph-warning-circle');
    }
    // Cleanup URL
    window.history.replaceState(null, '', window.location.pathname);
  }
}

/* ══════════════════════════════
   INIT
   ══════════════════════════════ */
export function initUI() {
  // Remove cursor elements from DOM (no custom cursor)
  $('#cursor-dot')?.remove();
  $('#cursor-ring')?.remove();

  // Scroll reveal
  initReveal();

  // Scroll to top
  initScrollTop();

  // Player controls
  $('#btn-play')?.addEventListener('click', (e) => { addRipple(e.currentTarget, e); Player.toggle(); });
  $('#btn-prev')?.addEventListener('click', (e) => { addRipple(e.currentTarget, e); Player.prev(); });
  $('#btn-next')?.addEventListener('click', (e) => { addRipple(e.currentTarget, e); Player.next(); });

  // Shuffle / Repeat
  $('#btn-shuffle')?.addEventListener('click', () => { Player.toggleShuffle(); syncShuffleUI(); showToast(Player.isShuffleOn() ? 'Shuffle on' : 'Shuffle off', 'ph ph-shuffle'); });
  $('#btn-repeat')?.addEventListener('click', () => { Player.toggleRepeat(); syncRepeatUI(); const m = Player.getRepeatMode(); showToast(['Repeat off', 'Repeat all', 'Repeat one'][m], 'ph ph-repeat'); });

  // NP overlay controls
  $('#np-play')?.addEventListener('click', () => Player.toggle());
  $('#np-prev')?.addEventListener('click', () => Player.prev());
  $('#np-next')?.addEventListener('click', () => Player.next());
  // Click outside NP content to close
  $('#np-overlay')?.addEventListener('click', (e) => {
    if (!e.target.closest('.np-content') && !e.target.closest('.np-close')) closeNowPlaying();
  });
  $('#np-shuffle')?.addEventListener('click', () => { Player.toggleShuffle(); syncShuffleUI(); });
  $('#np-repeat')?.addEventListener('click', () => { Player.toggleRepeat(); syncRepeatUI(); });
  $('#np-seek')?.addEventListener('input', (e) => Player.seekTo(parseFloat(e.target.value)));
  $('#np-minimize')?.addEventListener('click', closeNowPlaying);

  // Volume
  const volSlider = $('#volume-slider');
  volSlider.value = Storage.getVolume();

  volSlider.addEventListener('input', () => {
    const v = parseFloat(volSlider.value);
    Player.setVolume(v);
    Storage.saveVolume(v);
    updateVolIcon(v);
  });

  $('#btn-mute')?.addEventListener('click', () => {
    const cur = parseFloat(volSlider.value);
    if (cur > 0) { volSlider.dataset.prev = cur; volSlider.value = 0; }
    else { volSlider.value = volSlider.dataset.prev || 0.7; }
    const v = parseFloat(volSlider.value);
    Player.setVolume(v); Storage.saveVolume(v); updateVolIcon(v);
  });

  updateVolIcon(volSlider.value);

  // Seek
  $('#seek-slider')?.addEventListener('input', (e) => Player.seekTo(parseFloat(e.target.value)));

  // Player like
  playerLikeBtn.addEventListener('click', () => {
    const s = Player.getCurrentSong(); if (!s) return;
    const l = Storage.toggleLike(s);
    syncPlayerLike();
    $$(`.song-card[data-song-id="${s.id}"]`).forEach(c => syncCardLike(c, l));
    showToast(l ? `Liked "${decode(s.title)}"` : 'Removed', l ? 'ph-fill ph-heart' : 'ph ph-heart-break');
  });

  // Player download
  playerDlBtn.addEventListener('click', () => {
    const s = Player.getCurrentSong();
    if (!s) { showToast('No song selected', 'ph ph-warning-circle'); return; }
    downloadSong(s, playerDlBtn);
  });

  // Player Share
  const execShare = () => {
    const s = Player.getCurrentSong();
    if (!s) { showToast('No song selected', 'ph ph-warning-circle'); return; }
    const url = `${window.location.origin}${window.location.pathname}?songId=${s.id}`;
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'ph ph-link'));
  };
  $('#player-share-btn')?.addEventListener('click', execShare);
  $('#np-share-btn')?.addEventListener('click', execShare);

  // Expand / Queue / Lyrics / Playlists
  $('#btn-expand')?.addEventListener('click', toggleNowPlaying);
  $('#np-lyrics-btn')?.addEventListener('click', toggleLyricsPanel);
  $('#np-lyrics-close')?.addEventListener('click', toggleLyricsPanel);
  $('#btn-queue')?.addEventListener('click', toggleQueue);
  $('#queue-close')?.addEventListener('click', () => $('#queue-panel')?.classList.add('hidden'));

  $('#playlist-close')?.addEventListener('click', closePlaylistModal);
  $('#playlist-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'playlist-modal') closePlaylistModal();
  });
  
  // Create New Playlist handler
  $('#playlist-new-btn')?.addEventListener('click', () => {
    const ipt = $('#playlist-new-input');
    if (ipt && ipt.value.trim()) {
      Storage.createPlaylist(ipt.value);
      ipt.value = '';
      renderPlaylistsInModal();
    }
  });

  // Album art click → fullscreen player
  artWrap?.addEventListener('click', () => {
    if (Player.getCurrentSong()) toggleNowPlaying();
  });

  // Navigation
  btnHome.addEventListener('click', showHome);
  btnLiked.addEventListener('click', showLiked);
  btnPlaylists.addEventListener('click', showPlaylists);
  btnHistory.addEventListener('click', showHistory);

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', (e) => {
    const isTyping = document.activeElement && 
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

    if (e.key === '/' && !isTyping) { e.preventDefault(); searchInput.focus(); return; }
    if (e.key === 'Escape') {
      if (npOpen) { closeNowPlaying(); return; }
      const queue = $('#queue-panel');
      if (queue && !queue.classList.contains('hidden')) { queue.classList.add('hidden'); return; }
      const playlistModal = $('#playlist-modal');
      if (playlistModal && !playlistModal.classList.contains('hidden')) { closePlaylistModal(); return; }
      if (isTyping && document.activeElement === searchInput) { searchInput.value = ''; searchInput.blur(); showHome(); return; }
      if (isTyping) { document.activeElement.blur(); return; }
    }

    if (isTyping) return; // Completely ignore all hotkeys if the user is typing in an input field

    switch (e.code) {
      case 'Space':      e.preventDefault(); Player.toggle(); break;
      case 'ArrowRight': e.preventDefault(); Player.next(); break;
      case 'ArrowLeft':  e.preventDefault(); Player.prev(); break;
      case 'ArrowUp':    e.preventDefault(); adjustVol(0.05); break;
      case 'ArrowDown':  e.preventDefault(); adjustVol(-0.05); break;
    }

    switch (e.key.toLowerCase()) {
      case 'm': { const v = parseFloat(volSlider.value); if (v > 0) { volSlider.dataset.prev = v; volSlider.value = 0; } else { volSlider.value = volSlider.dataset.prev || 0.7; } const nv = parseFloat(volSlider.value); Player.setVolume(nv); Storage.saveVolume(nv); updateVolIcon(nv); break; }
      case 's': Player.toggleShuffle(); syncShuffleUI(); showToast(Player.isShuffleOn() ? 'Shuffle on' : 'Shuffle off', 'ph ph-shuffle'); break;
      case 'r': Player.toggleRepeat(); syncRepeatUI(); break;
      case 'f': if (Player.getCurrentSong()) toggleNowPlaying(); break;
      case 'q': toggleQueue(); break;
      case 'l': { const s = Player.getCurrentSong(); if (s) { const l = Storage.toggleLike(s); syncPlayerLike(); $$(`.song-card[data-song-id="${s.id}"]`).forEach(c => syncCardLike(c, l)); showToast(l ? 'Liked ♥' : 'Removed', l ? 'ph-fill ph-heart' : 'ph ph-heart-break'); } break; }
    }
  });

  btnHome.classList.add('active');

  // ── Player Event Bus ──
  document.addEventListener('player:trackchange', (e) => {
    updatePlayerUI(e.detail.song);
    highlightPlaying();
    renderQueue();
  });

  document.addEventListener('player:play', () => setPlayingState(true));
  document.addEventListener('player:pause', () => setPlayingState(false));

  document.addEventListener('player:timeupdate', (e) => {
    updateProgress(e.detail.percent);
    updateTime(e.detail.current, e.detail.duration);
    const seek = $('#seek-slider');
    if (seek) seek.value = e.detail.percent;
  });

  document.addEventListener('player:buffered', (e) => {
    const bar = $('#buffered-bar');
    if (bar) bar.style.width = `${e.detail.percent}%`;
  });

  document.addEventListener('player:ended', () => setPlayingState(false));
  document.addEventListener('player:error', (e) => showToast(e.detail?.message || 'Playback error', 'ph ph-warning-circle'));
  document.addEventListener('player:shufflechange', () => syncShuffleUI());
  document.addEventListener('player:repeatchange', () => syncRepeatUI());

  // Global ripple on all buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.ctrl-btn, .nav-btn, .np-btn');
    if (btn) addRipple(btn, e);
  });
}

function updateVolIcon(vol) {
  const i = $('#volume-icon'); if (!i) return;
  const v = parseFloat(vol);
  i.className = v === 0 ? 'ph-fill ph-speaker-x' : v < 0.4 ? 'ph-fill ph-speaker-low' : 'ph-fill ph-speaker-high';
}

function adjustVol(delta) {
  const slider = $('#volume-slider');
  if (!slider) return;
  let v = Math.min(1, Math.max(0, parseFloat(slider.value) + delta));
  slider.value = v;
  Player.setVolume(v); Storage.saveVolume(v); updateVolIcon(v);
}
