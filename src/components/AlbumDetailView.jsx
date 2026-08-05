import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Download, ArrowLeft, Disc, Music, AlertCircle, Bookmark, BookmarkCheck, Share2, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getAlbumFullData } from '../services/musicApi';
import { useAudio } from '../context/AudioContext';
import { useDownload } from '../context/DownloadContext';
import { useLibrary } from '../context/LibraryContext';
import { playPopSfx } from '../services/soundEffects';
import { shareItem } from '../services/shareService';
import SongCard, { RenderArtistLinks } from './SongCard';

export default function AlbumDetailView({ albumName, onBack, onSelectArtist }) {
  const { playSong } = useAudio();
  const { startBatchZipDownload } = useDownload();
  const { toggleSaveAlbum, isAlbumSaved } = useLibrary();
  
  const [albumInfo, setAlbumInfo] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getAlbumFullData(albumName).then(data => {
      if (isMounted) {
        setAlbumInfo(data.albumInfo);
        setSongs(data.songs);
        setIsLoading(false);
      }
    }).catch(err => {
      console.warn('Album data fetch failed:', err);
      if (isMounted) setIsLoading(false);
    });

    return () => { isMounted = false; };
  }, [albumName]);

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playPopSfx();
      playSong(songs[0], songs, 0);
    }
  };

  const handleDownloadAll = () => {
    if (songs.length === 0) return;
    startBatchZipDownload(`${albumInfo?.name || albumName} Album`, songs);
  };

  const currentAlbumName = albumInfo?.name || albumName;
  const isSaved = isAlbumSaved(currentAlbumName);

  const handleToggleSave = () => {
    playPopSfx();
    toggleSaveAlbum({
      name: currentAlbumName,
      artist: albumInfo?.artist || '',
      image: albumInfo?.image || ''
    });
    if (!isSaved) {
      confetti({ particleCount: 35, spread: 65, origin: { y: 0.6 } });
    }
  };

  const handleShareAlbum = async () => {
    playPopSfx();
    const currentUrl = `${window.location.origin}/?album=${encodeURIComponent(albumInfo?.name || albumName)}`;
    await shareItem({
      title: albumInfo?.name || albumName,
      text: `Listen to ${albumInfo?.name || albumName} on Clash Music!`,
      url: currentUrl,
    });
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // If no official registered album page is available
  if (!isLoading && albumInfo && !albumInfo.isVerified) {
    return (
      <div className="space-y-6 pb-12 select-none">
        <motion.button
          whileHover={{ scale: 1.05, x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="px-4 py-2 rounded-2xl bg-[var(--bg-secondary)] border-3 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] text-[var(--text-primary)] font-black text-xs flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </motion.button>

        <div className="toon-box p-10 text-center max-w-md mx-auto bg-[var(--bg-secondary)] border-3 border-[var(--border-color)] shadow-[6px_6px_0px_var(--shadow-color)] space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-400 border-3.5 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-stone-900" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-black text-[var(--text-primary)] font-['Grandstander']">
            No Official Album Page
          </h3>
          <p className="font-extrabold text-xs text-[var(--text-muted)] leading-relaxed">
            "{albumName}" does not have an officially registered album release page.
          </p>
          <button
            onClick={onBack}
            className="toon-button toon-button-cyan px-6 py-2.5 text-xs shadow-[3.5px_3.5px_0px_var(--shadow-color)]"
          >
            RETURN HOME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.05, x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="toon-button toon-button-secondary px-3.5 py-1.5 text-xs shadow-[2.5px_2.5px_0px_var(--shadow-color)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </motion.button>
      </div>

      {/* Album Official Hero Banner Card */}
      <div className="toon-box p-4 sm:p-6 bg-[var(--bg-secondary)] border-3.5 sm:border-4 border-[var(--border-color)] shadow-[6px_6px_0px_var(--shadow-color)] flex flex-col sm:flex-row items-center gap-4 sm:gap-6 rounded-2xl sm:rounded-3xl">
        
        <div className="relative w-32 h-32 sm:w-44 sm:h-44 rounded-xl sm:rounded-2xl overflow-hidden border-3 border-black shadow-[4px_4px_0px_#000] shrink-0 bg-stone-900">
          <img
            src={albumInfo?.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'}
            alt={albumInfo?.name || albumName}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
          />
        </div>

        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400 text-stone-900 border-2 border-black font-black text-xs shadow-[1.5px_1.5px_0px_#000]">
            <Disc className="w-3.5 h-3.5" />
            <span>OFFICIAL ALBUM RELEASE</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--text-primary)] font-['Grandstander'] truncate leading-tight">
            {albumInfo?.name || albumName}
          </h1>

          <p className="font-extrabold text-xs sm:text-sm text-pink-600 dark:text-cyan-400">
            By{' '}
            <RenderArtistLinks
              artistStr={albumInfo?.artist}
              onSelectArtist={onSelectArtist}
              className="font-black text-amber-500 dark:text-cyan-300"
            />{' '}
            • {songs.length} Tracks
          </p>

          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToggleSave}
              className={`px-3.5 py-1.5 text-xs rounded-xl font-black border-2 border-black flex items-center gap-1.5 transition-all ${
                isSaved
                  ? 'bg-amber-400 text-stone-900 shadow-[2px_2px_0px_#000]'
                  : 'bg-cyan-400 text-stone-900 shadow-[2px_2px_0px_#000] hover:bg-cyan-300'
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-4 h-4 text-stone-900" strokeWidth={2.5} />
                  <span>SAVED ALBUM</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4 text-stone-900" strokeWidth={2.5} />
                  <span>SAVE ALBUM</span>
                </>
              )}
            </motion.button>

            {/* Share Album Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShareAlbum}
              className={`px-3.5 py-1.5 text-xs rounded-xl font-black border-2 border-black flex items-center gap-1.5 transition-all ${
                copiedShare
                  ? 'bg-emerald-400 text-stone-900 shadow-[2px_2px_0px_#000]'
                  : 'bg-pink-500 text-white shadow-[2px_2px_0px_#000] hover:bg-pink-600'
              }`}
            >
              {copiedShare ? (
                <>
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                  <span>LINK COPIED!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" strokeWidth={2.5} />
                  <span>SHARE ALBUM</span>
                </>
              )}
            </motion.button>

            {songs.length > 0 && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlayAll}
                  className="toon-button px-4 py-1.5 text-xs shadow-[2.5px_2.5px_0px_var(--shadow-color)]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  PLAY FULL ALBUM
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownloadAll}
                  className="toon-button toon-button-cyan px-4 py-1.5 text-xs shadow-[2.5px_2.5px_0px_var(--shadow-color)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  DOWNLOAD (.ZIP)
                </motion.button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Album Track List Grid */}
      <div className="space-y-3">
        <h3 className="text-xl font-black text-[var(--text-primary)] font-['Grandstander'] flex items-center gap-2">
          <Disc className="w-5 h-5 text-amber-500" />
          Album Tracklist
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="toon-box p-1.5 space-y-1.5 animate-pulse rounded-lg sm:rounded-xl">
                <div className="aspect-square bg-stone-300 dark:bg-slate-700 rounded-md border border-black" />
                <div className="h-2.5 bg-stone-300 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-2 bg-stone-300 dark:bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} queueList={songs} onSelectArtist={onSelectArtist} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
