import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Heart, Download, Sparkles, Disc, Mic2, Shuffle, Repeat, Volume2, VolumeX, ListMusic, Share2, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { downloadSingleSong } from '../services/downloadService';
import { playBoingSfx, playLikeSfx, playPopSfx } from '../services/soundEffects';
import { shareItem } from '../services/shareService';
import { RenderArtistLinks } from './SongCard';
import { getDisplayImage } from '../services/musicApi';
import AudioVisualizerCanvas from './AudioVisualizerCanvas';

export default function MaximizedPlayerModal({ isOpen, onClose, onOpenQueue, onSelectArtist }) {
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
          className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-[var(--bg-primary)] flex flex-col p-2 sm:p-3.5 md:p-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(1.75rem,env(safe-area-inset-bottom,0px))] transition-colors select-none max-w-full overflow-hidden"
        >
          {/* Dynamic Ambient Blur Glow Backdrop */}
          <div className="fixed inset-0 ambient-bg-tint pointer-events-none z-0 opacity-40" />

          {/* ROW 1: Single Minimize / Go Back Button (Shrink-0) */}
          <div className="relative z-10 max-w-6xl mx-auto w-full flex items-center justify-between shrink-0 pt-0.5 pb-0.5">
            <motion.button
              whileHover={{ scale: 1.05, y: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center gap-1.5 font-black text-xs shrink-0"
              title="Minimize Player (Esc)"
            >
              <ChevronDown className="w-4 h-4 text-pink-500 animate-bounce-slow" strokeWidth={2.5} />
              <span>MINIMIZE</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-extrabold bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-muted)] ml-1">Esc</kbd>
            </motion.button>
          </div>

          {/* Mobile/Tablet Toggle Switch (Vinyl Cover vs Synced Lyrics) - Visible < 1024px */}
          <div className="relative z-10 flex lg:hidden items-center justify-center my-0.5 shrink-0">
            <div className="bg-[var(--bg-secondary)] p-0.5 rounded-xl border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] flex items-center gap-1">
              <button
                onClick={() => { playPopSfx(); setMobileTab('artwork'); }}
                className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 transition-all min-h-[44px] ${
                  mobileTab === 'artwork'
                    ? 'bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white shadow-[1px_1px_0px_#000]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Disc className="w-3.5 h-3.5" />
                Vinyl Cover
              </button>
              <button
                onClick={() => { playPopSfx(); setMobileTab('lyrics'); }}
                className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 transition-all min-h-[44px] ${
                  mobileTab === 'lyrics'
                    ? 'bg-cyan-400 text-stone-900 shadow-[1px_1px_0px_#000]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
                Lyrics
              </button>
            </div>
          </div>

          {/* ROW 2: Center Main Content (Responsive Sizing across Mobile, Tablet, iPad & Desktop) */}
          <main className="relative z-10 max-w-5xl mx-auto w-full flex-1 py-1 my-auto flex flex-col lg:grid lg:grid-cols-2 gap-2.5 sm:gap-3.5 lg:gap-5 items-center justify-center min-h-0 overflow-hidden">
            
            {/* Left Column: Vinyl Disc Studio & Artwork */}
            <div className={`w-full flex-col items-center justify-center space-y-1.5 shrink-0 ${mobileTab === 'artwork' ? 'flex' : 'hidden lg:flex'}`}>
              
              <div className="relative pt-1 pb-0.5 shrink-0 flex items-center justify-center">
                {/* Turntable Tone Arm Visual */}
                <div 
                  className={`absolute -top-1 right-1 sm:right-3 w-8 h-8 sm:w-10 sm:h-10 z-20 pointer-events-none transition-transform duration-700 origin-top-right ${
                    isPlaying ? 'rotate-12' : '-rotate-12'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-stone-900 border-2 border-amber-400 absolute top-0 right-0 shadow-[1px_1px_0px_#000]" />
                  <div className="w-1 h-6 sm:h-8 bg-stone-700 border border-black absolute top-1.5 right-1 transform rotate-12 rounded-full" />
                  <div className="w-2 h-2 bg-pink-500 border border-black absolute bottom-0 left-0.5 rounded-md shadow-[1px_1px_0px_#000]" />
                </div>

                {/* Vinyl Wheel - Fully Responsive Sizing */}
                <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 lg:w-48 lg:h-48 xl:w-56 xl:h-56 aspect-square rounded-full border-3 sm:border-3.5 border-black shadow-[3px_3px_0px_var(--shadow-color)] bg-stone-900 overflow-hidden flex items-center justify-center mx-auto shrink-0 flex-none max-w-[60vw] max-h-[60vw]">
                  {/* Rotating Inner Disc (Only Image Rotates, Box Shadow Stays Perfect Circle) */}
                  <motion.div
                    animate={{
                      rotate: isPlaying ? 360 : 0
                    }}
                    transition={{
                      rotate: { duration: 12, ease: "linear", repeat: Infinity }
                    }}
                    className="w-full h-full rounded-full overflow-hidden relative flex items-center justify-center aspect-square shrink-0"
                  >
                    <img
                      src={getDisplayImage(currentSong)}
                      alt=""
                      className="w-full h-full object-cover rounded-full aspect-square"
                    />

                    {/* Vinyl Grooves Overlay */}
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/25 pointer-events-none" />
                    
                    {/* Vinyl Center Hole Visual */}
                    <div className="absolute w-4 h-4 rounded-full bg-stone-900 border-2 border-amber-400/80 shadow-inner pointer-events-none" />
                  </motion.div>
                </div>
              </div>

              {/* Realtime Spectrum Visualizer Strip */}
              <div className="w-28 xs:w-32 sm:w-40 md:w-44 lg:w-48 xl:w-56 h-5 px-2 py-0.5 rounded-xl bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] overflow-hidden shrink-0 max-w-[60vw]">
                <AudioVisualizerCanvas height={12} barCount={24} />
              </div>

              {/* Track Metadata */}
              <div className="text-center space-y-0.5 max-w-[80vw] sm:max-w-md px-2 shrink-0">
                <h2 className="text-sm sm:text-base md:text-lg font-black text-[var(--text-primary)] truncate font-['Grandstander']">
                  {currentSong.name}
                </h2>
                <div className="font-extrabold text-xs text-pink-600 dark:text-cyan-400 truncate">
                  <RenderArtistLinks
                    artistStr={currentSong.artist}
                    onSelectArtist={onSelectArtist}
                    onBeforeSelect={onClose}
                  />
                  <span> • {currentSong.album || 'Single'}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Lyrics Panel - Compact Flexible Sizing */}
            <div className={`w-full toon-box p-2.5 sm:p-3.5 bg-[var(--bg-secondary)] flex-1 h-40 sm:h-48 md:h-56 lg:h-[300px] xl:h-[340px] max-h-[30vh] lg:max-h-[42vh] min-h-[120px] flex flex-col justify-between relative overflow-hidden rounded-2xl border-2 sm:border-2.5 border-[var(--border-color)] shadow-[2.5px_2.5px_0px_var(--shadow-color)] my-auto ${mobileTab === 'lyrics' ? 'flex' : 'hidden lg:flex'}`}>
              
              {/* Lyrics Header */}
              <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] pb-1.5 mb-1 shrink-0">
                <h4 className="font-black text-xs text-[var(--text-primary)] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Lyrics
                </h4>
                {lyricsData.synced && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-400 text-stone-900 border border-black font-black text-[9px] shadow-[1px_1px_0px_#000]">
                    SYNCED
                  </span>
                )}
              </div>

              {/* Lyrics Scroller */}
              <div ref={lyricContainerRef} className="flex-1 overflow-y-auto space-y-1.5 py-1 pr-1 text-center select-none min-h-0">
                {isLoadingLyrics ? (
                  <div className="py-8 space-y-2 animate-pulse">
                    <div className="h-3.5 bg-stone-300 dark:bg-slate-700 rounded-lg w-3/4 mx-auto" />
                    <div className="h-4 bg-amber-300 dark:bg-pink-500 rounded-lg w-1/2 mx-auto" />
                    <div className="h-3.5 bg-stone-300 dark:bg-slate-700 rounded-lg w-2/3 mx-auto" />
                  </div>
                ) : lyricsData.lines && lyricsData.lines.length > 0 ? (
                  lyricsData.lines.map((line, index) => {
                    const isActive = index === activeLyricIndex;
                    return (
                      <motion.p
                        key={index}
                        onClick={() => { if (line.time > 0) seekTo(line.time); }}
                        animate={{
                          scale: isActive ? 1.03 : 1,
                          opacity: isActive ? 1 : 0.55
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className={`font-black cursor-pointer transition-colors duration-200 px-2 py-0.5 rounded-lg ${
                          isActive
                            ? 'text-xs sm:text-sm md:text-base text-stone-900 bg-amber-300 dark:bg-pink-500 border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                            : 'text-[11px] sm:text-xs text-[var(--text-muted)] hover:opacity-100'
                        }`}
                      >
                        {line.text}
                      </motion.p>
                    );
                  })
                ) : (
                  <div className="py-8 space-y-1">
                    <p className="font-extrabold text-xs text-[var(--text-muted)]">
                      {lyricsData.plain || 'No lyrics available for this song.'}
                    </p>
                  </div>
                )}
              </div>

            </div>

          </main>

          {/* ROW 3: Bottom Control Deck (Compact, Shrink-0, Fits All Tablets) */}
          <footer className="relative z-10 max-w-5xl mx-auto w-full toon-box p-1.5 sm:p-2.5 md:p-3 bg-[var(--bg-secondary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] space-y-1.5 shrink-0 mt-1 mb-3 sm:mb-1">
            
            {/* Seek Bar & Timestamps */}
            <div className="w-full flex items-center gap-2 px-1">
              <span className="text-[11px] font-black text-[var(--text-primary)] shrink-0 w-8 text-right font-mono">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-1 flex items-center h-2.5 cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime || 0}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full h-1.5 sm:h-2 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]"
                />
              </div>
              <span className="text-[11px] font-black text-[var(--text-primary)] shrink-0 w-8 font-mono">
                {formatTime(duration)}
              </span>
            </div>

            {/* MOBILE DECK (< sm) */}
            <div className="flex sm:hidden flex-col gap-1.5 w-full pt-0.5">
              
              {/* Row 1: Playback Controls */}
              <div className="flex items-center justify-center gap-2 w-full">
                <button
                  onClick={() => setIsShuffle(prev => !prev)}
                  title="Shuffle"
                  className={`p-2.5 rounded-xl border border-[var(--border-color)] active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    isShuffle ? 'bg-amber-400 text-stone-900 shadow-[1px_1px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Shuffle className="w-4 h-4" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handlePrevTrack}
                  className="p-2.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)] active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Previous Track"
                >
                  <SkipBack className="w-4 h-4 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-11 h-11 rounded-2xl bg-cyan-400 dark:bg-pink-500 text-stone-900 dark:text-white border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center active:scale-95 transition-all min-w-[44px] min-h-[44px]"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="p-2.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)] active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Next Track"
                >
                  <SkipForward className="w-4 h-4 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                  title={`Repeat Mode: ${repeatMode}`}
                  className={`p-2.5 rounded-xl border border-[var(--border-color)] active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    repeatMode !== 'off' ? 'bg-amber-400 text-stone-900 shadow-[1px_1px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Repeat className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* Row 2: Action Tools & Mobile Volume Control */}
              <div className="flex items-center justify-between gap-2 w-full pt-1 border-t border-[var(--border-color)]/30">
                <div className="flex items-center gap-1.5">
                  {!(currentSong?.isLocal || (typeof currentSong?.id === 'string' && currentSong.id.startsWith('local_')) || currentSong?.fileBlob || currentSong?.folderName) && (
                    <>
                      <button
                        onClick={handleLike}
                        className={`p-2 rounded-xl border border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)] active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                          liked ? 'bg-rose-500 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                        }`}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} strokeWidth={2.5} />
                      </button>

                      <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)] hover:bg-amber-300 dark:hover:bg-pink-500 transition-all disabled:opacity-50 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Download MP3"
                      >
                        <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} strokeWidth={2.5} />
                      </button>
                    </>
                  )}

                  <button
                    onClick={onOpenQueue}
                    className="p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)] hover:bg-cyan-300 dark:hover:bg-cyan-500/30 transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="View Queue"
                  >
                    <ListMusic className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Mobile Volume Icon & Slider Bar */}
                <div className="flex items-center gap-1.5 flex-1 max-w-[140px] justify-end">
                  <button
                    onClick={() => setIsMuted(prev => !prev)}
                    className="p-1.5 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shrink-0 active:scale-95 min-w-[36px] min-h-[36px] flex items-center justify-center"
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
                    className="w-full h-2 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]"
                  />
                </div>
              </div>

            </div>

            {/* DESKTOP / TABLET DECK (sm+) */}
            <div className="hidden sm:flex items-center justify-between gap-2 max-w-full overflow-hidden">
              
              {/* Left Side: Like, Download & Queue Button */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                {!(currentSong?.isLocal || (typeof currentSong?.id === 'string' && currentSong.id.startsWith('local_')) || currentSong?.fileBlob || currentSong?.folderName) && (
                  <>
                    <button
                      onClick={handleLike}
                      className={`p-1.5 sm:p-2 rounded-xl border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] active:scale-95 transition-all shrink-0 ${
                        liked ? 'bg-rose-500 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                      }`}
                      title={liked ? 'Unlike' : 'Like'}
                    >
                      <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${liked ? 'fill-current' : ''}`} strokeWidth={2.5} />
                    </button>

                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="p-1.5 sm:p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:bg-amber-300 dark:hover:bg-pink-500 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                      title="Download MP3"
                    >
                      <Download className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isDownloading ? 'animate-bounce' : ''}`} strokeWidth={2.5} />
                    </button>
                  </>
                )}

                <button
                  onClick={onOpenQueue}
                  className="p-1.5 sm:p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:bg-cyan-300 dark:hover:bg-cyan-500/30 active:scale-95 transition-all shrink-0"
                  title="View Queue"
                >
                  <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* Center Side: Main Playback Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsShuffle(prev => !prev)}
                  title="Shuffle"
                  className={`p-1.5 sm:p-2 rounded-xl border-2 border-[var(--border-color)] active:scale-95 transition-all ${
                    isShuffle ? 'bg-amber-400 text-stone-900 shadow-[1.5px_1.5px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handlePrevTrack}
                  className="p-1.5 sm:p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] active:scale-95 transition-all"
                  title="Previous Track"
                >
                  <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl bg-cyan-400 dark:bg-pink-500 text-stone-900 dark:text-white border-2.5 sm:border-3 border-[var(--border-color)] shadow-[2.5px_2.5px_0px_var(--shadow-color)] flex items-center justify-center active:scale-95 transition-all"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="p-1.5 sm:p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] active:scale-95 transition-all"
                  title="Next Track"
                >
                  <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" strokeWidth={2.5} />
                </button>

                <button
                  onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                  title={`Repeat Mode: ${repeatMode}`}
                  className={`p-1.5 sm:p-2 rounded-xl border-2 border-[var(--border-color)] active:scale-95 transition-all ${
                    repeatMode !== 'off' ? 'bg-amber-400 text-stone-900 shadow-[1.5px_1.5px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* Right Side: Desktop Volume Control */}
              <div className="flex items-center gap-1.5 sm:gap-2 relative">
                <button
                  onClick={() => setIsMuted(prev => !prev)}
                  className="p-1.5 sm:p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] shrink-0 active:scale-95 transition-all"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>

                <div className="flex items-center w-14 sm:w-20 lg:w-24">
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
                    className="w-full h-1.5 sm:h-2 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]"
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
