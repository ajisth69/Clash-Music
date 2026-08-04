import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Download, Maximize2, Repeat, Shuffle, ListMusic, Share2, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { shareItem } from '../services/shareService';

import AudioVisualizerCanvas from './AudioVisualizerCanvas';

export default function DockedPlayer({ onExpandPlayer, onOpenQueue }) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    isShuffle,
    setIsShuffle,
    repeatMode,
    setRepeatMode,
    togglePlay,
    handleNextTrack,
    handlePrevTrack,
    seekTo
  } = useAudio();

  const { isLiked, toggleLikeSong } = useLibrary();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);

  const handleShare = async () => {
    const res = await shareItem({ type: 'song', id: currentSong.id, name: currentSong.name, artist: currentSong.artist });
    if (res.success) {
      setCopiedShare(true);
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.9 },
        colors: ['#22d3ee', '#f472b6', '#fbbf24']
      });
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  return (
    <div className="fixed bottom-[48px] lg:bottom-0 left-0 right-0 z-40 px-2 sm:px-4 pb-1.5 pt-0 pointer-events-none select-none">
      <div className="max-w-6xl mx-auto toon-box p-1.5 sm:p-2 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[0_-4px_12px_rgba(0,0,0,0.15)] pointer-events-auto flex flex-col gap-1 transition-colors duration-300">
        
        {/* Realtime Spectrum Visualizer Strip - Sleek height */}
        <div className="h-2.5 sm:h-3.5 w-full rounded-lg overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-color)] px-1.5 flex items-center">
          <AudioVisualizerCanvas height={14} barCount={40} />
        </div>

        {/* Top Seek Progress Bar */}
        <div className="w-full flex items-center gap-1.5 px-0.5">
          <span className="text-[9px] sm:text-[10px] font-extrabold text-[var(--text-primary)] shrink-0 font-mono">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 flex items-center h-3 cursor-pointer">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime || 0}
              onChange={handleSeekChange}
              className="w-full h-1 sm:h-1.5 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]"
            />
          </div>
          <span className="text-[9px] sm:text-[10px] font-extrabold text-[var(--text-primary)] shrink-0 font-mono">
            {formatTime(duration)}
          </span>
        </div>

        {/* Player Main Controls Row */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3">
          
          {/* Left: Album Artwork & Info */}
          <div 
            onClick={onExpandPlayer}
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group shrink-0 max-w-[120px] sm:max-w-xs"
          >
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] shrink-0 bg-stone-800">
              <img
                src={currentSong.image}
                alt={currentSong.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-[11px] sm:text-xs text-[var(--text-primary)] truncate leading-tight group-hover:text-amber-500 dark:group-hover:text-pink-400 transition-colors">
                {currentSong.name}
              </h4>
              <p className="font-bold text-[9px] sm:text-[11px] text-[var(--text-muted)] truncate leading-tight">
                {currentSong.artist}
              </p>
            </div>
          </div>

          {/* Center: Playback Control Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            
            {/* Shuffle Toggle */}
            <button
              onClick={() => setIsShuffle(prev => !prev)}
              title="Shuffle"
              className={`hidden sm:inline-flex p-1 rounded-lg border border-[var(--border-color)] transition-all ${
                isShuffle ? 'bg-amber-400 text-stone-900 shadow-[1.5px_1.5px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Prev Track */}
            <button
              onClick={handlePrevTrack}
              title="Previous Track"
              className="p-1 sm:p-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:scale-105 active:scale-95 transition-all"
            >
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Play/Pause Main Button */}
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-cyan-400 dark:bg-pink-500 text-stone-900 dark:text-white border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" /> : <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current ml-0.5" />}
            </button>

            {/* Next Track */}
            <button
              onClick={handleNextTrack}
              title="Next Track"
              className="p-1 sm:p-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:scale-105 active:scale-95 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Repeat Toggle */}
            <button
              onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
              title={`Repeat Mode: ${repeatMode}`}
              className={`hidden sm:inline-flex p-1 rounded-lg border border-[var(--border-color)] transition-all ${
                repeatMode !== 'off' ? 'bg-amber-400 text-stone-900 shadow-[1.5px_1.5px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

          </div>

          {/* Right: Like, Share, Volume & Expand */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            
            {/* Like Button */}
            <button
              onClick={() => toggleLikeSong(currentSong)}
              title={liked ? 'Unlike' : 'Like'}
              className={`p-1 sm:p-1.5 rounded-lg border border-[var(--border-color)] transition-all ${
                liked ? 'bg-rose-500 text-white shadow-[1.5px_1.5px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
            </button>

            {/* Share Song Button */}
            <button
              onClick={handleShare}
              title={copiedShare ? 'Link Copied!' : 'Share Song'}
              className={`p-1 sm:p-1.5 rounded-lg border border-[var(--border-color)] transition-all ${
                copiedShare
                  ? 'bg-emerald-400 text-stone-900 shadow-[1.5px_1.5px_0px_var(--shadow-color)]'
                  : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-amber-300 dark:hover:bg-pink-500'
              }`}
            >
              {copiedShare ? <Check className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} /> : <Share2 className="w-3.5 h-3.5" strokeWidth={2.5} />}
            </button>

            {/* Queue Button */}
            <button
              onClick={onOpenQueue}
              title="View Queue"
              className="p-1 sm:p-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:scale-105 active:scale-95 transition-all"
            >
              <ListMusic className="w-3.5 h-3.5" />
            </button>

            {/* Volume Control Popover - Clickable & Persistent on both Mobile & PC */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVolumeSlider(prev => !prev);
                }}
                className={`p-1 sm:p-1.5 rounded-lg border transition-all ${
                  showVolumeSlider
                    ? 'bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white border-black shadow-[1.5px_1.5px_0px_#000]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)]'
                }`}
                title="Adjust Volume"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {showVolumeSlider && (
                <>
                  {/* Backdrop to close volume popover when clicking anywhere outside */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVolumeSlider(false);
                    }}
                  />

                  {/* Volume Slider Popover Card */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full right-0 mb-2 p-2 sm:p-2.5 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[4px_4px_0px_var(--shadow-color)] rounded-xl z-50 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <button
                      onClick={() => setIsMuted(prev => !prev)}
                      className="p-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-stone-900 dark:text-white hover:scale-105 active:scale-95"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
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
                      className="w-24 sm:w-28 h-2 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]"
                    />

                    <span className="text-[10px] font-black text-[var(--text-primary)] font-mono w-7 text-right">
                      {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Expand Fullscreen Player Modal */}
            <button
              onClick={onExpandPlayer}
              className="p-1 sm:p-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] hover:scale-105 active:scale-95 transition-all"
              title="Expand Lyrics & Player"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}

