import React, { useState } from 'react';
import { Play, Pause, Heart, Download, Plus, Check, ListMusic, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { downloadSingleSong } from '../services/downloadService';
import { shareItem } from '../services/shareService';

export default function SongCard({ song, queueList = null }) {
  const { currentSong, isPlaying, playSong, togglePlay, addToQueue } = useAudio();
  const { isLiked, toggleLikeSong, playlists, addSongToPlaylist } = useLibrary();

  const [isDownloading, setIsDownloading] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addedPlaylistId, setAddedPlaylistId] = useState(null);
  const [addedToQueue, setAddedToQueue] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  if (!song) return null;

  const isCurrentTrack = currentSong?.id === song.id;
  const liked = isLiked(song.id);

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (isCurrentTrack) {
      togglePlay();
    } else {
      playSong(song, queueList);
    }
  };

  const handleLike = (e) => {
    e.stopPropagation();
    toggleLikeSong(song);
    if (!liked) {
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      await downloadSingleSong(song);
      confetti({
        particleCount: 45,
        spread: 70,
        origin: { y: 0.7 }
      });
    } catch (err) {
      alert('Download failed: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const res = await shareItem({ type: 'song', id: song.id, name: song.name, artist: song.artist });
    if (res.success) {
      setCopiedShare(true);
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
      setTimeout(() => setCopiedShare(false), 1500);
    }
  };

  const handleAddToPlaylist = (playlistId, e) => {
    e.stopPropagation();
    addSongToPlaylist(playlistId, song);
    setAddedPlaylistId(playlistId);
    setTimeout(() => {
      setAddedPlaylistId(null);
      setShowPlaylistMenu(false);
    }, 1200);
  };

  return (
    <div className="toon-box p-1 sm:p-1.5 group relative flex flex-col justify-between hover:border-amber-400 dark:hover:border-pink-500 hover:shadow-[2.5px_2.5px_0px_var(--shadow-color)] transition-shadow duration-200 rounded-lg sm:rounded-xl">
      
      {/* Album Artwork Container */}
      <div className="relative aspect-square w-full rounded-md sm:rounded-lg overflow-hidden border border-[var(--border-color)] bg-stone-900 mb-1 select-none">
        <img
          src={song.image}
          alt={song.name}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
            isCurrentTrack && isPlaying ? 'scale-105 brightness-95' : ''
          }`}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
          }}
        />

        {/* Active Sound Wave Equalizer Badge */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded-full bg-emerald-400 text-stone-900 border border-black font-black text-[8px] shadow-[1px_1px_0px_#000] flex items-center gap-0.5 animate-pulse z-10">
            <div className="flex items-end gap-0.5 h-2">
              <span className="w-0.5 bg-stone-900 rounded-full animate-bar-1" />
              <span className="w-0.5 bg-stone-900 rounded-full animate-bar-2" />
              <span className="w-0.5 bg-stone-900 rounded-full animate-bar-3" />
            </div>
            <span className="hidden sm:inline">PLAYING</span>
          </div>
        )}

        {/* Hover Play Button Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[1.5px]">
          <button
            onClick={handlePlayClick}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-400 dark:bg-pink-500 border-1.5 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center text-stone-900 dark:text-white hover:scale-110 active:scale-95 transition-transform"
          >
            {isCurrentTrack && isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Track Metadata */}
      <div className="space-y-0.2 px-0.5 mb-1 cursor-pointer" onClick={handlePlayClick}>
        <h4 className="font-black text-[10.5px] sm:text-xs text-[var(--text-primary)] truncate leading-tight group-hover:text-pink-500 dark:group-hover:text-cyan-400 transition-colors">
          {song.name}
        </h4>
        <p className="font-extrabold text-[9px] sm:text-[10px] text-[var(--text-muted)] truncate leading-tight">
          {song.artist}
        </p>
      </div>

      {/* Card Action Controls Row */}
      <div className="flex items-center justify-between gap-0.5 pt-0.5 border-t border-[var(--border-color)]/30">
        
        {/* Like Favorite Button */}
        <button
          onClick={handleLike}
          title={liked ? 'Unlike' : 'Like'}
          className={`p-0.5 sm:p-1 rounded-md border border-[var(--border-color)] transition-all shrink-0 ${
            liked
              ? 'bg-rose-500 text-white shadow-[1px_1px_0px_var(--shadow-color)]'
              : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-rose-100 dark:hover:bg-slate-700'
          }`}
        >
          <Heart className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${liked ? 'fill-current' : ''}`} />
        </button>

        {/* Download MP3 Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          title="Download MP3"
          className="p-0.5 sm:p-1 rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-amber-300 dark:hover:bg-pink-500 transition-all disabled:opacity-50 shrink-0"
        >
          <Download className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isDownloading ? 'animate-bounce' : ''}`} />
        </button>

        {/* Share Song Button */}
        <button
          onClick={handleShare}
          title={copiedShare ? 'Link Copied!' : 'Share Song'}
          className={`p-0.5 sm:p-1 rounded-md border border-[var(--border-color)] transition-all shrink-0 ${
            copiedShare
              ? 'bg-emerald-400 text-stone-900 shadow-[1px_1px_0px_var(--shadow-color)]'
              : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-amber-300 dark:hover:bg-pink-500'
          }`}
        >
          {copiedShare ? <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} /> : <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} />}
        </button>

        {/* Add to Queue Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            addToQueue(song);
            setAddedToQueue(true);
            setTimeout(() => setAddedToQueue(false), 1200);
          }}
          title={addedToQueue ? 'Added!' : 'Add to Queue'}
          className={`p-0.5 sm:p-1 rounded-md border border-[var(--border-color)] transition-all shrink-0 ${
            addedToQueue
              ? 'bg-cyan-400 text-stone-900 shadow-[1px_1px_0px_var(--shadow-color)]'
              : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-cyan-300 dark:hover:bg-cyan-500/30'
          }`}
        >
          {addedToQueue ? (
            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} />
          ) : (
            <ListMusic className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} />
          )}
        </button>

        {/* Add to Playlist Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPlaylistMenu(prev => !prev);
            }}
            title="Add to Playlist"
            className="p-0.5 sm:p-1 rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-amber-300 dark:hover:bg-pink-500 transition-all"
          >
            <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} />
          </button>

          {/* Playlist Selector Dropdown */}
          {showPlaylistMenu && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 bottom-full mb-1 w-40 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] rounded-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              <p className="text-[9px] font-black text-[var(--text-muted)] px-1 py-0.5 uppercase tracking-wider">
                Add to Playlist
              </p>
              <div className="max-h-28 overflow-y-auto space-y-0.5 mt-0.5">
                {playlists.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-muted)] px-1 py-0.5 font-bold">No playlists</p>
                ) : (
                  playlists.map(pl => (
                    <button
                      key={pl.id}
                      onClick={(e) => handleAddToPlaylist(pl.id, e)}
                      className="w-full text-left px-1 py-0.5 rounded-md hover:bg-amber-300 dark:hover:bg-pink-500 text-[11px] font-bold text-[var(--text-primary)] flex items-center justify-between truncate"
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

      </div>

    </div>
  );
}
