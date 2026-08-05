import React, { useState, useEffect, useMemo } from 'react';
import { History, Mic2, Disc, Music, Flame } from 'lucide-react';
import { searchArtists, searchAlbums, normalizeArtistKey } from '../services/musicApi';
import { useLibrary } from '../context/LibraryContext';
import SongCard from './SongCard';

// Helper function to split multi-artist strings cleanly into individual artists
function splitArtistNames(artistStr) {
  if (!artistStr) return [];
  return artistStr
    .split(/[,&\/]|(?:\s+[xX]\s+)|(?:\s+ft\.?\s+)|(?:\s+feat\.?\s+)/gi)
    .map(a => a.trim())
    .filter(a => a.length > 0 && a.toLowerCase() !== 'various artists');
}

export default function HomeView({ onSelectArtist, onSelectAlbum }) {
  const { history, playCounts } = useLibrary();
  
  // Filter out all local songs from Home Feed (Strict Isolation)
  const onlineHistory = useMemo(() => {
    return history.filter((song) => {
      if (!song) return false;
      if (song.isLocal) return false;
      if (typeof song.id === 'string' && song.id.startsWith('local_')) return false;
      if (typeof song.url === 'string' && song.url.startsWith('blob:')) return false;
      if (typeof song.streamUrl === 'string' && song.streamUrl.startsWith('blob:')) return false;
      if (song.fileBlob || song.folderName) return false;
      return true;
    });
  }, [history]);

  // Synchronous 0ms Instant Initial Compute for Top Artists
  // Synchronous 0ms Instant Initial Compute for Top Artists
  const initialArtists = useMemo(() => {
    if (onlineHistory.length === 0) return [];
    const artistMap = new Map();
    onlineHistory.forEach(song => {
      const songPlays = playCounts[song.id] || 1;
      const individualArtists = splitArtistNames(song.artist);
      individualArtists.forEach(artistName => {
        const normKey = normalizeArtistKey(artistName);
        if (!normKey) return;
        const existing = artistMap.get(normKey);
        if (existing) {
          existing.listenCount += songPlays;
        } else {
          artistMap.set(normKey, {
            name: artistName,
            image: null, // Clean Mic icon default (no song artwork placeholder)
            listenCount: songPlays
          });
        }
      });
    });
    return Array.from(artistMap.values())
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 15);
  }, [onlineHistory, playCounts]);

  // Synchronous 0ms Instant Initial Compute for Top Albums
  const initialAlbums = useMemo(() => {
    if (onlineHistory.length === 0) return [];
    const albumMap = new Map();
    onlineHistory.forEach(song => {
      if (!song.album || song.album === 'Single' || song.album === 'Untitled Album') return;
      const songPlays = playCounts[song.id] || 1;
      const key = song.album.toLowerCase().trim();
      const existing = albumMap.get(key);
      if (existing) {
        existing.listenCount += songPlays;
      } else {
        albumMap.set(key, {
          name: song.album,
          artist: song.artist,
          image: song.image || '',
          listenCount: songPlays
        });
      }
    });
    return Array.from(albumMap.values())
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 10);
  }, [onlineHistory, playCounts]);

  const [verifiedArtists, setVerifiedArtists] = useState(initialArtists);
  const [verifiedAlbums, setVerifiedAlbums] = useState(initialAlbums);

  // Sync state initially when history changes
  useEffect(() => {
    setVerifiedArtists(initialArtists);
  }, [initialArtists]);

  useEffect(() => {
    setVerifiedAlbums(initialAlbums);
  }, [initialAlbums]);

  // Enrich artist headshots with ONLY OFFICIAL artist profile pictures from Music API
  useEffect(() => {
    if (initialArtists.length === 0) return;
    let isMounted = true;

    const enrichPromises = initialArtists.map(async (artist) => {
      try {
        const normKey = normalizeArtistKey(artist.name);
        const results = await searchArtists(artist.name);
        if (Array.isArray(results) && results.length > 0) {
          const exact = results.find(r => {
            const resKey = normalizeArtistKey(r.name);
            return resKey === normKey || resKey.includes(normKey) || normKey.includes(resKey);
          }) || results[0];

          if (exact && exact.image && exact.image.length > 5 && !exact.image.includes('unsplash')) {
            return {
              ...artist,
              image: exact.image // Official artist profile headshot picture
            };
          }
        }
      } catch (err) {}
      return { ...artist, image: null }; // Keep clean mic icon default
    });

    Promise.all(enrichPromises).then((enriched) => {
      if (isMounted) {
        setVerifiedArtists(enriched);
      }
    });

    return () => { isMounted = false; };
  }, [initialArtists]);

  // 3. Calculate Most Listened Songs
  const songMap = new Map();
  onlineHistory.forEach(song => {
    const songPlays = playCounts[song.id] || 1;
    if (!songMap.has(song.id)) {
      songMap.set(song.id, {
        song,
        listenCount: songPlays
      });
    }
  });

  const topSongs = Array.from(songMap.values())
    .sort((a, b) => b.listenCount - a.listenCount)
    .map(item => item.song)
    .slice(0, 20);

  // 4. Recent Songs
  const recentSongs = onlineHistory.slice(0, 12);

  if (onlineHistory.length === 0) {
    return (
      <div className="toon-box p-12 text-center max-w-lg mx-auto my-12 bg-amber-100 dark:bg-slate-800 space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-amber-400 border-3 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center">
          <Music className="w-10 h-10 text-stone-900 animate-bounce-slow" strokeWidth={2.5} />
        </div>
        <h3 className="text-3xl font-black text-[var(--text-primary)] font-['Grandstander']">Welcome to your Personal Feed!</h3>
        <p className="font-bold text-sm text-[var(--text-muted)] leading-relaxed">
          Search and play your favorite songs to start populating your top listened artists, top albums, top songs, and recent playback history!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-mobile-safe select-none">
      
      {/* 1. TOP LISTENED ARTISTS */}
      {verifiedArtists.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-pink-400 border-2 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <Mic2 className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Top Listened Artists
            </h3>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-2.5">
            {verifiedArtists.map((artist, idx) => (
              <div
                key={`artist-${idx}-${artist.name}`}
                onClick={() => onSelectArtist(artist.name)}
                className="toon-box p-2 text-center cursor-pointer group hover:border-emerald-400 hover:shadow-[2px_2px_0px_var(--shadow-color)] transition-shadow duration-200 bg-[var(--bg-secondary)] relative overflow-hidden rounded-xl flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full overflow-hidden border-2 border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] mb-1.5 bg-amber-300 dark:bg-pink-500 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
                  {artist.image ? (
                    <img
                      src={artist.image}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setVerifiedArtists(prev => prev.map(a => a.name === artist.name ? { ...a, image: null } : a));
                      }}
                    />
                  ) : (
                    <Mic2 className="w-6 h-6 text-stone-900 dark:text-white" strokeWidth={2.5} />
                  )}
                </div>

                <h4 className="font-extrabold text-[11px] sm:text-xs text-[var(--text-primary)] truncate w-full leading-tight">
                  {artist.name}
                </h4>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. RECENTLY PLAYED SONGS */}
      {recentSongs.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-cyan-400 border-2 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <History className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Recently Played Songs
            </h3>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
            {recentSongs.map((song) => (
              <SongCard key={`recent-${song.id}`} song={song} queueList={history} onSelectArtist={onSelectArtist} />
            ))}
          </div>
        </section>
      )}

      {/* 3. MOST LISTENED SONGS */}
      {topSongs.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-amber-400 border-2 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <Flame className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Most Listened Songs
            </h3>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
            {topSongs.map((song) => (
              <SongCard key={`top-${song.id}`} song={song} queueList={topSongs} onSelectArtist={onSelectArtist} />
            ))}
          </div>
        </section>
      )}

      {/* 4. TOP LISTENED ALBUMS */}
      {verifiedAlbums.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-emerald-400 border-2 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <Disc className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Top Listened Albums
            </h3>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
            {verifiedAlbums.map((album, idx) => (
              <div
                key={`album-${idx}-${album.name}`}
                onClick={() => onSelectAlbum(album.name)}
                className="toon-box p-1.5 sm:p-2 cursor-pointer group hover:border-emerald-400 hover:shadow-[2.5px_2.5px_0px_var(--shadow-color)] transition-shadow duration-200 bg-[var(--bg-secondary)] relative overflow-hidden rounded-lg sm:rounded-xl flex flex-col justify-between"
              >
                <div className="aspect-square w-full rounded-md overflow-hidden border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] mb-1 bg-stone-900 shrink-0">
                  <img
                    src={album.image}
                    alt={album.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
                  />
                </div>
                <div className="space-y-0.2">
                  <h4 className="font-extrabold text-[10.5px] sm:text-xs text-[var(--text-primary)] truncate group-hover:text-emerald-500 transition-colors leading-tight">
                    {album.name}
                  </h4>
                  <p className="font-bold text-[9px] sm:text-[10px] text-[var(--text-muted)] truncate leading-tight">
                    {album.artist}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
