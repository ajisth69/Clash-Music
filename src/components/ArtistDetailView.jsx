import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Download, ArrowLeft, Mic2, Music, AlertCircle, UserPlus, UserCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getArtistFullData } from '../services/jiosaavnApi';
import { useAudio } from '../context/AudioContext';
import { useDownload } from '../context/DownloadContext';
import { useLibrary } from '../context/LibraryContext';
import { playPopSfx } from '../services/soundEffects';
import SongCard from './SongCard';

export default function ArtistDetailView({ artistName, onBack }) {
  const { playSong } = useAudio();
  const { startBatchZipDownload } = useDownload();
  const { toggleFollowArtist, isArtistFollowed } = useLibrary();
  
  const [artistInfo, setArtistInfo] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getArtistFullData(artistName).then(data => {
      if (isMounted) {
        setArtistInfo(data.artistInfo);
        setSongs(data.songs);
        setIsLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [artistName]);

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playPopSfx();
      playSong(songs[0], songs, 0);
    }
  };

  const handleDownloadAll = () => {
    if (songs.length === 0) return;
    startBatchZipDownload(`${artistInfo?.name || artistName} Collection`, songs);
  };

  const currentArtistName = artistInfo?.name || artistName;
  const isFollowed = isArtistFollowed(currentArtistName);

  const handleToggleFollow = () => {
    playPopSfx();
    toggleFollowArtist({
      name: currentArtistName,
      image: artistInfo?.image || ''
    });
    if (!isFollowed) {
      confetti({ particleCount: 35, spread: 65, origin: { y: 0.6 } });
    }
  };

  // If no official registered artist profile page is available on JioSaavn
  if (!isLoading && artistInfo && !artistInfo.isVerified) {
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
            No Official Artist Page
          </h3>
          <p className="font-extrabold text-xs text-[var(--text-muted)] leading-relaxed">
            "{artistName}" does not have an officially registered artist profile page on JioSaavn.
          </p>
          <button
            onClick={onBack}
            className="toon-button toon-button-pink px-6 py-2.5 text-xs shadow-[3.5px_3.5px_0px_var(--shadow-color)]"
          >
            RETURN HOME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Back Button */}
      <motion.button
        whileHover={{ scale: 1.05, x: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onBack}
        className="px-4 py-2 rounded-2xl bg-[var(--bg-secondary)] border-3 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] text-[var(--text-primary)] font-black text-xs flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        BACK
      </motion.button>

      {/* Official Verified Artist Hero Banner */}
      <div className="toon-box p-5 sm:p-6 bg-[var(--bg-secondary)] border-2 sm:border-2.5 border-[var(--border-color)] shadow-[4px_4px_0px_var(--shadow-color)] flex flex-col sm:flex-row items-center gap-5 rounded-2xl">
        
        {/* Official Artist Avatar Image */}
        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-3 border-[var(--border-color)] shadow-[4px_4px_0px_var(--shadow-color)] overflow-hidden shrink-0 bg-gradient-to-tr from-amber-400 to-pink-500 flex items-center justify-center">
          {artistInfo?.image ? (
            <img
              src={artistInfo.image}
              alt={artistName}
              className="w-full h-full object-cover"
              onError={() => {
                setArtistInfo(prev => ({ ...prev, image: null }));
              }}
            />
          ) : (
            <Mic2 className="w-12 h-12 text-stone-900 animate-wiggle" strokeWidth={2.5} />
          )}
        </div>

        {/* Artist Info & Buttons */}
        <div className="space-y-2.5 text-[var(--text-primary)] text-center sm:text-left flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] font-black text-[11px] shadow-[1.5px_1.5px_0px_var(--shadow-color)]">
            <Mic2 className="w-3.5 h-3.5 text-pink-500" />
            VERIFIED OFFICIAL ARTIST PAGE
          </div>

          <h2 className="text-2xl sm:text-4xl font-black font-['Grandstander'] text-[var(--text-primary)]">
            {currentArtistName}
          </h2>

          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToggleFollow}
              className={`px-3.5 py-1.5 text-xs rounded-xl font-black border-2 border-black flex items-center gap-1.5 transition-all ${
                isFollowed
                  ? 'bg-emerald-400 text-stone-900 shadow-[2px_2px_0px_#000]'
                  : 'bg-amber-400 text-stone-900 shadow-[2px_2px_0px_#000] hover:bg-amber-300'
              }`}
            >
              {isFollowed ? (
                <>
                  <UserCheck className="w-4 h-4 text-stone-900" strokeWidth={2.5} />
                  <span>FOLLOWING</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-stone-900" strokeWidth={2.5} />
                  <span>FOLLOW ARTIST</span>
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
                  PLAY ALL
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownloadAll}
                  className="toon-button toon-button-secondary px-4 py-1.5 text-xs shadow-[2.5px_2.5px_0px_var(--shadow-color)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  DOWNLOAD (.ZIP)
                </motion.button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Full Artist Song Collection Grid */}
      <div className="space-y-3">
        <h3 className="text-xl font-black text-[var(--text-primary)] font-['Grandstander'] flex items-center gap-2">
          <Music className="w-5 h-5 text-pink-500" />
          Complete Song Collection
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="toon-box p-1.5 space-y-1.5 animate-pulse rounded-lg sm:rounded-xl">
                <div className="aspect-square bg-stone-300 dark:bg-slate-700 rounded-md border border-black" />
                <div className="h-2.5 bg-stone-300 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-2 bg-stone-300 dark:bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} queueList={songs} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
