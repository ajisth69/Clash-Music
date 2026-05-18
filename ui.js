/**
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
 */

import * as Player  from './player.js';
import * as Storage from './storage.js';
import * as Api     from './api.js';
import * as Vis     from './visualizer.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ── DOM Refs ── */
const viewHome      = $('#view-home');
const viewSearch    = $('#view-search');
const viewLiked     = $('#view-liked');
const viewPlaylists = $('#view-playlists');
const viewHistory   = $('#view-history');
const viewDetail    = $('#view-detail');

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


/* HELPERS */

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

/* ── Custom Confirm (replaces native confirm() blocked by Chrome) ── */
function showConfirm(title, message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    const modal   = $('#confirm-modal');
    const titleEl = $('#confirm-title');
    const msgEl   = $('#confirm-message');
    const okBtn   = $('#confirm-ok');
    const cancelBtn = $('#confirm-cancel');
    if (!modal) { resolve(false); return; }

    titleEl.textContent = title;
    msgEl.textContent   = message;
    okBtn.textContent   = confirmLabel;
    modal.classList.remove('hidden');

    function cleanup(result) {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      resolve(result);
    }
    function onOk()       { cleanup(true);  }
    function onCancel()   { cleanup(false); }
    function onBackdrop(e) { if (e.target === modal) cleanup(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
  });
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

/* ── Bulk Download All Songs in Playlist ── */
let isBulkDownloading = false;

async function bulkDownloadPlaylist(songs, playlistName, btn) {
  if (isBulkDownloading) {
    showToast('A bulk download is already in progress', 'ph ph-warning-circle');
    return;
  }
  if (!songs?.length) {
    showToast('Playlist is empty', 'ph ph-warning-circle');
    return;
  }

  isBulkDownloading = true;
  const icon = btn.querySelector('i');
  const label = btn.querySelector('span');
  btn.classList.add('downloading');
  if (icon) icon.className = 'ph ph-spinner';

  const total = songs.length;
  let success = 0;
  let failed = 0;

  showToast(`Starting bulk download of ${total} songs…`, 'ph ph-download-simple');

  for (let i = 0; i < total; i++) {
    const song = songs[i];
    if (label) label.textContent = `${i + 1}/${total}`;

    if (!song?.streamUrl) { failed++; continue; }

    const name = decode(song.title).replace(/[<>:"/\\|?*]+/g, '').trim();
    const art  = decode(song.artist).replace(/[<>:"/\\|?*]+/g, '').trim();
    const file = `${name} - ${art}.m4a`;

    try {
      const res = await fetch(song.streamUrl, { mode: 'cors' });
      if (!res.ok) throw 0;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      success++;
    } catch {
      const a = document.createElement('a');
      a.href = song.streamUrl; a.download = file; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      success++;
    }

    // Small delay between downloads so the browser doesn't choke
    if (i < total - 1) await new Promise(r => setTimeout(r, 1200));
  }

  btn.classList.remove('downloading');
  if (icon) icon.className = 'ph ph-download-simple';
  if (label) label.textContent = 'Download All';
  isBulkDownloading = false;

  if (failed > 0) {
    showToast(`Downloaded ${success}/${total} songs (${failed} failed)`, 'ph ph-warning-circle');
  } else {
    showToast(`All ${total} songs downloaded ✓`, 'ph ph-check-circle');
  }
}

/* ── Ambient Glow ── */
function updateGlow(img) {
  if (!ambientGlow) return;
  if (!img) { ambientGlow.classList.remove('active'); return; }
  ambientGlow.style.background = `url("${img}") center/cover no-repeat`;
  ambientGlow.classList.add('active');
}

/* ── Dynamic Colors ── */
function extractAndSetColors(url) {
  if (!url || typeof ColorThief === 'undefined') return;
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = url;
  img.onload = () => {
    try {
      const ct = new ColorThief();
      const palette = ct.getPalette(img, 3);
      if (palette && palette.length >= 3) {
        document.documentElement.style.setProperty('--accent', `rgb(${palette[0].join(',')})`);
        document.documentElement.style.setProperty('--pink', `rgb(${palette[1].join(',')})`);
        document.documentElement.style.setProperty('--sky', `rgb(${palette[2].join(',')})`);
      }
    } catch (e) {
      console.warn("ColorThief failed or canvas tainted", e);
    }
  };
}

/* Custom cursor removed — native cursor is smoother */

/* RIPPLE EFFECT */
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

/* 3D CARD TILT */
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

/* SCROLL REVEAL */
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

/* SCROLL TO TOP */
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

/* SONG CARD */
function renderArtistsHtml(artists) {
  if (!artists || !artists.length) return '<span>Unknown Artist</span>';
  return artists.map(a => 
    a.id ? `<span class="artist-link" data-id="${a.id}">${decode(a.name)}</span>` : `<span>${decode(a.name)}</span>`
  ).join(', ');
}

function attachArtistLinks(container) {
  container.querySelectorAll('.artist-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      openArtist(link.dataset.id);
      if (document.body.classList.contains('np-active')) {
        document.body.classList.remove('np-active');
      }
      if ($('#queue-panel') && !$('#queue-panel').classList.contains('hidden')) {
        $('#queue-panel').classList.add('hidden');
      }
    });
  });
}

function createAlbumCard(album) {
  const card = document.createElement('div');
  card.className = 'album-card';
  const imgStr = (Array.isArray(album.image) && album.image.length > 0) ? 
           (album.image.find(i => i.quality === '150x150')?.url || album.image[album.image.length - 1].url) : 
           (typeof album.image === 'string' ? album.image : '');

  card.innerHTML = `
    <div class="album-card__img-wrap">
      <img src="${imgStr}" loading="lazy" alt="Cover" />
    </div>
    <div class="album-card__title" title="${decode(album.title || album.name)}">${decode(album.title || album.name)}</div>
    <div class="album-card__artist">${decode(album.description || album.language || 'Album')}</div>
  `;
  card.addEventListener('click', () => openAlbum(album.id));
  return card;
}

function createArtistCard(artist) {
  const card = document.createElement('div');
  card.className = 'artist-card';
  const imgStr = (Array.isArray(artist.image) && artist.image.length > 0) ? 
           (artist.image.find(i => i.quality === '150x150')?.url || artist.image[artist.image.length - 1].url) : 
           (typeof artist.image === 'string' ? artist.image : '');

  card.innerHTML = `
    <div class="artist-card__img-wrap">
      <img src="${imgStr}" loading="lazy" alt="Artist" />
    </div>
    <div class="artist-card__name" title="${decode(artist.title || artist.name)}">${decode(artist.title || artist.name)}</div>
  `;
  card.addEventListener('click', () => openArtist(artist.id));
  return card;
}

function createSongCard(song, list, idx, playlistId = null) {
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
      <button class="song-card__playlist-btn" aria-label="${playlistId ? 'Remove from Playlist' : 'Add to Playlist'}"><i class="${playlistId ? 'ph-bold ph-minus' : 'ph-bold ph-plus'}"></i></button>
      <button class="song-card__share-btn" aria-label="Share Song"><i class="ph ph-share-network"></i></button>
      <button class="song-card__dl-btn" aria-label="Download"><i class="ph ph-download-simple"></i></button>
    </div>
    <div class="song-card__info">
      <div class="song-card__title${song.albumId ? ' clickable' : ''}" title="${decode(song.title)}">${decode(song.title)}</div>
      <div class="song-card__artist" title="${decode(song.artist)}">${renderArtistsHtml(song.artists)}</div>
    </div>
  `;

  // Play
  const play = () => Player.playSong(song, list, idx);
  card.querySelector('.song-card__play-btn').addEventListener('click', (e) => { addRipple(e.currentTarget, e); play(); });
  card.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    play();
  });
  
  // Navigate to Album / Artist
  const titleEl = card.querySelector('.song-card__title');
  if (song.albumId) {
    titleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openAlbum(song.albumId);
    });
  }
  
  attachArtistLinks(card);

  // Like
  card.querySelector('.song-card__like-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const l = Storage.toggleLike(song);
    syncCardLike(card, l);
    syncPlayerLike();
    showToast(l ? `Liked "${decode(song.title)}"` : 'Removed', l ? 'ph-fill ph-heart' : 'ph ph-heart-break');
  });

  // Playlist Add / Remove
  card.querySelector('.song-card__playlist-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (playlistId) {
      if (Storage.removeFromPlaylist(playlistId, song.id)) {
        showToast('Removed from playlist', 'ph ph-trash');
        showPlaylists();
      }
    } else {
      openPlaylistModal(song);
    }
  });

  // Share
  card.querySelector('.song-card__share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const url = `https://clashmusic.ajisth007.workers.dev/?songId=${song.id}`;
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

/* RENDER */
export function renderSongRow(container, songs) {
  container.innerHTML = '';
  if (!songs?.length) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:8px;font-size:0.8rem;">No songs found</p>';
    return;
  }
  songs.forEach((s, i) => container.appendChild(createSongCard(s, songs, i)));
  highlightPlaying();
}

/* Append more songs to an existing horizontal row (infinite scroll) */
export function appendSongRow(container, songs) {
  if (!songs?.length || !container) return;
  const existing = container.querySelectorAll('.song-card');
  const offset   = existing.length;
  // Build a combined list for context (existing ids + new)
  const allSongs = [...songs]; // new songs form their own mini-list for now
  songs.forEach((s, i) => container.appendChild(createSongCard(s, allSongs, i)));
  highlightPlaying();
}

/* VIEW MANAGEMENT */
function hideAll() {
  [viewHome, viewSearch, viewLiked, viewPlaylists, viewHistory, viewDetail].forEach(v => v?.classList.add('hidden'));
  btnHome?.classList.remove('active');
  // Close settings if navigating
  $('#settings-panel')?.classList.add('hidden');
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
  
  const wrapper = $('#search-content-wrapper');
  
  if (!isAppend) {
    wrapper.innerHTML = '';
    currentSearchQuery = query;
    currentSearchPage = 1;
    isFetchingMore = false;
  }
  
  // Actually results comes in as { songs, albums, artists } from searchAll
  const isEmpty = (!results || (!results.songs?.length && !results.albums?.length && !results.artists?.length));
  
  if (isEmpty) {
    if (!isAppend) {
      $('#search-empty').classList.remove('hidden');
    }
    $('#search-loading-spinner')?.classList.add('hidden');
    return;
  }
  
  $('#search-empty').classList.add('hidden');

  if (results.songs?.length) {
    let s = isAppend ? wrapper.querySelector('#search-songs-scroll') : null;
    if (!s) {
      const sec = document.createElement('div');
      sec.className = 'search-section';
      sec.innerHTML = `<h3 class="search-section-title">Songs</h3><div class="search-h-scroll" id="search-songs-scroll"></div>`;
      wrapper.appendChild(sec);
      s = sec.querySelector('#search-songs-scroll');
    }
    results.songs.forEach((song, i) => s.appendChild(createSongCard(song, results.songs, i)));
  }

  if (results.albums?.length && !isAppend) {
    const sec = document.createElement('div');
    sec.className = 'search-section';
    sec.innerHTML = `<h3 class="search-section-title">Albums</h3><div class="search-h-scroll" id="search-albums-scroll"></div>`;
    wrapper.appendChild(sec);
    const s = sec.querySelector('#search-albums-scroll');
    results.albums.forEach(album => s.appendChild(createAlbumCard(album)));
  }

  if (results.artists?.length && !isAppend) {
    const sec = document.createElement('div');
    sec.className = 'search-section';
    sec.innerHTML = `<h3 class="search-section-title">Artists</h3><div class="search-h-scroll" id="search-artists-scroll"></div>`;
    wrapper.appendChild(sec);
    const s = sec.querySelector('#search-artists-scroll');
    results.artists.forEach(artist => s.appendChild(createArtistCard(artist)));
  }
  
  // Show spinner and mount observer for infinite scrolling Songs
  const spinner = $('#search-loading-spinner');
  if (spinner && results.songs?.length) {
    spinner.classList.remove('hidden');
    if (!searchObserver) {
      searchObserver = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore && currentSearchQuery) {
          isFetchingMore = true;
          currentSearchPage++;
          // When paginating, we only care about songs, so searchSongs directly.
          const nextSongs = await Api.searchSongs(currentSearchQuery, 20, currentSearchPage);
          if (nextSongs?.length) {
            // fake the searchAll object structure for appending
            showSearchResults({ songs: nextSongs, albums: [], artists: [] }, currentSearchQuery, true);
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
      <span style="font-size:0.75rem; color:var(--text-muted);">${p.songs.length} songs</span>
      <button class="playlist-share-btn" data-id="${p.id}" title="Share Playlist" style="background:rgba(255,255,255,0.05); border:none; border-radius:6px; padding:6px 8px; color:#fff; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition: background 0.2s;" aria-label="Share Playlist"><i class="ph ph-share-network"></i></button>
      <button class="playlist-dl-all-btn" data-id="${p.id}" title="Download All Songs" style="background: linear-gradient(135deg, rgba(var(--accent-rgb, 139,92,246), 0.15), rgba(var(--accent-rgb, 139,92,246), 0.05)); border:1px solid rgba(var(--accent-rgb, 139,92,246), 0.25); border-radius:6px; padding:6px 12px; color:#fff; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:500; transition: all 0.2s;" aria-label="Download All Songs">
        <i class="ph ph-download-simple"></i>
        <span>Download All</span>
      </button>
      <button class="playlist-delete-btn" data-id="${p.id}" title="Delete Playlist" style="background:rgba(255,80,80,0.08); border:1px solid rgba(255,80,80,0.15); border-radius:6px; padding:6px 8px; color:#ff5050; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition: all 0.2s; margin-left:auto;" aria-label="Delete Playlist"><i class="ph ph-trash"></i></button>
    `;
    pContainer.appendChild(hdr);
    
    // Bind share event
    const shareBtn = hdr.querySelector('.playlist-share-btn');
    shareBtn.addEventListener('click', () => {
      const ids = p.songs.map(s => s.id);
      const b64 = btoa(JSON.stringify(ids));
      const url = `https://clashmusic.ajisth007.workers.dev/?pName=${encodeURIComponent(p.name)}&pData=${encodeURIComponent(b64)}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Playlist link copied!', 'ph ph-link');
      });
    });
    
    // Bind download all event
    const dlAllBtn = hdr.querySelector('.playlist-dl-all-btn');
    dlAllBtn.addEventListener('click', () => {
      bulkDownloadPlaylist(p.songs, p.name, dlAllBtn);
    });

    // Bind delete event
    const delBtn = hdr.querySelector('.playlist-delete-btn');
    delBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(
        `Delete "${decode(p.name)}"?`,
        "This can't be undone. All songs in this playlist will be lost.",
        'Delete'
      );
      if (confirmed) {
        Storage.deletePlaylist(p.id);
        showToast(`Deleted "${decode(p.name)}"`, 'ph ph-trash');
        showPlaylists();
      }
    });
    
    // Hover effects for buttons
    [shareBtn, dlAllBtn, delBtn].forEach(b => {
      b.addEventListener('mouseenter', () => { b.style.filter = 'brightness(1.3)'; });
      b.addEventListener('mouseleave', () => { b.style.filter = ''; });
    });
    
    // Render Playlist Songs Grid
    const grid = document.createElement('div');
    grid.className = 'search-results-grid'; // Reusing grid class
    grid.style.padding = '0 0 16px 0';
    
    if (!p.songs.length) {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size: 0.85rem;">Empty playlist</p>';
    } else {
      p.songs.forEach((s, i) => grid.appendChild(createSongCard(s, p.songs, i, p.id)));
    }
    pContainer.appendChild(grid);
  });
}

/* PLAYER UI SYNC */
export function updatePlayerUI(song) {
  if (!song) return;
  playerSong.textContent = decode(song.title);
  playerArtist.innerHTML = renderArtistsHtml(song.artists);
  attachArtistLinks(playerArtist);
  playerArt.src = song.image || '';
  playerArt.onerror = () => { playerArt.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23181822'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%23444' font-size='22'%3E♫%3C/text%3E%3C/svg%3E"; };
  syncPlayerLike();
  updateGlow(song.image);
  extractAndSetColors(song.image);
  document.title = `${decode(song.title)} — Clash Musics`;

  // Now Playing overlay
  const npArt   = $('#np-art');
  const npBg    = $('#np-bg');
  const npTitle  = $('#np-title');
  const npArtist = $('#np-artist');
  if (npArt)   npArt.src = song.image || '';
  if (npBg)    npBg.style.backgroundImage = `url("${song.image}")`;
  if (npTitle) npTitle.textContent = decode(song.title);
  if (npArtist) {
    npArtist.innerHTML = renderArtistsHtml(song.artists);
    attachArtistLinks(npArtist);
  }
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

/* QUEUE PANEL */
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

  let dragIdx = null;

  pl.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = `queue-item${i === ci ? ' active' : ''}`;
    item.draggable = true;
    item.dataset.idx = i;
    item.innerHTML = `
      <span class="queue-item__drag" title="Drag to reorder"><i class="ph ph-dots-six-vertical"></i></span>
      <span class="queue-item__num">${i + 1}</span>
      <img class="queue-item__art" src="${song.image}" alt="" loading="lazy" onerror="this.style.display='none'" />
      <div class="queue-item__text">
        <div class="queue-item__title">${decode(song.title)}</div>
        <div class="queue-item__artist">${renderArtistsHtml(song.artists)}</div>
      </div>
      <button class="queue-item__add-btn" aria-label="Add to Playlist" title="Add to Playlist" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;"><i class="ph ph-list-plus" style="font-size: 1.2rem;"></i></button>
    `;

    // Drag events
    item.addEventListener('dragstart', (e) => {
      dragIdx = i;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      dragIdx = null;
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const toIdx = parseInt(item.dataset.idx);
      if (dragIdx !== null && dragIdx !== toIdx) {
        Player.reorderQueue(dragIdx, toIdx);
        renderQueue();
        showToast('Queue reordered', 'ph ph-arrows-down-up');
      }
    });

    // Touch drag for mobile
    let touchStartY = 0;
    let touchClone = null;
    const dragHandle = item.querySelector('.queue-item__drag');
    dragHandle?.addEventListener('touchstart', (e) => {
      dragIdx = i;
      touchStartY = e.touches[0].clientY;
      item.classList.add('dragging');
    }, { passive: true });
    dragHandle?.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.queue-item');
      list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (target && target !== item) target.classList.add('drag-over');
    }, { passive: true });
    dragHandle?.addEventListener('touchend', () => {
      item.classList.remove('dragging');
      const overEl = list.querySelector('.drag-over');
      if (overEl) {
        const toIdx = parseInt(overEl.dataset.idx);
        overEl.classList.remove('drag-over');
        if (dragIdx !== null && dragIdx !== toIdx) {
          Player.reorderQueue(dragIdx, toIdx);
          renderQueue();
          showToast('Queue reordered', 'ph ph-arrows-down-up');
        }
      }
      dragIdx = null;
    });

    item.addEventListener('click', (e) => {
      if (e.target.closest('.artist-link') || e.target.closest('.queue-item__drag') || e.target.closest('.queue-item__add-btn')) return;
      Player.playSong(song, pl, i);
    });
    item.querySelector('.queue-item__add-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openPlaylistModal(song);
    });
    attachArtistLinks(item);
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

/* NOW PLAYING OVERLAY */
let npOpen = false;

function openNowPlaying() {
  const overlay = $('#np-overlay');
  if (!overlay || npOpen) return;
  npOpen = true;
  overlay.classList.remove('hidden');
  overlay.style.animation = 'npSlideIn 0.45s var(--ease) forwards';
  document.body.style.overflow = 'hidden';
  startNPVisualizer();
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
    stopNPVisualizer();
  });
}

function toggleNowPlaying() {
  npOpen ? closeNowPlaying() : openNowPlaying();
}

/* PLAYLIST MODAL & LYRICS */
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
    
    Api.getLyrics(song.id, decode(song.title), decode(song.artist), decode(song.album), song.duration).then(lyrics => {
      if (!lyrics) ctn.textContent = "Lyrics not available for this track.";
      else {
        // Remove [00:15.22] style LRC timestamps for clear reading
        const plainLyrics = lyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
        ctn.textContent = plainLyrics.replace(/<br\s*\/?>/gi, '\n');
      }
    }).catch(() => { ctn.textContent = "Error fetching lyrics."; });
  } else {
    pnl.classList.add('hidden');
  }
}

/* SHUFFLE / REPEAT UI */
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

function syncSpatialBtn() {
  const on  = Storage.getSpatialAudioEnabled();
  const btn = $('#np-spatial-btn');
  if (!btn) return;
  btn.classList.toggle('active', on);
  btn.classList.toggle('spatial-active', on);
  const i = btn.querySelector('i');
  if (i) i.className = on ? 'ph-fill ph-broadcast' : 'ph ph-broadcast';
  // Also show Hi-Fi badge on player bar if hifi active
  document.body.classList.toggle('spatial-on', on);
}

/* GLOBAL BOOT (URL PARSING) */
export async function processShareLink() {
  const params = new URLSearchParams(window.location.search);
  const songId = params.get('songId');
  const pName = params.get('pName');
  const pData = params.get('pData');

  if (songId) {
    const s = await Api.getSongById(songId);
    if (s) {
      Player.playSong(s, [s], 0);
      // Modern browsers block autoplay on new tabs. Show a friendly toast if it was blocked!
      setTimeout(() => {
        const playIcon = document.getElementById('play-icon');
        if (playIcon && playIcon.classList.contains('ph-play')) {
          showToast('Tap play to start the shared song! 🎵', 'ph-fill ph-play-circle');
        }
      }, 500);
    }
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

/* DETAIL VIEWS (ARTIST & ALBUM) */
let activeDetailSongs = [];

// Back button handler
$('#detail-back-btn')?.addEventListener('click', () => {
  // If we had a search ongoing, maybe go back to search? Or just home.
  // Simplest is to go Home unless we want to track navigation history.
  showHome();
});

$('#detail-play-all')?.addEventListener('click', () => {
  if (activeDetailSongs.length) {
    Player.playSong(activeDetailSongs[0], activeDetailSongs, 0);
  }
});

function showDetailView(data, type) {
  hideAll();
  if (!viewDetail) return;
  viewDetail.classList.remove('hidden');
  
  $('#detail-type').textContent = type;
  $('#detail-title').textContent = decode(data.name);
  $('#detail-subtitle').textContent = type === 'Artist' ? 'Top Songs' : `${data.songs.length} Tracks`;
  $('#detail-art').src = data.image || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23181822'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%23444' font-size='22'%3E♫%3C/text%3E%3C/svg%3E";
  
  $('#detail-loading')?.classList.add('hidden');
  
  activeDetailSongs = data.songs || [];
  
  const grid = $('#detail-grid');
  grid.innerHTML = '';
  if (!activeDetailSongs.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:20px;">No tracks found.</p>';
  } else {
    activeDetailSongs.forEach((s, i) => grid.appendChild(createSongCard(s, activeDetailSongs, i)));
    highlightPlaying();
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export async function openAlbum(id) {
  showToast('Loading album...', 'ph ph-spinner spin-anim');
  const data = await Api.getAlbumById(id);
  if (data) showDetailView(data, 'Album');
  else showToast('Failed to load album.', 'ph ph-warning-circle');
}

export async function openArtist(id) {
  showToast('Loading artist...', 'ph ph-spinner spin-anim');
  const data = await Api.getArtistById(id);
  if (data) showDetailView(data, 'Artist');
  else showToast('Failed to load artist.', 'ph ph-warning-circle');
}

/* INIT */
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
  $('#btn-rewind')?.addEventListener('click', (e) => { addRipple(e.currentTarget, e); Player.skip(-10); });
  $('#btn-forward')?.addEventListener('click', (e) => { addRipple(e.currentTarget, e); Player.skip(10); });

  // Shuffle / Repeat
  $('#btn-shuffle')?.addEventListener('click', () => { Player.toggleShuffle(); syncShuffleUI(); showToast(Player.isShuffleOn() ? 'Shuffle on' : 'Shuffle off', 'ph ph-shuffle'); });
  $('#btn-repeat')?.addEventListener('click', () => { Player.toggleRepeat(); syncRepeatUI(); const m = Player.getRepeatMode(); showToast(['Repeat off', 'Repeat all', 'Repeat one'][m], 'ph ph-repeat'); });

  // NP overlay controls
  $('#np-play')?.addEventListener('click', () => Player.toggle());
  $('#np-prev')?.addEventListener('click', () => Player.prev());
  $('#np-next')?.addEventListener('click', () => Player.next());
  $('#np-rewind')?.addEventListener('click', () => Player.skip(-10));
  $('#np-forward')?.addEventListener('click', () => Player.skip(10));
  // Click outside NP content to close
  $('#np-overlay')?.addEventListener('click', (e) => {
    if (!e.target.closest('.np-content') && !e.target.closest('.np-close')) closeNowPlaying();
  });
  $('#np-shuffle')?.addEventListener('click', () => { Player.toggleShuffle(); syncShuffleUI(); });
  $('#np-repeat')?.addEventListener('click', () => { Player.toggleRepeat(); syncRepeatUI(); });
  $('#np-seek')?.addEventListener('input', (e) => Player.seekTo(parseFloat(e.target.value)));
  $('#np-minimize')?.addEventListener('click', closeNowPlaying);

  // Spatial Audio NP button
  $('#np-spatial-btn')?.addEventListener('click', () => {
    const on = !Storage.getSpatialAudioEnabled();
    Storage.saveSpatialAudioEnabled(on);
    Vis.setSpatialAudio(on);
    showToast(on ? '🎧 Spatial Audio ON' : 'Spatial Audio off', 'ph ph-broadcast');
    syncSpatialBtn();
    const st = $('#spatial-toggle');
    if (st) st.checked = on;
  });

  // Volume
  const volSlider = $('#volume-slider');
  volSlider.value = Storage.getVolume();

  volSlider.addEventListener('input', () => {
    const v = parseFloat(volSlider.value);
    Player.setVolume(v);
    Storage.saveVolume(v);
    updateVolIcon(v);
    const menuVolSlider = $('#menu-vol-slider');
    if (menuVolSlider) menuVolSlider.value = v;
  });

  const menuVolSlider = $('#menu-vol-slider');
  if (menuVolSlider) {
    menuVolSlider.value = Storage.getVolume();
    menuVolSlider.addEventListener('input', () => {
      const v = parseFloat(menuVolSlider.value);
      Player.setVolume(v);
      Storage.saveVolume(v);
      updateVolIcon(v);
      if (volSlider) volSlider.value = v;
    });
  }

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

  // Player Add to Playlist
  $('#player-playlist-btn')?.addEventListener('click', () => {
    const s = Player.getCurrentSong();
    if (!s) { showToast('No song selected', 'ph ph-warning-circle'); return; }
    openPlaylistModal(s);
  });

  // Player Share
  const execShare = () => {
    const s = Player.getCurrentSong();
    if (!s) { showToast('No song selected', 'ph ph-warning-circle'); return; }
    const url = `https://clashmusic.ajisth007.workers.dev/?songId=${s.id}`;
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

  // Import Playlist Modal
  initImportPlaylist();

  // Album art click → fullscreen player
  artWrap?.addEventListener('click', () => {
    if (Player.getCurrentSong()) toggleNowPlaying();
  });

  // Navigation — Home + Brand logo
  btnHome.addEventListener('click', showHome);
  $('.topbar__brand')?.addEventListener('click', showHome);

  // Init new feature modules
  initLibraryDropdown();
  initSettings();
  initRecentSearches();
  initSleepTimer();

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', (e) => {
    const isTyping = document.activeElement && 
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

    if (e.key === '/' && !isTyping) { e.preventDefault(); searchInput.focus(); return; }
    if (e.key === 'Escape') {
      if (npOpen) { closeNowPlaying(); return; }
      const settings = $('#settings-panel');
      if (settings && !settings.classList.contains('hidden')) { settings.classList.add('hidden'); return; }
      const queue = $('#queue-panel');
      if (queue && !queue.classList.contains('hidden')) { queue.classList.add('hidden'); return; }
      const playlistModal = $('#playlist-modal');
      if (playlistModal && !playlistModal.classList.contains('hidden')) { closePlaylistModal(); return; }
      const importModal = $('#import-modal');
      if (importModal && !importModal.classList.contains('hidden') && !isImporting) { importModal.classList.add('hidden'); document.body.style.overflow = ''; return; }
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
  // Sync spatial button initial state
  syncSpatialBtn();
  document.body.classList.toggle('hifi-active', Storage.getHiFiMode());

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

  // Mobile Player More Menu
  const moreBtn = $('#btn-more-options');
  const moreMenu = $('#player-more-menu');
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const curSong = Player.getCurrentSong();
      const liked = curSong ? Storage.isLiked(curSong.id) : false;
      const likeIco = $('#menu-like-icon');
      if (likeIco) {
        likeIco.className = liked ? 'ph-fill ph-heart' : 'ph ph-heart';
        likeIco.style.color = liked ? 'var(--pink)' : '';
      }
      
      const shuffOn = Player.isShuffleOn();
      const shuffIco = $('#menu-shuffle-icon');
      if (shuffIco) shuffIco.style.color = shuffOn ? 'var(--accent-soft)' : '';

      const repMode = Player.getRepeatMode();
      const repIco = $('#menu-repeat-icon');
      if (repIco) {
        repIco.className = repMode === 2 ? 'ph ph-repeat-once' : 'ph ph-repeat';
        repIco.style.color = repMode !== 0 ? 'var(--accent-soft)' : '';
      }

      if (window.innerWidth > 480) {
        $('#menu-shuffle').style.display = 'none';
        $('#menu-repeat').style.display = 'none';
      } else {
        $('#menu-shuffle').style.display = 'flex';
        $('#menu-repeat').style.display = 'flex';
      }

      moreMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!moreMenu.contains(e.target) && e.target !== moreBtn) {
        moreMenu.classList.add('hidden');
      }
    });

    $('#menu-like')?.addEventListener('click', () => { $('#player-like-btn')?.click(); moreMenu.classList.add('hidden'); });
    $('#menu-playlist')?.addEventListener('click', () => { $('#player-playlist-btn')?.click(); moreMenu.classList.add('hidden'); });
    $('#menu-share')?.addEventListener('click', () => { $('#player-share-btn')?.click(); moreMenu.classList.add('hidden'); });
    $('#menu-dl')?.addEventListener('click', () => { $('#player-dl-btn')?.click(); moreMenu.classList.add('hidden'); });
    $('#menu-queue')?.addEventListener('click', () => { $('#btn-queue')?.click(); moreMenu.classList.add('hidden'); });
    $('#menu-expand')?.addEventListener('click', () => { $('#btn-expand')?.click(); moreMenu.classList.add('hidden'); });
    $('#menu-shuffle')?.addEventListener('click', () => { $('#btn-shuffle')?.click(); moreMenu.classList.add('hidden'); });
    $('#menu-repeat')?.addEventListener('click', () => { $('#btn-repeat')?.click(); moreMenu.classList.add('hidden'); });
    
    $('#menu-hifi')?.addEventListener('click', () => {
      const hifi = !Storage.getHiFiMode();
      Storage.saveHiFiMode(hifi);
      document.body.classList.toggle('hifi-active', hifi);
      Vis.setHiFiDSP(hifi);
      Player.reloadHiFiStream();
      if($('#hifi-toggle')) $('#hifi-toggle').checked = hifi;
      showToast(hifi ? 'Hi-Fi 320kbps ON ✓' : 'Hi-Fi off', 'ph ph-wave-sine');
      moreMenu.classList.add('hidden');
    });

    $('#menu-spatial')?.addEventListener('click', () => {
      const on = !Storage.getSpatialAudioEnabled();
      Storage.saveSpatialAudioEnabled(on);
      Vis.setSpatialAudio(on);
      syncSpatialBtn();
      if($('#spatial-toggle')) $('#spatial-toggle').checked = on;
      showToast(on ? '🎧 Spatial Audio ON' : 'Spatial Audio off', 'ph ph-broadcast');
      moreMenu.classList.add('hidden');
    });
  }
}

function updateVolIcon(vol) {
  const v = parseFloat(vol);
  const className = v === 0 ? 'ph-fill ph-speaker-x' : v < 0.4 ? 'ph-fill ph-speaker-low' : 'ph-fill ph-speaker-high';
  const i = $('#volume-icon'); if (i) i.className = className;
  const mi = $('#menu-vol-icon'); if (mi) mi.className = className;
}

function adjustVol(delta) {
  const slider = $('#volume-slider');
  if (!slider) return;
  let v = Math.min(1, Math.max(0, parseFloat(slider.value) + delta));
  slider.value = v;
  Player.setVolume(v); Storage.saveVolume(v); updateVolIcon(v);
}

/* SETTINGS PANEL */
function initSettings() {
  const panel = $('#settings-panel');
  if (!panel) return;

  $('#btn-settings')?.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) syncSettingsUI();
  });
  $('#settings-close')?.addEventListener('click', () => panel.classList.add('hidden'));

  // Theme
  $$('#theme-grid .theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      Storage.saveTheme(theme);
      $$('#theme-grid .theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
      showToast(`Theme: ${btn.textContent.trim()}`, 'ph ph-palette');
    });
  });

  // Visualizer toggle
  $('#vis-toggle')?.addEventListener('change', (e) => {
    Storage.saveVisualizerEnabled(e.target.checked);
  });

  // Init all custom selects (glassmorphism dropdowns)
  initCustomSelects();

  // Vis mode custom select callback
  onCustomSelect('vis-mode-select', (val) => {
    Vis.setVisualizerMode(val);
  });

  // EQ preset custom select callback
  onCustomSelect('eq-preset-select', (val) => {
    if (val !== 'Custom') {
      Vis.setEQPreset(val);
      syncEQSliders();
      showToast(`EQ: ${val}`, 'ph ph-sliders-horizontal');
    }
  });

  // EQ Band sliders
  $$('.eq-range').forEach(slider => {
    slider.addEventListener('input', () => {
      const band = parseInt(slider.dataset.band);
      const val = parseFloat(slider.value);
      Vis.setBandGain(band, val);
      slider.closest('.eq-band').querySelector('.eq-val').textContent = val > 0 ? `+${val}` : val;
      setCustomSelectValue('eq-preset-select', 'Custom');
    });
  });

  // Crossfade
  $('#crossfade-toggle')?.addEventListener('change', (e) => {
    Storage.saveCrossfadeEnabled(e.target.checked);
    showToast(e.target.checked ? 'Crossfade on' : 'Crossfade off', 'ph ph-intersect');
  });
  $('#crossfade-dur')?.addEventListener('input', (e) => {
    const v = e.target.value;
    Storage.saveCrossfadeDuration(parseInt(v));
    $('#crossfade-dur-val').textContent = v + 's';
  });

  // Gapless
  $('#gapless-toggle')?.addEventListener('change', (e) => {
    Storage.saveGapless(e.target.checked);
    showToast(e.target.checked ? 'Gapless on' : 'Gapless off', 'ph ph-link-simple');
  });

  // Spatial Audio
  $('#spatial-toggle')?.addEventListener('change', (e) => {
    Storage.saveSpatialAudioEnabled(e.target.checked);
    Vis.setSpatialAudio(e.target.checked);
    showToast(e.target.checked ? 'Spatial Audio ON 🎧' : 'Spatial Audio off', 'ph ph-broadcast');
    syncSpatialBtn();
  });

  // Spatial Audio Modes (Settings & Mobile Menu)
  onCustomSelect('spatial-mode-select', (val) => {
    Vis.setSpatialMode(val);
    syncSpatialModeChips(val);
    showToast(`Spatial Mode: ${val}`, 'ph ph-broadcast');
  });

  $$('.spatial-mode-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const mode = chip.dataset.mode;
      Vis.setSpatialMode(mode);
      setCustomSelectValue('spatial-mode-select', mode);
      syncSpatialModeChips(mode);
      showToast(`Spatial Mode: ${mode}`, 'ph ph-broadcast');
    });
  });

  // Hi-Fi Mode
  $('#hifi-toggle')?.addEventListener('change', (e) => {
    Storage.saveHiFiMode(e.target.checked);
    Vis.setHiFiDSP(e.target.checked);
    Player.reloadHiFiStream();
    showToast(e.target.checked ? 'Hi-Fi 320kbps ON ✓' : 'Hi-Fi off', 'ph ph-wave-sine');
    document.body.classList.toggle('hifi-active', e.target.checked);
  });

  // Restore saved theme on load
  applyTheme(Storage.getTheme());
}

function syncSpatialModeChips(mode) {
  $$('.spatial-mode-chip').forEach(c => c.classList.toggle('active', c.dataset.mode === mode));
}

function syncSettingsUI() {
  const theme = Storage.getTheme();
  $$('#theme-grid .theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));

  const visToggle = $('#vis-toggle');
  if (visToggle) visToggle.checked = Storage.getVisualizerEnabled();
  setCustomSelectValue('vis-mode-select', Storage.getVisualizerMode());
  setCustomSelectValue('eq-preset-select', Storage.getEQPreset());
  syncEQSliders();

  const cfToggle = $('#crossfade-toggle');
  if (cfToggle) cfToggle.checked = Storage.getCrossfadeEnabled();
  const cfDur = $('#crossfade-dur');
  if (cfDur) { cfDur.value = Storage.getCrossfadeDuration(); $('#crossfade-dur-val').textContent = cfDur.value + 's'; }

  const glToggle = $('#gapless-toggle');
  if (glToggle) glToggle.checked = Storage.getGapless();

  const spatialToggle = $('#spatial-toggle');
  if (spatialToggle) spatialToggle.checked = Storage.getSpatialAudioEnabled();

  const currentSpatialMode = Storage.getSpatialMode();
  setCustomSelectValue('spatial-mode-select', currentSpatialMode);
  syncSpatialModeChips(currentSpatialMode);

  const hifiToggle = $('#hifi-toggle');
  if (hifiToggle) hifiToggle.checked = Storage.getHiFiMode();

  document.body.classList.toggle('hifi-active', Storage.getHiFiMode());
}

function syncEQSliders() {
  if (!Vis.isInitialized()) return;
  const gains = Vis.getBandGains();
  $$('.eq-range').forEach(slider => {
    const band = parseInt(slider.dataset.band);
    slider.value = gains[band] || 0;
    slider.closest('.eq-band').querySelector('.eq-val').textContent = gains[band] > 0 ? `+${gains[band]}` : gains[band];
  });
}

function applyTheme(theme) {
  document.body.className = document.body.className.replace(/theme-\S+/g, '').trim();
  if (theme && theme !== 'dark') {
    document.body.classList.add(`theme-${theme}`);
  }
}

/* LIBRARY DROPDOWN */
function initLibraryDropdown() {
  const btn = $('#btn-library');
  const dropdown = $('#library-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add('hidden');
    }
  });

  $('#btn-liked')?.addEventListener('click', () => { dropdown.classList.add('hidden'); showLiked(); });
  $('#btn-playlists')?.addEventListener('click', () => { dropdown.classList.add('hidden'); showPlaylists(); });
  $('#btn-history')?.addEventListener('click', () => { dropdown.classList.add('hidden'); showHistory(); });
}

/* RECENT SEARCHES */
function initRecentSearches() {
  const input = $('#search-input');
  const container = $('#recent-searches');
  const chipsEl = $('#recent-chips');
  if (!input || !container || !chipsEl) return;

  function renderChips() {
    const searches = Storage.getRecentSearches();
    chipsEl.innerHTML = '';
    if (!searches.length) { container.classList.add('hidden'); return; }
    searches.forEach(q => {
      const chip = document.createElement('button');
      chip.className = 'recent-chip';
      chip.textContent = q;
      chip.addEventListener('click', () => {
        input.value = q;
        input.dispatchEvent(new Event('input'));
        container.classList.add('hidden');
      });
      chipsEl.appendChild(chip);
    });
  }

  input.addEventListener('focus', () => {
    if (!input.value.trim()) {
      renderChips();
      const searches = Storage.getRecentSearches();
      if (searches.length) container.classList.remove('hidden');
    }
  });

  input.addEventListener('input', () => {
    if (input.value.trim()) container.classList.add('hidden');
  });

  input.addEventListener('blur', () => {
    setTimeout(() => container.classList.add('hidden'), 200);
  });

  $('#clear-recent')?.addEventListener('click', () => {
    Storage.clearRecentSearches();
    container.classList.add('hidden');
  });
}

export function saveRecentSearch(query) {
  Storage.addRecentSearch(query);
}

/* SLEEP TIMER */
function initSleepTimer() {
  $$('.sleep-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const min = parseInt(chip.dataset.min);
      if (min === 0) {
        Player.clearSleepTimerFn();
        showToast('Sleep timer cancelled', 'ph ph-alarm');
      } else {
        Player.setSleepTimer(min);
        showToast(`Sleep timer: ${min} minutes`, 'ph ph-moon');
      }
      syncSleepUI();
    });
  });

  document.addEventListener('player:sleeptimer', () => {
    showToast('💤 Sleep timer — Music paused', 'ph ph-moon');
    syncSleepUI();
  });
}

function syncSleepUI() {
  const endTime = Player.getSleepEndTime();
  const statusEl = $('#sleep-status');
  const offBtn = $('#sleep-off');

  $$('.sleep-chip:not(.sleep-chip--off)').forEach(c => c.classList.remove('active'));

  if (endTime) {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 60000));
    if (statusEl) { statusEl.textContent = `⏱ ${remaining}m remaining`; statusEl.classList.remove('hidden'); }
    if (offBtn) offBtn.classList.remove('hidden');
  } else {
    if (statusEl) statusEl.classList.add('hidden');
    if (offBtn) offBtn.classList.add('hidden');
  }
}

/* VISUALIZER (NP overlay) */
function startNPVisualizer() {
  const canvas = $('#np-visualizer');
  if (canvas && Storage.getVisualizerEnabled()) {
    Vis.startVisualizer(canvas);
  }
}

function stopNPVisualizer() {
  Vis.stopVisualizer();
}

/* IMPORT PLAYLIST */
let isImporting = false;

let pendingCSVSongs = []; // Parsed CSV data waiting to be imported

function initImportPlaylist() {
  const modal = $('#import-modal');
  const closeBtn = $('#import-close');
  const triggerBtn = $('#btn-import-playlist');
  const startBtn = $('#import-start-btn');

  if (!modal) return;

  // Open modal
  triggerBtn?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scroll
    // Reset state
    $('#import-json-input').value = '';
    $('#import-text-input').value = '';
    $('#import-name-input').value = '';
    $('#csv-file-name').textContent = '';
    $('#import-csv-file').value = '';
    pendingCSVSongs = [];
    $('#import-progress')?.classList.add('hidden');
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Search & Import';
  });

  // Close modal
  const closeImportModal = () => {
    if (!isImporting) {
      modal.classList.add('hidden');
      document.body.style.overflow = ''; // Unlock background scroll
    }
  };
  closeBtn?.addEventListener('click', closeImportModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeImportModal(); });

  // Tab switching (JSON / Text / CSV)
  $$('.import-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.import-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      $('#import-tab-json')?.classList.toggle('hidden', target !== 'json');
      $('#import-tab-text')?.classList.toggle('hidden', target !== 'text');
      $('#import-tab-csv')?.classList.toggle('hidden', target !== 'csv');
    });
  });

  // CSV drop zone + file input
  const dropZone = $('#import-csv-drop');
  const fileInput = $('#import-csv-file');

  if (dropZone && fileInput) {
    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // File selected
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleCSVFile(fileInput.files[0]);
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleCSVFile(file);
    });
  }

  // Copy Spotify script button
  $('#copy-spotify-script')?.addEventListener('click', () => {
    const script = $('#spotify-script')?.textContent;
    if (script) {
      navigator.clipboard.writeText(script).then(() => {
        showToast('Script copied to clipboard!', 'ph ph-check-circle');
      });
    }
  });

  // Start import
  startBtn?.addEventListener('click', () => runImport());
}

// Handle a dropped/selected CSV file
function handleCSVFile(file) {
  if (!file.name.match(/\.(csv|txt)$/i)) {
    showToast('Please select a CSV file', 'ph ph-warning-circle');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const songs = parseCSV(text);
    pendingCSVSongs = songs;

    const nameEl = $('#csv-file-name');
    if (nameEl) nameEl.textContent = `${file.name} — ${songs.length} songs found`;

    if (!songs.length) {
      showToast('No songs found in CSV. Check the format.', 'ph ph-warning-circle');
    } else {
      showToast(`Found ${songs.length} songs in CSV`, 'ph ph-check-circle');
      // Auto-fill playlist name from filename if empty
      const nameInput = $('#import-name-input');
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = file.name.replace(/\.(csv|txt)$/i, '').replace(/_/g, ' ');
      }
    }
  };
  reader.readAsText(file);
}

// Parse Exportify-style CSV (or any CSV with track/artist columns)
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header to find column indices
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Try multiple common column names
  const trackIdx = header.findIndex(h =>
    h === 'track name' || h === 'name' || h === 'title' || h === 'song' || h === 'track'
  );
  const artistIdx = header.findIndex(h =>
    h === 'artist name(s)' || h === 'artist name' || h === 'artist' || h === 'artists'
  );

  if (trackIdx === -1) {
    // Fallback: assume first column is track, second is artist
    if (header.length >= 2) {
      return lines.slice(1).map(line => {
        const cols = parseCSVLine(line);
        if (!cols[0]?.trim()) return null;
        return { name: cols[0].trim(), artist: (cols[1] || '').trim() };
      }).filter(Boolean);
    }
    return [];
  }

  const songs = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = (cols[trackIdx] || '').trim();
    const artist = artistIdx >= 0 ? (cols[artistIdx] || '').trim() : '';
    if (name) songs.push({ name, artist });
  }
  return songs;
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'; i++; // escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current); current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// Normalize a string for comparison: lowercase, strip special chars
function normalizeStr(str) {
  return (str || '').toLowerCase()
    .replace(/[\(\)\[\]\-_\.,;:'"!?&@#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Compute word overlap similarity (0-1) between two strings
function wordSimilarity(a, b) {
  const wordsA = new Set(normalizeStr(a).split(' ').filter(w => w.length > 1));
  const wordsB = new Set(normalizeStr(b).split(' ').filter(w => w.length > 1));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

// Find the best matching result from search results with similarity validation
function findBestMatch(queryName, queryArtist, results) {
  let bestScore = 0;
  let bestResult = null;

  for (const r of results) {
    const resultTitle = r.title || r.name || '';
    const resultArtist = (r.artist || r.artists || r.primary_artists || '');
    
    // Score based on title match
    let score = wordSimilarity(queryName, resultTitle);
    
    // Bonus if artist also matches
    if (queryArtist && resultArtist) {
      const artistScore = wordSimilarity(queryArtist, resultArtist);
      score = score * 0.7 + artistScore * 0.3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestResult = r;
    }
  }

  // Require at least 30% similarity to accept
  return bestScore >= 0.3 ? bestResult : null;
}

async function runImport() {
  if (isImporting) return;

  const nameInput = $('#import-name-input');
  const playlistName = nameInput?.value.trim() || 'Imported Playlist';
  const activeTab = $('.import-tab.active')?.dataset?.tab || 'json';
  const progressEl = $('#import-progress');
  const fillEl = $('#import-progress-fill');
  const textEl = $('#import-progress-text');
  const startBtn = $('#import-start-btn');

  // Parse songs from input
  let songQueries = [];

  if (activeTab === 'json') {
    const raw = $('#import-json-input')?.value?.trim();
    if (!raw) { showToast('Paste some JSON first', 'ph ph-warning-circle'); return; }

    try {
      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) parsed = [parsed];

      songQueries = parsed.map(item => {
        // Support multiple JSON shapes
        const name = item.name || item.title || item.track || item.song || '';
        const artist = item.artist || item.artists || item.artist_name || '';
        if (!name) return null;
        return { name: name.trim(), artist: (typeof artist === 'string' ? artist : '').trim() };
      }).filter(Boolean);
    } catch {
      showToast('Invalid JSON — check the format', 'ph ph-warning-circle');
      return;
    }
  } else if (activeTab === 'text') {
    const raw = $('#import-text-input')?.value?.trim();
    if (!raw) { showToast('Paste some songs first', 'ph ph-warning-circle'); return; }

    songQueries = raw.split('\n').map(line => {
      line = line.trim();
      if (!line) return null;
      // Try "Song - Artist" format
      const dashIdx = line.indexOf(' - ');
      if (dashIdx > 0) {
        return { name: line.slice(0, dashIdx).trim(), artist: line.slice(dashIdx + 3).trim() };
      }
      // Fallback: use the whole line as search query
      return { name: line, artist: '' };
    }).filter(Boolean);
  } else if (activeTab === 'csv') {
    if (!pendingCSVSongs.length) {
      showToast('Upload a CSV file first', 'ph ph-warning-circle');
      return;
    }
    songQueries = [...pendingCSVSongs];
  }

  if (!songQueries.length) {
    showToast('No songs found in input', 'ph ph-warning-circle');
    return;
  }

  if (songQueries.length > 50) {
    showToast('Max 50 songs per import', 'ph ph-warning-circle');
    songQueries = songQueries.slice(0, 50);
  }

  // Start importing
  isImporting = true;
  startBtn.disabled = true;
  startBtn.innerHTML = '<i class="ph ph-spinner spin-anim"></i> Importing...';
  progressEl?.classList.remove('hidden');
  fillEl.style.width = '0%';
  textEl.textContent = `Searching 0/${songQueries.length}...`;

  const matched = [];
  const skippedNames = [];
  let failed = 0;

  let completedCount = 0;
  const CONCURRENCY_LIMIT = 5;
  let currentIndex = 0;
  let activePromises = [];

  const processSong = async (index) => {
    const q = songQueries[index];
    const searchQuery = q.artist ? `${q.name} ${q.artist}` : q.name;

    try {
      const results = await Api.searchSongs(searchQuery, 5);
      if (results?.length) {
        // Find the best match with similarity validation
        const bestMatch = findBestMatch(q.name, q.artist, results);
        if (bestMatch) {
          matched.push(bestMatch);
        } else {
          failed++;
          skippedNames.push(q.name);
        }
      } else {
        failed++;
        skippedNames.push(q.name);
      }
    } catch {
      failed++;
      skippedNames.push(q.name);
    }

    completedCount++;
    textEl.textContent = `Searching ${completedCount}/${songQueries.length}...`;
    fillEl.style.width = `${(completedCount / songQueries.length) * 100}%`;
  };

  while (currentIndex < songQueries.length) {
    while (activePromises.length < CONCURRENCY_LIMIT && currentIndex < songQueries.length) {
      const p = processSong(currentIndex).finally(() => {
        activePromises = activePromises.filter(item => item !== p);
      });
      activePromises.push(p);
      currentIndex++;
      // Small delay between starting requests to avoid hammering the API at exactly the same time
      await new Promise(r => setTimeout(r, 50));
    }
    if (activePromises.length > 0) {
      await Promise.race(activePromises);
    }
  }

  // Wait for any remaining promises to finish
  await Promise.all(activePromises);

  // Create playlist
  if (matched.length > 0) {
    Storage.importPlaylist(playlistName, matched);
    let msg = `Imported "${playlistName}" — ${matched.length} matched`;
    if (failed) msg += `, ${failed} skipped`;
    showToast(msg, 'ph ph-check-circle');
    if (skippedNames.length) {
      console.log('[Import] Skipped songs (no good match):', skippedNames);
    }
    // Refresh playlists view
    showPlaylists();
  } else {
    showToast('No songs could be matched on JioSaavn', 'ph ph-x-circle');
  }

  // Reset
  isImporting = false;
  startBtn.disabled = false;
  startBtn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Search & Import';
  textEl.textContent = `Done — ${matched.length} matched, ${failed} missed`;

  // Close modal after short delay
  setTimeout(() => {
    $('#import-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }, 1500);
}

/* CUSTOM SELECT HELPERS */
const _customSelectCallbacks = {};

function initCustomSelects() {
  $$('.custom-select').forEach(sel => {
    const trigger = sel.querySelector('.custom-select__trigger');
    const options = sel.querySelectorAll('.custom-select__option');

    // Toggle open/close
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close all other custom selects first
      $$('.custom-select.open').forEach(s => { if (s !== sel) s.classList.remove('open'); });
      sel.classList.toggle('open');
    });

    // Option click
    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.val;
        // Update visual state
        sel.querySelector('.custom-select__trigger span').textContent = opt.textContent;
        sel.dataset.value = val;
        options.forEach(o => o.classList.toggle('active', o === opt));
        sel.classList.remove('open');
        // Trigger callback
        if (_customSelectCallbacks[sel.id]) _customSelectCallbacks[sel.id](val);
      });
    });
  });

  // Close all on outside click
  document.addEventListener('click', () => {
    $$('.custom-select.open').forEach(s => s.classList.remove('open'));
  });
}

function onCustomSelect(id, callback) {
  _customSelectCallbacks[id] = callback;
}

function setCustomSelectValue(id, value) {
  const sel = $(`#${id}`);
  if (!sel) return;
  sel.dataset.value = value;
  const opt = sel.querySelector(`.custom-select__option[data-val="${value}"]`);
  if (opt) {
    sel.querySelector('.custom-select__trigger span').textContent = opt.textContent;
    sel.querySelectorAll('.custom-select__option').forEach(o => o.classList.toggle('active', o === opt));
  } else {
    sel.querySelector('.custom-select__trigger span').textContent = value;
  }
}
