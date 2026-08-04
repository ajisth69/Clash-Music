import React, { useState, useEffect } from 'react';
import { History, Mic2, Disc, Music, Flame } from 'lucide-react';
import { searchArtists, searchAlbums, normalizeArtistKey } from '../services/jiosaavnApi';
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
  const [verifiedArtists, setVerifiedArtists] = useState([]);
  const [verifiedAlbums, setVerifiedAlbums] = useState([]);

  // 1. Process Artists & Fetch ONLY Verified Artist Profiles with Official Headshots (/artists/)
  useEffect(() => {
    if (history.length === 0) {
      setVerifiedArtists([]);
      return;
    }

    let isMounted = true;

    // Calculate play counts for all individual split artists
    const artistMap = new Map();
    history.forEach(song => {
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
            listenCount: songPlays
          });
        }
      });
    });

    const candidates = Array.from(artistMap.values())
      .sort((a, b) => b.listenCount - a.listenCount);

    // Verify each artist profile on JioSaavn - Keep ONLY artists with real official headshots (/artists/)
    const verifyPromises = candidates.map(async (artist) => {
      try {
        const normKey = normalizeArtistKey(artist.name);
        const results = await searchArtists(artist.name);

        if (Array.isArray(results) && results.length > 0) {
          const exact = results.find(r => {
            const resKey = normalizeArtistKey(r.name);
            const hasOfficialHeadshot = r.image && r.image.includes('/artists/');
            return resKey === normKey && hasOfficialHeadshot;
          });

          if (exact) {
            return {
              name: exact.name,
              image: exact.image,
              listenCount: artist.listenCount
            };
          }
        }
      } catch (err) {}
      return null;
    });

    Promise.all(verifyPromises).then(results => {
      if (isMounted) {
        const validOnly = results.filter(Boolean).slice(0, 15);
        setVerifiedArtists(validOnly);
      }
    });

    return () => { isMounted = false; };
  }, [history, playCounts]);

  // 2. Process & Verify ONLY Registered Albums on JioSaavn
  useEffect(() => {
    if (history.length === 0) {
      setVerifiedAlbums([]);
      return;
    }

    let isMounted = true;

    const albumMap = new Map();
    history.forEach(song => {
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

    const candidates = Array.from(albumMap.values())
      .sort((a, b) => b.listenCount - a.listenCount);

    // Verify candidate albums against JioSaavn API
    const verifyPromises = candidates.map(async (album) => {
      try {
        const results = await searchAlbums(album.name);
        if (Array.isArray(results) && results.length > 0) {
          const normCandidate = album.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const exactMatch = results.find(r => {
            const resKey = r.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            return resKey === normCandidate || (resKey.length > 3 && normCandidate.includes(resKey));
          });

          if (exactMatch && exactMatch.image) {
            return {
              name: exactMatch.name,
              artist: exactMatch.artist || album.artist,
              image: exactMatch.image || album.image,
              listenCount: album.listenCount
            };
          }
        }
      } catch (err) {}
      return null;
    });

    Promise.all(verifyPromises).then(results => {
      if (isMounted) {
        const validOnly = results.filter(Boolean).slice(0, 10);
        setVerifiedAlbums(validOnly);
      }
    });

    return () => { isMounted = false; };
  }, [history, playCounts]);

  // 3. Calculate Most Listened Songs
  const songMap = new Map();
  history.forEach(song => {
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
  const recentSongs = history.slice(0, 12);

  if (history.length === 0) {
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
    <div className="space-y-5 pb-8 select-none">
      
      {/* 1. TOP LISTENED ARTISTS */}
      {verifiedArtists.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-pink-400 border-1.5 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <Mic2 className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Top Listened Artists
            </h3>
          </div>

          <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-2.5">
            {verifiedArtists.map((artist, idx) => (
              <div
                key={`artist-${idx}-${artist.name}`}
                onClick={() => onSelectArtist(artist.name)}
                className="toon-box p-1.5 text-center cursor-pointer group hover:border-emerald-400 hover:shadow-[2px_2px_0px_var(--shadow-color)] transition-shadow duration-200 bg-[var(--bg-secondary)] relative overflow-hidden rounded-lg"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full overflow-hidden border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] mb-1 bg-amber-300 dark:bg-pink-500 group-hover:scale-105 transition-transform flex items-center justify-center">
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
                  />
                </div>

                <h4 className="font-extrabold text-[10.5px] sm:text-xs text-[var(--text-primary)] truncate mt-0.2">
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
            <div className="p-1 rounded-lg bg-cyan-400 border-1.5 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <History className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Recently Played Songs
            </h3>
          </div>

          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
            {recentSongs.map((song) => (
              <SongCard key={`recent-${song.id}`} song={song} queueList={history} />
            ))}
          </div>
        </section>
      )}

      {/* 3. MOST LISTENED SONGS */}
      {topSongs.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-amber-400 border-1.5 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <Flame className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Most Listened Songs
            </h3>
          </div>

          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
            {topSongs.map((song) => (
              <SongCard key={`top-${song.id}`} song={song} queueList={topSongs} />
            ))}
          </div>
        </section>
      )}

      {/* 4. TOP LISTENED ALBUMS */}
      {verifiedAlbums.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-emerald-400 border-1.5 border-[var(--border-color)] shadow-[1px_1px_0px_var(--shadow-color)]">
              <Disc className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
              Top Listened Albums
            </h3>
          </div>

          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
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
