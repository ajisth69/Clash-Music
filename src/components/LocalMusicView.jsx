import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderPlus,
  RefreshCw,
  HardDrive,
  Music,
  Play,
  Shuffle,
  Search,
  Trash2,
  Disc,
  User,
  Folder,
  ArrowUpDown,
  ListPlus,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { playPopSfx } from '../services/soundEffects';
import { Capacitor } from '@capacitor/core';
import {
  getLocalSongs,
  getSavedDirectories,
  requestNativeFolderPicker,
  scanFileObjects,
  removeSavedDirectory,
  clearLocalSongsCache,
  deleteLocalSong,
  calculateLocalMusicStats,
  ensureValidAudioUrl,
  rescanSavedDirectories,
  scanDeviceAudioNative,
  autoScanDeviceMusic,
} from '../services/localMusicService';

export default function LocalMusicView() {
  const { playSong, currentSong, duration, isPlaying, addToQueue, stopAndClearIfCurrent } = useAudio();

  const [localSongs, setLocalSongs] = useState([]);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [directories, setDirectories] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('all'); // 'all' | 'albums' | 'artists' | 'folders'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [isScanning, setIsScanning] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadLocalMusic();
    // Auto-scan device on mount for native platform (like every music player)
    autoScanOnMount();
  }, []);

  const autoScanOnMount = async () => {
    if (Capacitor.isNativePlatform()) {
      setIsScanning(true);
      try {
        const scanned = await autoScanDeviceMusic();
        if (scanned && scanned.length > 0) {
          const songs = await getLocalSongs();
          setLocalSongs(songs);
        }
      } catch (e) {
        console.warn('Auto-scan on mount error:', e);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const loadLocalMusic = async () => {
    const songs = await getLocalSongs();
    const dirs = await getSavedDirectories();
    setLocalSongs(songs);
    setDirectories(dirs);
  };

  const handlePlaySong = (song, playlist) => {
    playPopSfx();
    const validSong = ensureValidAudioUrl(song);
    const validList = (playlist || localSongs).map((s) => ensureValidAudioUrl(s));
    playSong(validSong, validList);
  };

  const handlePlayPlaylist = (tracks, startIndex = 0) => {
    playPopSfx();
    const validTracks = tracks.map((t) => ensureValidAudioUrl(t));
    if (validTracks.length > 0) {
      playSong(validTracks[startIndex] || validTracks[0], validTracks, startIndex);
    }
  };

  const handleAddDirectory = async () => {
    playPopSfx();
    setIsScanning(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // On native Android/iOS, use the MediaStore scanner to scan all device music
        const scanned = await scanDeviceAudioNative();
        if (scanned && scanned.length > 0) {
          await loadLocalMusic();
        }
      } else if ('showDirectoryPicker' in window) {
        // On desktop browser with File System Access API
        const scanned = await requestNativeFolderPicker();
        if (scanned && scanned.length > 0) {
          await loadLocalMusic();
        }
      } else {
        // Fallback: file input with multiple selection
        fileInputRef.current?.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fallback to file input if directory picker fails
        fileInputRef.current?.click();
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileInputChange = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsScanning(true);
    try {
      const scanned = await scanFileObjects(e.target.files, 'Local Folder');
      if (scanned.length > 0) {
        await loadLocalMusic();
      }
    } catch (err) {
      console.error('Error scanning folder files:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRemoveDir = async (dirId) => {
    playPopSfx();
    await removeSavedDirectory(dirId);
    await loadLocalMusic();
  };

  const handleRescan = async () => {
    playPopSfx();
    setIsScanning(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // On native, rescan via MediaStore (authoritative source)
        const scanned = await scanDeviceAudioNative();
        if (scanned && scanned.length > 0) {
          setLocalSongs(scanned.map(ensureValidAudioUrl));
        } else {
          await loadLocalMusic();
        }
      } else if (directories.length > 0 && 'showDirectoryPicker' in window) {
        const updated = await rescanSavedDirectories();
        setLocalSongs(updated);
      } else if ('showDirectoryPicker' in window) {
        const scanned = await requestNativeFolderPicker();
        if (scanned && scanned.length > 0) {
          await loadLocalMusic();
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      console.error('Rescan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearCache = async () => {
    playPopSfx();
    if (stopAndClearIfCurrent) {
      stopAndClearIfCurrent('all');
    }
    // Immediately clear UI state
    setLocalSongs([]);
    setDirectories([]);
    setShowClearConfirm(false);
    await clearLocalSongsCache();
  };

  const handleDeleteTrack = async (e, songId) => {
    e.stopPropagation();
    playPopSfx();
    if (stopAndClearIfCurrent) {
      stopAndClearIfCurrent(songId);
    }
    // Optimistically remove from UI state immediately
    setLocalSongs((prev) => prev.filter((s) => s.id !== songId));
    await deleteLocalSong(songId);
  };

  const handleShuffleAll = () => {
    playPopSfx();
    if (localSongs.length === 0) return;
    const shuffled = [...localSongs].sort(() => Math.random() - 0.5);
    handlePlayPlaylist(shuffled, 0);
  };

  const stats = calculateLocalMusicStats(localSongs);

  const processedSongs = localSongs.filter((song) => {
    const q = searchQuery.toLowerCase();
    return (
      song.title?.toLowerCase().includes(q) ||
      song.artist?.toLowerCase().includes(q) ||
      song.album?.toLowerCase().includes(q) ||
      song.folderName?.toLowerCase().includes(q)
    );
  });

  const sortedSongs = [...processedSongs].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
    if (sortBy === 'album') return a.album.localeCompare(b.album);
    if (sortBy === 'duration') return (b.duration || 0) - (a.duration || 0);
    if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
    return 0;
  });

  const albumsMap = {};
  const artistsMap = {};
  const foldersMap = {};

  localSongs.forEach((s) => {
    const alb = s.album || 'Local Music';
    if (!albumsMap[alb]) albumsMap[alb] = [];
    albumsMap[alb].push(s);

    const art = s.artist || 'Local Artist';
    if (!artistsMap[art]) artistsMap[art] = [];
    artistsMap[art].push(s);

    const fld = s.folderName || 'Storage Folder';
    if (!foldersMap[fld]) foldersMap[fld] = [];
    foldersMap[fld].push(s);
  });

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-3 sm:space-y-5 pb-mobile-safe animate-fade-in select-none w-full max-w-7xl mx-auto">
      {/* Sleek Minimalist Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)]">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-400 text-stone-900 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black font-['Grandstander'] text-[var(--text-primary)]">
                Downloaded Library
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-300 dark:bg-pink-500/30 text-[var(--text-primary)] font-black text-[10px] border border-black">
                {stats.count} Tracks ({stats.sizeDisplay})
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] mt-0.5">
              Downloaded audio files available offline
            </p>
          </div>
        </div>

        {/* Compact Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            onClick={handleShuffleAll}
            disabled={localSongs.length === 0}
            className="toon-button bg-pink-500 hover:bg-pink-400 text-white text-[10px] sm:text-xs py-1.5 sm:py-2 px-2.5 sm:px-3.5 font-black flex items-center gap-1.5"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Shuffle All</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-3">
        {/* Sub Tabs */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
          {[
            { id: 'all', label: 'All Tracks', icon: Music },
            { id: 'albums', label: 'Albums', icon: Disc },
            { id: 'artists', label: 'Artists', icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playPopSfx();
                  setActiveSubTab(tab.id);
                }}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border-2 border-black font-black text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-amber-400 text-stone-900 shadow-[2px_2px_0px_#000]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1 md:w-56 lg:w-64">
            <input
              type="text"
              placeholder="Search downloaded tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 sm:pl-9 pr-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[10px] sm:text-xs font-bold text-[var(--text-primary)] focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Custom Toon Dropdown Popover (Replacing Browser Native Select) */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSortMenu((prev) => !prev);
              }}
              className="flex items-center gap-1.5 bg-[var(--bg-secondary)] px-2.5 sm:px-3 py-1.5 rounded-xl border-2 border-[var(--border-color)] shadow-[2px_2px_0px_#000] hover:scale-105 active:scale-95 transition-all text-[10px] sm:text-xs font-black text-[var(--text-primary)] cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-pink-500 shrink-0" />
              <span className="capitalize">{sortBy}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <>
                <div 
                  className="fixed inset-0 z-[100]" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortMenu(false);
                  }} 
                />

                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 w-36 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[3px_3px_0px_#000] rounded-xl p-1.5 z-[110] animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1 select-none"
                >
                  <p className="text-[9px] font-black text-[var(--text-muted)] px-1.5 py-0.5 uppercase tracking-wider">
                    Sort Tracks By
                  </p>
                  {[
                    { id: 'title', label: 'Title' },
                    { id: 'artist', label: 'Artist' },
                    { id: 'album', label: 'Album' },
                    { id: 'duration', label: 'Duration' },
                  ].map((opt) => {
                    const isSelected = sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortBy(opt.id);
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-300 dark:bg-pink-500 text-stone-900 dark:text-white border border-black shadow-[1px_1px_0px_#000]'
                            : 'text-[var(--text-primary)] hover:bg-amber-200/60 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scanned Directories summary line */}
      {directories.length > 0 && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-[var(--text-muted)] truncate max-w-md">
            Folders: {directories.map((d) => d.name).join(', ')}
          </span>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="font-black text-rose-500 hover:underline shrink-0"
          >
            Clear Cache
          </button>
        </div>
      )}

      {/* Content View */}
      {activeSubTab === 'albums' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
          {Object.entries(albumsMap).map(([albName, tracks]) => {
            const firstWithArt = tracks.find((t) => t.hasCover)?.coverUrl;
            return (
              <div
                key={albName}
                onClick={() => handlePlayPlaylist(tracks, 0)}
                className="p-2 sm:p-3 bg-[var(--bg-secondary)] rounded-2xl border-2 border-black shadow-[2.5px_2.5px_0px_#000] cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <div className="aspect-square bg-stone-800 rounded-xl border border-black flex items-center justify-center text-white mb-2 overflow-hidden">
                  {firstWithArt ? (
                    <img src={firstWithArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-8 h-8 sm:w-10 sm:h-10" />
                  )}
                </div>
                <h4 className="font-black text-[10px] sm:text-xs text-[var(--text-primary)] truncate">{albName}</h4>
                <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)]">{tracks.length} Songs</p>
              </div>
            );
          })}
        </div>
      ) : activeSubTab === 'artists' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
          {Object.entries(artistsMap).map(([artName, tracks]) => (
            <div
              key={artName}
              onClick={() => handlePlayPlaylist(tracks, 0)}
              className="p-2 sm:p-3 bg-[var(--bg-secondary)] rounded-2xl border-2 border-black shadow-[2.5px_2.5px_0px_#000] cursor-pointer text-center hover:scale-[1.02] transition-transform"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto bg-amber-300 text-stone-900 rounded-full border-2 border-black flex items-center justify-center mb-2">
                <User className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h4 className="font-black text-[10px] sm:text-xs text-[var(--text-primary)] truncate">{artName}</h4>
              <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)]">{tracks.length} Songs</p>
            </div>
          ))}
        </div>
      ) : activeSubTab === 'folders' ? (
        <div className="space-y-3">
          {Object.entries(foldersMap).map(([fldName, tracks]) => (
            <div key={fldName} className="p-2.5 sm:p-3.5 bg-[var(--bg-secondary)] rounded-2xl border-2 border-black shadow-[2.5px_2.5px_0px_#000]">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  <h3 className="font-black text-[10px] sm:text-xs text-[var(--text-primary)] truncate">{fldName}</h3>
                </div>
                <button
                  onClick={() => handlePlayPlaylist(tracks, 0)}
                  className="px-2.5 py-1 rounded-lg bg-pink-500 text-white font-black text-[10px] flex items-center gap-1 shrink-0"
                >
                  <Play className="w-3 h-3 fill-current" /> Play
                </button>
              </div>

              <div className="space-y-1">
                {tracks.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handlePlaySong(s, tracks)}
                    className="p-1.5 sm:p-2 rounded-lg bg-[var(--bg-primary)] hover:bg-amber-100 dark:hover:bg-slate-800 border border-black flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className="font-bold text-[var(--text-primary)] truncate">{s.title}</span>
                    <span className="text-[9px] sm:text-[10px] font-black text-[var(--text-muted)] shrink-0">{s.fileSize}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Minimalist Songs List */
        <div className="p-2 sm:p-3 md:p-4 bg-[var(--bg-secondary)] rounded-2xl border-2 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)]">
          {sortedSongs.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Music className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
              <p className="text-xs font-bold text-[var(--text-muted)]">No downloaded tracks found yet. Use the download icon on any song to save it for offline listening!</p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {sortedSongs.map((song) => {
                const isCurrent = currentSong?.id === song.id;

                return (
                  <div
                    key={song.id}
                    onClick={() => handlePlaySong(song, sortedSongs)}
                    className={`p-2 sm:p-2.5 rounded-xl border-2 border-[var(--border-color)] transition-all cursor-pointer flex items-center justify-between gap-2 sm:gap-3 ${
                      isCurrent
                        ? 'bg-amber-100 dark:bg-pink-950/40 border-l-6 border-l-pink-500 shadow-[2px_2px_0px_#000]'
                        : 'bg-[var(--bg-primary)] hover:bg-amber-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-stone-800 border border-black flex items-center justify-center shrink-0 overflow-hidden">
                        {song.hasCover ? (
                          <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className={`font-black text-[11px] sm:text-sm truncate ${isCurrent ? 'text-pink-600 dark:text-pink-400' : 'text-[var(--text-primary)]'}`}>
                          {song.title}
                        </h4>
                        <p className="text-[10px] sm:text-[11px] font-bold text-[var(--text-muted)] truncate">
                          {song.artist} • {song.album}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className="text-[10px] sm:text-xs font-black text-[var(--text-muted)] font-['Grandstander'] hidden sm:inline">
                        {formatTime((currentSong?.id === song.id && duration > 0) ? duration : song.duration)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playPopSfx();
                          addToQueue(ensureValidAudioUrl(song));
                        }}
                        title="Add to Queue"
                        className="p-2 sm:p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-black text-[var(--text-primary)] hover:bg-amber-300 dark:hover:bg-pink-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
                      >
                        <ListPlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteTrack(e, song.id)}
                        title="Delete"
                        className="p-2 sm:p-1.5 rounded-lg bg-rose-100 text-rose-600 border border-black hover:bg-rose-500 hover:text-white min-w-[36px] min-h-[36px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>

                      <button
                        className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full border border-black flex items-center justify-center shrink-0 min-w-[36px] min-h-[36px] ${
                          isCurrent && isPlaying
                            ? 'bg-pink-500 text-white'
                            : 'bg-amber-400 text-stone-900'
                        }`}
                      >
                        <Play className="w-4 h-4 sm:w-3.5 sm:h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clear Cache Confirmation Dialog */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowClearConfirm(false)}
            />
            <div className="p-4 sm:p-5 w-full max-w-xs bg-[var(--bg-secondary)] relative z-10 rounded-2xl border-3 border-black text-center space-y-3 shadow-[4px_4px_0px_#000]">
              <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)]">Clear Local Library Cache?</h3>
              <p className="text-[11px] sm:text-xs font-bold text-[var(--text-muted)]">Saved local song indexes will be cleared. Audio files on your device will NOT be deleted.</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 rounded-xl bg-stone-300 dark:bg-slate-700 text-stone-900 dark:text-white text-xs font-black flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearCache}
                  className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-black flex-1"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
