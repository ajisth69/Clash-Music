import React, { useState, useEffect } from 'react';
import { Search, Disc, Mic2, Music, Sparkles } from 'lucide-react';
import { searchSongs, searchAlbums, searchArtists } from '../services/jiosaavnApi';
import SongCard from './SongCard';

export default function SearchView({ query, setQuery, onSelectAlbum, onSelectArtist }) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'songs' | 'albums' | 'artists'
  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || !query.trim()) return;

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [songRes, albumRes, artistRes] = await Promise.all([
          searchSongs(query, 1, 18),
          searchAlbums(query),
          searchArtists(query)
        ]);

        if (isMounted) {
          setSongs(songRes || []);
          setAlbums(albumRes || []);
          setArtists(artistRes || []);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Search execution error:', err);
        if (isMounted) setIsLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
  }, [query]);

  return (
    <div className="space-y-5 pb-8">
      
      {/* Mobile Search Input Bar (< md) */}
      <div className="relative md:hidden">
        <input
          type="text"
          placeholder="Search songs, artists, albums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] shadow-[2.5px_2.5px_0px_var(--shadow-color)] text-[var(--text-primary)] font-bold text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-0"
        />
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2.5} />
      </div>

      {/* Header & Bubbly Filter Chips */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <Search className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" strokeWidth={2.5} />
            Results for <span className="text-pink-500 underline decoration-wavy">"{query || 'Music'}"</span>
          </h2>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All', icon: Sparkles, color: 'bg-amber-400' },
              { id: 'songs', label: 'Songs', icon: Music, color: 'bg-pink-400' },
              { id: 'albums', label: 'Albums', icon: Disc, color: 'bg-cyan-400' },
              { id: 'artists', label: 'Artists', icon: Mic2, color: 'bg-emerald-400' },
            ].map((chip) => {
              const Icon = chip.icon;
              const isSelected = activeFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id)}
                  className={`px-3 py-1 rounded-xl border-2 border-[var(--border-color)] font-extrabold text-xs flex items-center gap-1 transition-all ${
                    isSelected
                      ? `${chip.color} text-stone-900 shadow-[2px_2px_0px_var(--shadow-color)] scale-105`
                      : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 sm:gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="toon-box p-2 space-y-2 animate-pulse rounded-xl">
              <div className="aspect-square bg-stone-300 dark:bg-slate-700 rounded-lg border border-black" />
              <div className="h-3 bg-stone-300 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-2 bg-stone-300 dark:bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Songs Grid */}
          {(activeFilter === 'all' || activeFilter === 'songs') && songs.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                <Music className="w-4.5 h-4.5 text-pink-500" strokeWidth={2.5} />
                Songs ({songs.length})
              </h3>
              <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
                {songs.map((song) => (
                  <SongCard key={song.id} song={song} queueList={songs} />
                ))}
              </div>
            </section>
          )}

          {/* Albums Grid */}
          {(activeFilter === 'all' || activeFilter === 'albums') && albums.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                <Disc className="w-4.5 h-4.5 text-cyan-500" strokeWidth={2.5} />
                Albums ({albums.length})
              </h3>
              <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => onSelectAlbum(album.name)}
                    className="toon-box p-1.5 sm:p-2 cursor-pointer group hover:-translate-y-0.5 hover:shadow-[2.5px_2.5px_0px_var(--shadow-color)] transition-all bg-[var(--bg-secondary)] rounded-lg sm:rounded-xl flex flex-col justify-between"
                  >
                    <div className="aspect-square w-full rounded-md overflow-hidden border border-black shadow-[1.5px_1.5px_0px_#000] mb-1 bg-stone-200 dark:bg-slate-800 shrink-0">
                      <img
                        src={album.image}
                        alt={album.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
                      />
                    </div>
                    <div className="space-y-0.2">
                      <h4 className="font-extrabold text-[10.5px] sm:text-xs text-[var(--text-primary)] truncate leading-tight">
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

          {/* Artists Grid */}
          {(activeFilter === 'all' || activeFilter === 'artists') && artists.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                <Mic2 className="w-4.5 h-4.5 text-emerald-500" strokeWidth={2.5} />
                Artists ({artists.length})
              </h3>
              <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-2.5">
                {artists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => onSelectArtist(artist.name)}
                    className="toon-box p-1.5 text-center cursor-pointer group hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_var(--shadow-color)] transition-all bg-[var(--bg-secondary)] rounded-lg"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full overflow-hidden border border-black shadow-[1.5px_1.5px_0px_#000] mb-1 bg-amber-300 dark:bg-pink-500 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
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

          {/* Empty State */}
          {!isLoading && songs.length === 0 && albums.length === 0 && artists.length === 0 && (
            <div className="toon-box p-12 text-center space-y-4 max-w-md mx-auto my-8 bg-amber-100 dark:bg-slate-800">
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-400 border-3 border-black flex items-center justify-center shadow-[3px_3px_0px_#000]">
                <Search className="w-10 h-10 text-stone-900 animate-wiggle" />
              </div>
              <h3 className="text-2xl font-black text-stone-900 dark:text-white">No toon tunes found!</h3>
              <p className="font-bold text-sm text-[var(--text-muted)]">
                Try searching for a different song name, artist like "Arijit Singh", or album title!
              </p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
