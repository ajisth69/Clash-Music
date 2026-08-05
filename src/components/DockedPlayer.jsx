import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Maximize2, ListMusic, Share2, Plus, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { shareItem } from '../services/shareService';
import { getDisplayImage } from '../services/musicApi';
import { RenderArtistLinks } from './SongCard';

import AudioVisualizerCanvas from './AudioVisualizerCanvas';

export default function DockedPlayer({ onExpandPlayer, onOpenQueue, onSelectArtist }) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    togglePlay,
    handleNextTrack,
    handlePrevTrack,
    seekTo
  } = useAudio();

  const { isLiked, toggleLikeSong, playlists, addSongToPlaylist } = useLibrary();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addedPlaylistId, setAddedPlaylistId] = useState(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const volumeTimeoutRef = React.useRef(null);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);

  const handleMouseEnterVolume = () => {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    setShowVolumeSlider(true);
  };

  const handleMouseLeaveVolume = () => {
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 300);
  };

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

  const handleAddToPlaylist = (playlistId, e) => {
    e.stopPropagation();
    addSongToPlaylist(playlistId, currentSong);
    setAddedPlaylistId(playlistId);
    setTimeout(() => {
      setAddedPlaylistId(null);
      setShowPlaylistMenu(false);
    }, 1000);
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

  const isLocalFile = currentSong?.isLocal || (typeof currentSong?.id === 'string' && currentSong.id.startsWith('local_')) || currentSong?.fileBlob || currentSong?.folderName;

  return (
    <div className="fixed bottom-[calc(5rem+max(16px,env(safe-area-inset-bottom,0px)))] lg:bottom-3 left-0 right-0 z-40 px-2 sm:px-3 lg:px-4 pointer-events-none select-none overflow-visible">
      <div className="max-w-[calc(100vw-1rem)] sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto p-1.5 sm:p-2 lg:p-2.5 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[0_6px_24px_rgba(0,0,0,0.35)] pointer-events-auto rounded-2xl relative transition-all flex flex-col gap-1.5 overflow-visible">
        
        {/* Visualizer Spectrum Strip */}
        <div className="h-1 sm:h-1.5 w-full rounded-md overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-color)]/30 px-1 flex items-center shrink-0">
          <AudioVisualizerCanvas height={6} barCount={44} />
        </div>

        {/* Top Row: Track Info & Scrubbing Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 w-full overflow-visible">
          
          {/* Track Info */}
          <div 
            onClick={onExpandPlayer}
            className="flex items-center gap-2 min-w-0 cursor-pointer group w-full md:w-auto shrink-0"
          >
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border border-[var(--border-color)] shadow-sm shrink-0 bg-stone-800">
              <img
                src={getDisplayImage(currentSong)}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-3 h-3 text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1 md:max-w-[220px]">
              <h4 className="font-black text-[11px] sm:text-xs text-[var(--text-primary)] truncate leading-tight group-hover:text-pink-500 transition-colors">
                {currentSong.name}
              </h4>
              <RenderArtistLinks
                artistStr={currentSong.artist}
                onSelectArtist={onSelectArtist}
                className="font-bold text-[9px] text-[var(--text-muted)] truncate block leading-tight"
              />
            </div>
          </div>

          {/* Scrubbing Bar & Timestamps */}
          <div className="flex items-center gap-1.5 w-full min-w-0 px-0.5 flex-1">
            <span className="text-[9.5px] font-black text-[var(--text-muted)] font-mono shrink-0 w-7 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="relative flex-1 flex items-center h-3 cursor-pointer min-w-0">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime || 0}
                onChange={handleSeekChange}
                className="w-full h-1.5 bg-stone-300 dark:bg-slate-700/80 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]/30"
              />
            </div>

            <span className="text-[9.5px] font-black text-[var(--text-muted)] font-mono shrink-0 w-7 text-left">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Reorganized Player Bar Controls Row (justify-content: space-between) */}
        <div className="flex items-center justify-between w-full gap-2 pt-0.5 overflow-visible relative">
          
          {/* LEFT SECTION: Volume Control, Queue/Playlist icon, Maximize/Expand icon */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-visible relative">
            
            {/* Volume Control Popover Trigger Container */}
            <div 
              className="relative shrink-0 overflow-visible"
              onMouseEnter={handleMouseEnterVolume}
              onMouseLeave={handleMouseLeaveVolume}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVolumeSlider(prev => !prev);
                }}
                className={`aspect-square w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                  showVolumeSlider
                    ? 'bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white border-black shadow-[1.5px_1.5px_0px_#000]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-color)] shadow-sm hover:scale-105'
                }`}
                title="Adjust Volume"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Volume Slider Popover (Absolute position: bottom: 100%, z-index: 9999, overflow: visible) */}
              {showVolumeSlider && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-0 mb-2.5 p-2 sm:p-2.5 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[0_12px_28px_rgba(0,0,0,0.5)] rounded-2xl z-[9999] flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
                  style={{ position: 'absolute', bottom: '100%', zIndex: 9999 }}
                >
                  <button
                    onClick={() => setIsMuted(prev => !prev)}
                    className="aspect-square w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-stone-900 dark:text-white flex items-center justify-center hover:scale-105 active:scale-95 shrink-0"
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
                    className="w-20 sm:w-28 h-1.5 bg-stone-300 dark:bg-slate-700 rounded-full appearance-none accent-pink-500 cursor-pointer border border-[var(--border-color)]/40"
                  />

                  <span className="text-[10px] font-black text-[var(--text-primary)] font-mono w-7 text-right">
                    {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                  </span>
                </div>
              )}
            </div>

            {/* Queue / Playlist Icon */}
            <button
              onClick={onOpenQueue}
              title="View Queue"
              className="aspect-square w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <ListMusic className="w-3.5 h-3.5" />
            </button>

            {/* Maximize / Expand Icon */}
            <button
              onClick={onExpandPlayer}
              title="Maximize Player"
              className="aspect-square w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

          </div>

          {/* CENTER SECTION: Primary Playback Controls (Previous, Play/Pause, Next) - Centered Horizontally */}
          <div className="flex items-center gap-2 sm:gap-3 justify-center shrink-0">
            {/* Previous Track */}
            <button
              onClick={handlePrevTrack}
              title="Previous Track"
              className="aspect-square w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            </button>

            {/* Play / Pause Main Primary Button (Highlighted Action) */}
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="aspect-square w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-400 dark:bg-pink-500 text-stone-900 dark:text-white border-2 border-[var(--border-color)] shadow-[2px_2px_0px_#000] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current ml-0.5" />}
            </button>

            {/* Next Track */}
            <button
              onClick={handleNextTrack}
              title="Next Track"
              className="aspect-square w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-lg sm:rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            </button>
          </div>

          {/* RIGHTMOST SECTION: Secondary Utility Icons (Like, Add to Playlist, Share) */}
          <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 overflow-visible relative">
            {!isLocalFile && (
              <>
                {/* Like / Heart Button */}
                <button
                  onClick={() => toggleLikeSong(currentSong)}
                  title={liked ? 'Unlike' : 'Like'}
                  className={`aspect-square w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[var(--border-color)] flex items-center justify-center transition-all shrink-0 ${
                    liked ? 'bg-rose-500 text-white shadow-[1px_1px_0px_var(--shadow-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm hover:scale-105'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                </button>

                {/* Add to Playlist (+) Dropdown */}
                <div className="relative shrink-0 overflow-visible">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlaylistMenu(prev => !prev);
                    }}
                    title="Add to Playlist"
                    className="aspect-square w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>

                  {showPlaylistMenu && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-2.5 w-44 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[3px_3px_0px_#000] rounded-xl p-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-150"
                      style={{ position: 'absolute', bottom: '100%', zIndex: 9999 }}
                    >
                      <p className="text-[9px] font-black text-[var(--text-muted)] px-1 py-0.5 uppercase tracking-wider">
                        Add to Playlist
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-0.5 mt-0.5">
                        {playlists.length === 0 ? (
                          <p className="text-[10px] text-[var(--text-muted)] px-1 py-0.5 font-bold">No playlists</p>
                        ) : (
                          playlists.map(pl => (
                            <button
                              key={pl.id}
                              onClick={(e) => handleAddToPlaylist(pl.id, e)}
                              className="w-full text-left px-1.5 py-1 rounded-md hover:bg-amber-300 dark:hover:bg-pink-500 text-[11px] font-bold text-[var(--text-primary)] flex items-center justify-between truncate min-h-[28px]"
                            >
                              <span className="truncate">{pl.name}</span>
                              {addedPlaylistId === pl.id && <Check className="w-3 h-3 text-emerald-600" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  title={copiedShare ? 'Link Copied!' : 'Share Song'}
                  className={`aspect-square w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[var(--border-color)] flex items-center justify-center transition-all shrink-0 ${
                    copiedShare
                      ? 'bg-emerald-400 text-stone-900 shadow-[1px_1px_0px_#000]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-amber-300 dark:hover:bg-pink-500 shadow-sm hover:scale-105'
                  }`}
                >
                  {copiedShare ? <Check className="w-3 h-3 text-stone-900" strokeWidth={2.5} /> : <Share2 className="w-3.5 h-3.5" strokeWidth={2.5} />}
                </button>
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
