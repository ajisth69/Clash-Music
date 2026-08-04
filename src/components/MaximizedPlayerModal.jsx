import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Heart, Download, Sparkles, Disc, Mic2, Shuffle, Repeat, Volume2, VolumeX, ListMusic, Share2, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { downloadSingleSong } from '../services/downloadService';
import { playBoingSfx, playLikeSfx, playPopSfx } from '../services/soundEffects';
import { shareItem } from '../services/shareService';
import AudioVisualizerCanvas from './AudioVisualizerCanvas';

export default function MaximizedPlayerModal({ isOpen, onClose, onOpenQueue }) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    queue,
    lyricsData,
    isLoadingLyrics,
    activeLyricIndex,
    audioQuality,
    setAudioQuality,
    isShuffle,
    setIsShuffle,
    repeatMode,
    setRepeatMode,
    togglePlay,
    playSong,
    handleNextTrack,
    handlePrevTrack,
    seekTo
  } = useAudio();

  const { isLiked, toggleLikeSong } = useLibrary();

  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const [mobileTab, setMobileTab] = useState('artwork'); // 'artwork' | 'lyrics'
  const lyricContainerRef = useRef(null);

  // Lock body scroll when modal is open to prevent underlying browser scrollbars
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard shortcut listener for Esc (close) and Space (play/pause)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        playBoingSfx(!isPlaying);
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying]);

  // Auto-scroll lyrics active line into center view smoothly within lyrics container only
  useEffect(() => {
    if (activeLyricIndex >= 0 && lyricContainerRef.current) {
      const container = lyricContainerRef.current;
      const activeEl = container.children[activeLyricIndex];
      if (activeEl) {
        const top = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, top),
          behavior: 'smooth'
        });
      }
    }
  }, [activeLyricIndex]);

  if (!isOpen || !currentSong) return null;

  const liked = isLiked(currentSong.id);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadSingleSong(currentSong);
      confetti({
        particleCount: 50,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (err) {
      alert('Download error: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!currentSong) return;
    const res = await shareItem({ type: 'song', id: currentSong.id, name: currentSong.name, artist: currentSong.artist });
    if (res.success) {
      setCopiedShare(true);
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedShare(false), 1500);
    }
  };

  const handleTogglePlay = () => {
    playBoingSfx(!isPlaying);
    togglePlay();
  };

  const handleLike = () => {
    toggleLikeSong(currentSong);
    if (!liked) {
      playLikeSfx();
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#FF477E', '#FFD166', '#48CAE4']
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed inset-0 z-50 h-[100dvh] w-screen bg-[var(--bg-primary)] flex flex-col p-3 sm:p-5 lg:p-6 transition-colors select-none max-w-full overflow-hidden"
        >
          {/* Dynamic Ambient Blur Glow Backdrop */}
          <div className="fixed inset-0 ambient-bg-tint pointer-events-none z-0 opacity-40" />

          {/* ROW 1: Single Minimize / Go Back Button (Shrink-0) */}
          <div className="relative z-10 max-w-6xl mx-auto w-full flex items-center justify-between shrink-0 pt-1 pb-1">
            <motion.button
              whileHover={{ scale: 1.05, y: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="px-3.5 py-2 rounded-2xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border-3 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] flex items-center gap-2 font-black text-xs shrink-0"
              title="Minimize Player (Esc)"
            >
              <ChevronDown className="w-5 h-5 text-pink-500 animate-bounce-slow" strokeWidth={2.5} />
              <span>MINIMIZE</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-extrabold bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-muted)] ml-1">Esc</kbd>
            </motion.button>
          </div>

          {/* Mobile View Toggle Switch (Vinyl Cover vs Synced Lyrics) - Visible < 1024px */}
          <div className="relative z-10 flex lg:hidden items-center justify-center my-1 shrink-0">
            <div className="bg-[var(--bg-secondary)] p-0.5 rounded-2xl border-2.5 border-[var(--border-color)] shadow-[2.5px_2.5px_0px_var(--shadow-color)] flex items-center gap-1">
              <button
                onClick={() => { playPopSfx(); setMobileTab('artwork'); }}
                className={`px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1 transition-all ${
                  mobileTab === 'artwork'
                    ? 'bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white shadow-[1.5px_1.5px_0px_#000]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Disc className="w-3.5 h-3.5" />
                Vinyl Cover
              </button>
              <button
                onClick={() => { playPopSfx(); setMobileTab('lyrics'); }}
                className={`px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1 transition-all ${
                  mobileTab === 'lyrics'
                    ? 'bg-cyan-400 text-stone-900 shadow-[1.5px_1.5px_0px_#000]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
                Lyrics
              </button>
            </div>
          </div>

          {/* ROW 2: Center Main Content (Flex-1, min-h-0, overflow-hidden, 100% FIT) */}
          <main className="relative z-10 max-w-6xl mx-auto w-full flex-1 min-h-0 overflow-hidden py-1 sm:py-2 my-auto flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6 items-center justify-center max-h-[calc(100vh-210px)]">
            
            {/* Left Column: Vinyl Disc Studio & Artwork */}
            <div className={`w-full flex-1 lg:flex-none flex-col items-center justify-center space-y-2 sm:space-y-3 ${mobileTab === 'artwork' ? 'flex' : 'hidden lg:flex'}`}>
              
              <div className="relative pt-1 pb-0.5 shrink-0">
                {/* Turntable Tone Arm Visual */}
                <div 
                  className={`absolute -top-1 right-0 sm:-right-2 w-10 h-10 lg:w-12 lg:h-12 z-20 pointer-events-none transition-transform duration-700 origin-top-right ${
                    isPlaying ? 'rotate-12' : '-rotate-12'
                  }`}
                >
                  <div className="w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full bg-stone-900 border-2 border-amber-400 absolute top-0 right-0 shadow-[1px_1px_0px_#000]" />
                  <div className="w-1 h-8 lg:h-10 bg-stone-700 border border-black absolute top-1.5 right-1 transform rotate-12 rounded-full" />
                  <div className="w-2 h-2.5 lg:w-2.5 lg:h-3 bg-pink-500 border border-black absolute bottom-0 left-0.5 rounded-md shadow-[1px_1px_0px_#000]" />
                </div>

                {/* Vinyl Wheel */}
                <motion.div
                  animate={{
                    rotate: isPlaying ? 360 : 0,
                    scale: isPlaying ? [1, 1.02, 1] : 1
                  }}
                  transition={{
                    rotate: { duration: 12, ease: "linear", repeat: Infinity },
                    scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="relative w-40 h-40 sm:w-48 sm:h-48 md:w-52 md:h-52 lg:w-52 lg:h-52 xl:w-56 xl:h-56 rounded-full border-3.5 lg:border-4 border-black shadow-[4px_4px_0px_var(--shadow-color)] bg-stone-900 overflow-hidden flex items-center justify-center mx-auto shrink-0"
                >
                  <img
                    src={currentSong.image}
                    alt={currentSong.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
                  />

                  {/* Vinyl Grooves Overlay */}
                  <div className="absolute inset-0 rounded-full border-3 border-dashed border-white/20 pointer-events-none" />
                </motion.div>
              </div>

              {/* Realtime Spectrum Visualizer Strip */}
              <div className="w-40 sm:w-48 lg:w-52 xl:w-56 h-6 sm:h-7 px-2 py-0.5 rounded-xl bg-[var(--bg-secondary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] overflow-hidden shrink-0">
                <AudioVisualizerCanvas height={16} barCount={26} />
              </div>

              {/* Track Metadata */}
              <div className="text-center space-y-0.5 max-w-xs sm:max-w-md px-2 shrink-0">
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-[var(--text-primary)] truncate font-['Grandstander']">
                  {currentSong.name}
                </h2>
                <p className="font-extrabold text-xs sm:text-sm text-pink-600 dark:text-cyan-400 truncate">
                  {currentSong.artist} • {currentSong.album || 'Single'}
                </p>
              </div>
            </div>

            {/* Right Column: Lyrics Panel - Explicitly capped height so all 4 borders & shadows stay 100% visible */}
            <div className={`w-full toon-box p-3 sm:p-4 bg-[var(--bg-secondary)] flex-1 h-full min-h-[180px] max-h-[300px] lg:max-h-[320px] flex flex-col justify-between relative overflow-hidden rounded-2xl border-2.5 sm:border-3 border-[var(--border-color)] shadow-[4px_4px_0px_var(--shadow-color)] my-auto ${mobileTab === 'lyrics' ? 'flex' : 'hidden lg:flex'}`}>
              
              {/* Lyrics Header */}
              <div className="flex items-center justify-between border-b-2.5 border-[var(--border-color)] pb-2 mb-1.5 shrink-0">
                <h4 className="font-black text-xs sm:text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Lyrics
                </h4>
                {lyricsData.synced && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-400 text-stone-900 border border-black font-black text-[10px] shadow-[1px_1px_0px_#000]">
                    SYNCED
                  </span>
                )}
              </div>

              {/* Lyrics Scroller */}
              <div ref={lyricContainerRef} className="flex-1 overflow-y-auto space-y-2 py-1 pr-1 text-center select-none min-h-0">
                {isLoadingLyrics ? (
                  <div className="py-10 space-y-2 animate-pulse">
                    <div className="h-4 bg-stone-300 dark:bg-slate-700 rounded-lg w-3/4 mx-auto" />
                    <div className="h-5 bg-amber-300 dark:bg-pink-500 rounded-lg w-1/2 mx-auto" />
                    <div className="h-4 bg-stone-300 dark:bg-slate-700 rounded-lg w-2/3 mx-auto" />
                  </div>
                ) : lyricsData.lines && lyricsData.lines.length > 0 ? (
                  lyricsData.lines.map((line, index) => {
                    const isActive = index === activeLyricIndex;
                    return (
                      <motion.p
                        key={index}
                        onClick={() => { if (line.time > 0) seekTo(line.time); }}
                        animate={{
                          scale: isActive ? 1.04 : 1,
                          opacity: isActive ? 1 : 0.55
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className={`font-black cursor-pointer transition-colors duration-200 px-2.5 py-1 rounded-xl ${
                          isActive
                            ? 'text-sm sm:text-base lg:text-lg text-stone-900 bg-amber-300 dark:bg-pink-500 border-2 border-black shadow-[2px_2px_0px_#000]'
                            : 'text-xs sm:text-sm text-[var(--text-muted)] hover:opacity-100'
                        }`}
                      >
                        {line.text}
                      </motion.p>
                    );
                  })
                ) : (
                  <div className="py-10 space-y-1">
                    <p className="font-extrabold text-xs sm:text-sm text-[var(--text-muted)]">
                      {lyricsData.plain || 'No lyrics available for this song.'}
                    </p>
                  </div>
                )}
              </div>

            </div>

          </main>

          {/* ROW 3: Bottom Control Deck (Shrink-0, Anchored at Bottom, Zero Scroll) */}
          <footer className="relative z-10 max-w-5xl mx-auto w-full toon-box p-2.5 sm:p-4 bg-[var(--bg-secondary)] border-2.5 sm:border-3.5 border-[var(--border-color)] shadow-[4px_4px_0px_var(--shadow-color)] space-y-2 shrink-0 mt-2 mb-1">
            
            {/* Seek Bar & Timestamps */}
            <div className="w-full flex items-center gap-2 px-1">
              <span className="text-xs font-black text-[var(--text-primary)] shrink-0 w-8 text-right font-mono">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-1 flex items-center h-3 cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime || 0}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full h-2 sm:h-2.5 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border-2 border-[var(--border-color)]"
                />
              </div>
              <span className="text-xs font-black text-[var(--text-primary)] shrink-0 w-8 font-mono">
                {formatTime(duration)}
              </span>
            </div>

            {/* MOBILE DECK (< sm): 2 Clean Rows (0% Overflow, 100% Usable Volume Slider) */}
            <div className="flex sm:hidden flex-col gap-2 w-full pt-0.5">
              
              {/* Row 1: Playback Controls */}
              <div className="flex items-center justify-center gap-2.5 w-full">
                <button
                  onClick={() => setIsShuffle(prev => !prev)}
                  title="Shuffle"
                  className={`p-1.5 rounded-xl border-2 border-[var(--border-color)] active:scale-95 transition-all ${
                    isShuffle ? 'bg-amber-400 text-stone-900 shadow-[1.5px_1.5px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Shuffle className="w-4 h-4" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handlePrevTrack}
                  className="p-1.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] active:scale-95 transition-all"
                  title="Previous Track"
                >
                  <SkipBack className="w-4.5 h-4.5 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-11 h-11 rounded-2xl bg-cyan-400 dark:bg-pink-500 text-stone-900 dark:text-white border-3 border-[var(--border-color)] shadow-[2.5px_2.5px_0px_var(--shadow-color)] flex items-center justify-center active:scale-95 transition-all"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="p-1.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] active:scale-95 transition-all"
                  title="Next Track"
                >
                  <SkipForward className="w-4.5 h-4.5 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                  title={`Repeat Mode: ${repeatMode}`}
                  className={`p-1.5 rounded-xl border-2 border-[var(--border-color)] active:scale-95 transition-all ${
                    repeatMode !== 'off' ? 'bg-amber-400 text-stone-900 shadow-[1.5px_1.5px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Repeat className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* Row 2: Action Tools & Mobile Volume Control */}
              <div className="flex items-center justify-between gap-2 w-full pt-1.5 border-t border-[var(--border-color)]/30">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleLike}
                    className={`p-1.5 rounded-xl border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] active:scale-95 transition-all ${
                      liked ? 'bg-rose-500 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                    }`}
                    title={liked ? 'Unlike' : 'Like'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} strokeWidth={2.5} />
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="p-1.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:bg-amber-300 dark:hover:bg-pink-500 transition-all disabled:opacity-50 active:scale-95"
                    title="Download MP3"
                  >
                    <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} strokeWidth={2.5} />
                  </button>

                  <button
                    onClick={onOpenQueue}
                    className="p-1.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:bg-cyan-300 dark:hover:bg-cyan-500/30 transition-all active:scale-95"
                    title="View Queue"
                  >
                    <ListMusic className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Mobile Volume Icon & Slider Bar */}
                <div className="flex items-center gap-1.5 flex-1 max-w-[160px] justify-end">
                  <button
                    onClick={() => setIsMuted(prev => !prev)}
                    className="p-1.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] shrink-0 active:scale-95"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    className="w-full h-1.5 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]"
                  />
                </div>
              </div>

            </div>

            {/* DESKTOP DECK (sm+) */}
            <div className="hidden sm:flex items-center justify-between gap-2 max-w-full overflow-hidden">
              
              {/* Left Side: Like, Download & Queue Button */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={handleLike}
                  className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] active:scale-95 transition-all shrink-0 ${
                    liked ? 'bg-rose-500 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                  }`}
                  title={liked ? 'Unlike' : 'Like'}
                >
                  <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${liked ? 'fill-current' : ''}`} strokeWidth={2.5} />
                </button>

                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] hover:bg-amber-300 dark:hover:bg-pink-500 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                  title="Download MP3"
                >
                  <Download className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isDownloading ? 'animate-bounce' : ''}`} strokeWidth={2.5} />
                </button>

                <button
                  onClick={onOpenQueue}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] hover:bg-cyan-300 dark:hover:bg-cyan-500/30 active:scale-95 transition-all shrink-0"
                  title="View Queue"
                >
                  <ListMusic className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Center Side: Main Playback Controls */}
              <div className="flex items-center gap-1 sm:gap-2.5">
                <button
                  onClick={() => setIsShuffle(prev => !prev)}
                  title="Shuffle"
                  className={`p-1.5 sm:p-2.5 rounded-xl border-2 border-[var(--border-color)] active:scale-95 transition-all ${
                    isShuffle ? 'bg-amber-400 text-stone-900 shadow-[2px_2px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Shuffle className="w-4 h-4" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handlePrevTrack}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] active:scale-95 transition-all"
                  title="Previous Track"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-11 h-11 sm:w-13 sm:h-13 lg:w-14 lg:h-14 rounded-2xl sm:rounded-3xl bg-cyan-400 dark:bg-pink-500 text-stone-900 dark:text-white border-3 sm:border-3.5 border-[var(--border-color)] shadow-[3.5px_3.5px_0px_var(--shadow-color)] flex items-center justify-center active:scale-95 transition-all"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] active:scale-95 transition-all"
                  title="Next Track"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                  title={`Repeat Mode: ${repeatMode}`}
                  className={`p-1.5 sm:p-2.5 rounded-xl border-2 border-[var(--border-color)] active:scale-95 transition-all ${
                    repeatMode !== 'off' ? 'bg-amber-400 text-stone-900 shadow-[2px_2px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Repeat className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* Right Side: Desktop Volume Control */}
              <div className="flex items-center gap-1.5 sm:gap-2 relative">
                <button
                  onClick={() => setIsMuted(prev => !prev)}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] shrink-0 active:scale-95 transition-all"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-500" /> : <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                </button>

                <div className="flex items-center w-16 sm:w-20 lg:w-28">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    className="w-full h-2 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border-1.5 border-[var(--border-color)]"
                  />
                </div>
              </div>

            </div>

          </footer>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
