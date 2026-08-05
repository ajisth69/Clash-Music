import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ListMusic, History, Plus, Download, Trash2, Play, Sparkles, Mic2, UserCheck, Disc, BookmarkCheck, Share2, Loader2, Check } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { useAudio } from '../context/AudioContext';
import { useDownload } from '../context/DownloadContext';
import { playPopSfx, playLikeSfx } from '../services/soundEffects';
import { shareItem } from '../services/shareService';
import SongCard from './SongCard';
import FileImportModal from './FileImportModal';

export default function LibraryView({ onSelectArtist, onSelectAlbum, initialPlaylistId }) {
  const { likedSongs, followedArtists, toggleFollowArtist, savedAlbums, toggleSaveAlbum, playlists, createPlaylist, deletePlaylist, removeSongFromPlaylist, history } = useLibrary();
  const { playSong } = useAudio();
  const { startBatchZipDownload } = useDownload();

  const [activeTab, setActiveTab] = useState('liked'); // 'liked' | 'artists' | 'albums' | 'playlists' | 'history'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId) || null;

  // React to Deep-Linked Playlists
  React.useEffect(() => {
    if (initialPlaylistId) {
      setActiveTab('playlists');
      setSelectedPlaylistId(initialPlaylistId);
    }
  }, [initialPlaylistId]);

  // New Playlist Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const [newPlDesc, setNewPlDesc] = useState('');

  // File Import State
  const [showFileImportModal, setShowFileImportModal] = useState(false);

  // Share Playlist State
  const [isSharingPl, setIsSharingPl] = useState(false);
  const [sharedPlId, setSharedPlId] = useState(null);

  const handleSharePlaylist = async (playlist) => {
    if (isSharingPl || playlist.tracks.length === 0) return;
    setIsSharingPl(true);
    try {
      const res = await shareItem({ type: 'playlist', id: playlist.id, name: playlist.name, description: playlist.description, tracks: playlist.tracks });
      if (res.success) {
        setSharedPlId(playlist.id);
        setTimeout(() => setSharedPlId(null), 2000);
      }
    } catch (err) {
      alert('Failed to share playlist: ' + err.message);
    } finally {
      setIsSharingPl(false);
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newPlName.trim()) return;
    playLikeSfx();
    const pl = createPlaylist(newPlName, newPlDesc);
    setNewPlName('');
    setNewPlDesc('');
    setShowCreateModal(false);
    setSelectedPlaylistId(pl.id);
    setActiveTab('playlists');
  };

  const handleDownloadBatch = (title, tracks) => {
    if (!tracks || tracks.length === 0) return;
    startBatchZipDownload(title, tracks);
  };

  return (
    <div className="space-y-5 pb-mobile-safe select-none">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2 font-['Grandstander']">
          <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-rose-500 fill-current" strokeWidth={2.5} />
          Your Library
        </h2>

        {/* Tab Buttons - Horizontal Scrollable Container on Mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none max-w-full -mx-1 px-1 flex-nowrap">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playPopSfx(); setActiveTab('liked'); setSelectedPlaylistId(null); }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
              activeTab === 'liked'
                ? 'bg-rose-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-rose-100 dark:hover:bg-slate-700'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>Liked ({likedSongs.length})</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playPopSfx(); setActiveTab('artists'); setSelectedPlaylistId(null); }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
              activeTab === 'artists'
                ? 'bg-emerald-400 text-stone-900 shadow-[2px_2px_0px_var(--shadow-color)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-emerald-100 dark:hover:bg-slate-700'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5 shrink-0" />
            <span>Artists ({followedArtists.length})</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playPopSfx(); setActiveTab('albums'); setSelectedPlaylistId(null); }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
              activeTab === 'albums'
                ? 'bg-purple-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-purple-100 dark:hover:bg-slate-700'
            }`}
          >
            <Disc className="w-3.5 h-3.5 shrink-0" />
            <span>Albums ({savedAlbums.length})</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playPopSfx(); setActiveTab('playlists'); }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
              activeTab === 'playlists'
                ? 'bg-amber-400 text-stone-900 shadow-[2px_2px_0px_var(--shadow-color)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-amber-100 dark:hover:bg-slate-700'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5 shrink-0" />
            <span>Playlists ({playlists.length})</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playPopSfx(); setActiveTab('history'); setSelectedPlaylistId(null); }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[36px] ${
              activeTab === 'history'
                ? 'bg-cyan-400 text-stone-900 shadow-[2px_2px_0px_var(--shadow-color)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-cyan-100 dark:hover:bg-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>History ({history.length})</span>
          </motion.button>
        </div>
      </div>

      {/* LIKED SONGS TAB */}
      {activeTab === 'liked' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-xs sm:text-sm text-[var(--text-muted)]">
              All your favorite tracks saved in one place.
            </p>
            {likedSongs.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleDownloadBatch('Liked Songs', likedSongs)}
                className="toon-button toon-button-pink px-2.5 py-1 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                DOWNLOAD ALL (.ZIP)
              </motion.button>
            )}
          </div>

          {likedSongs.length === 0 ? (
            <div className="toon-box p-6 text-center max-w-md mx-auto my-4 bg-amber-100 dark:bg-slate-800 space-y-2 rounded-2xl">
              <Heart className="w-8 h-8 mx-auto text-rose-400 animate-wiggle" strokeWidth={2.5} />
              <h3 className="text-lg font-black text-[var(--text-primary)] font-['Grandstander']">No Liked Songs Yet!</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">
                Click the heart icon on any song card to save it here for offline access!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
              {likedSongs.map((song) => (
                <SongCard key={song.id} song={song} queueList={likedSongs} onSelectArtist={onSelectArtist} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOLLOWED ARTISTS TAB */}
      {activeTab === 'artists' && (
        <div className="space-y-3">
          <p className="font-bold text-xs sm:text-sm text-[var(--text-muted)]">
            Artists you follow. Click any artist profile to open their full song collection.
          </p>

          {followedArtists.length === 0 ? (
            <div className="toon-box p-6 text-center max-w-md mx-auto my-4 bg-amber-100 dark:bg-slate-800 space-y-2 rounded-2xl">
              <Mic2 className="w-8 h-8 mx-auto text-emerald-500 animate-wiggle" strokeWidth={2.5} />
              <h3 className="text-lg font-black text-[var(--text-primary)] font-['Grandstander']">No Followed Artists Yet</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">
                Click "FOLLOW ARTIST" on any artist profile to bookmark them here for quick access!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-2.5">
              {followedArtists.map((artist, idx) => (
                <div
                  key={`followed-art-${idx}-${artist.name}`}
                  onClick={() => onSelectArtist && onSelectArtist(artist.name)}
                  className="toon-box p-2 text-center cursor-pointer group hover:-translate-y-0.5 hover:shadow-[2.5px_2.5px_0px_var(--shadow-color)] transition-all bg-[var(--bg-secondary)] relative overflow-hidden rounded-lg flex flex-col items-center justify-between"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full overflow-hidden border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] mb-0.5 bg-amber-300 dark:bg-pink-500 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
                    {artist.image ? (
                      <img
                        src={artist.image}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
                      />
                    ) : (
                      <Mic2 className="w-5 h-5 text-stone-900" />
                    )}
                  </div>

                  <h4 className="font-extrabold text-[10.5px] sm:text-xs text-[var(--text-primary)] truncate w-full mt-0.5">
                    {artist.name}
                  </h4>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPopSfx();
                      toggleFollowArtist(artist);
                    }}
                    title="Click to unfollow artist"
                    className="mt-1 px-1.5 py-0.2 rounded-full bg-emerald-400 text-stone-900 border border-black text-[8.5px] font-black hover:bg-rose-500 hover:text-white transition-colors flex items-center gap-0.5"
                  >
                    <UserCheck className="w-2.5 h-2.5" />
                    <span>FOLLOWING</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SAVED ALBUMS TAB */}
      {activeTab === 'albums' && (
        <div className="space-y-3">
          <p className="font-bold text-xs sm:text-sm text-[var(--text-muted)]">
            Albums you have saved. Click any album to view its complete tracklist.
          </p>

          {savedAlbums.length === 0 ? (
            <div className="toon-box p-6 text-center max-w-md mx-auto my-4 bg-amber-100 dark:bg-slate-800 space-y-2 rounded-2xl">
              <Disc className="w-8 h-8 mx-auto text-purple-500 animate-spin-slow" strokeWidth={2.5} />
              <h3 className="text-lg font-black text-[var(--text-primary)] font-['Grandstander']">No Saved Albums Yet</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">
                Click "SAVE ALBUM" on any album profile page to bookmark it here!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
              {savedAlbums.map((album, idx) => (
                <div
                  key={`saved-alb-${idx}-${album.name}`}
                  onClick={() => onSelectAlbum && onSelectAlbum(album.name)}
                  className="toon-box p-1.5 sm:p-2 cursor-pointer group hover:-translate-y-0.5 hover:shadow-[2.5px_2.5px_0px_var(--shadow-color)] transition-all bg-[var(--bg-secondary)] relative overflow-hidden rounded-lg sm:rounded-xl flex flex-col justify-between"
                >
                  <div className="aspect-square w-full rounded-md overflow-hidden border border-[var(--border-color)] shadow-[1.5px_1.5px_0px_var(--shadow-color)] mb-1 bg-stone-900 shrink-0">
                    <img
                      src={album.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'}
                      alt={album.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'; }}
                    />
                  </div>

                  <div className="space-y-0.2 mb-0.5">
                    <h4 className="font-extrabold text-[10.5px] sm:text-xs text-[var(--text-primary)] truncate group-hover:text-purple-500 transition-colors leading-tight">
                      {album.name}
                    </h4>
                    <p className="font-bold text-[9px] sm:text-[10px] text-[var(--text-muted)] truncate leading-tight">
                      {album.artist || 'Various Artists'}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPopSfx();
                      toggleSaveAlbum(album);
                    }}
                    title="Click to remove saved album"
                    className="mt-1 w-full py-0.5 rounded-md bg-purple-500 text-white border border-black text-[8.5px] font-black hover:bg-rose-500 transition-colors flex items-center justify-center gap-0.5"
                  >
                    <BookmarkCheck className="w-2.5 h-2.5" />
                    <span>SAVED</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CUSTOM PLAYLISTS TAB */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="font-bold text-xs sm:text-sm text-[var(--text-muted)]">
              Create and manage your custom playlists.
            </p>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { playPopSfx(); setShowFileImportModal(true); }}
                className="toon-button toon-button-purple px-3 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                UPLOAD FILE
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { playPopSfx(); setShowCreateModal(true); }}
                className="toon-button toon-button-cyan px-3 py-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                NEW PLAYLIST
              </motion.button>
            </div>
          </div>

          {selectedPlaylist ? (
            <div className="space-y-4">
              <div 
                className="toon-box p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl"
                style={{ backgroundColor: selectedPlaylist.color || '#FFD166' }}
              >
                <div className="space-y-0.5 text-stone-900 text-center sm:text-left">
                  <span className="px-2 py-0.5 rounded-full bg-white border border-black text-[10px] font-black">
                    CUSTOM MIX
                  </span>
                  <h3 className="text-2xl font-black font-['Grandstander']">{selectedPlaylist.name}</h3>
                  <p className="font-bold text-xs opacity-80">{selectedPlaylist.description || 'No description'}</p>
                  <p className="font-extrabold text-xs pt-0.5">{selectedPlaylist.tracks.length} Tracks</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedPlaylist.tracks.length > 0 && (
                    <>
                      <button
                        onClick={() => playSong(selectedPlaylist.tracks[0], selectedPlaylist.tracks, 0)}
                        className="toon-button bg-white text-stone-900 px-3 py-1.5 text-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        PLAY ALL
                      </button>

                      <button
                        onClick={() => handleDownloadBatch(selectedPlaylist.name, selectedPlaylist.tracks)}
                        className="toon-button toon-button-purple px-3 py-1.5 text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        ZIP
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleSharePlaylist(selectedPlaylist)}
                    disabled={isSharingPl || selectedPlaylist.tracks.length === 0}
                    className="p-2 rounded-xl bg-amber-400 text-stone-900 border border-black shadow-[2px_2px_0px_#000] hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                    title={sharedPlId === selectedPlaylist.id ? 'Copied!' : 'Share Playlist'}
                  >
                    {isSharingPl ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : sharedPlId === selectedPlaylist.id ? (
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      deletePlaylist(selectedPlaylist.id);
                      setSelectedPlaylistId(null);
                    }}
                    className="p-2 rounded-xl bg-rose-500 text-white border border-black shadow-[2px_2px_0px_#000] hover:scale-105 active:scale-95"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSelectedPlaylistId(null)}
                    className="px-3 py-1.5 rounded-xl bg-stone-900 text-white font-black text-xs border border-black"
                  >
                    BACK
                  </button>
                </div>
              </div>

              {selectedPlaylist.tracks.length === 0 ? (
                <div className="toon-box p-6 text-center max-w-md mx-auto my-4 bg-white dark:bg-slate-800 rounded-2xl">
                  <ListMusic className="w-10 h-10 mx-auto text-amber-500 mb-1.5" />
                  <p className="font-bold text-xs text-[var(--text-muted)]">
                    This playlist is currently empty! Add tracks using the (+) button on any song card.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 sm:gap-3">

                  {selectedPlaylist.tracks.map((song) => (
                    <div key={song.id} className="relative group">
                      <SongCard song={song} queueList={selectedPlaylist.tracks} onSelectArtist={onSelectArtist} />
                      <button
                        onClick={() => removeSongFromPlaylist(selectedPlaylist.id, song.id)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-500 text-white border border-black shadow-[1.5px_1.5px_0px_#000] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Remove track"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {playlists.map((pl) => (
                <motion.div
                  key={pl.id}
                  whileHover={{ y: -2, scale: 1.01 }}
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  className="toon-box p-3.5 cursor-pointer group hover:shadow-[4px_4px_0px_var(--shadow-color)] transition-all flex items-center justify-between rounded-2xl"
                  style={{ backgroundColor: pl.color || '#FFD166' }}
                >
                  <div className="space-y-0.5 text-stone-900">
                    <h4 className="font-black text-lg font-['Grandstander'] group-hover:underline decoration-wavy">
                      {pl.name}
                    </h4>
                    <p className="font-extrabold text-xs opacity-80">
                      {pl.tracks.length} Tracks
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-stone-900 group-hover:rotate-12 transition-transform">
                    <ListMusic className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LISTENING HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <p className="font-bold text-xs sm:text-sm text-[var(--text-muted)]">
            Tracks you have played during this session.
          </p>

          {history.length === 0 ? (
            <div className="toon-box p-8 text-center max-w-md mx-auto my-6 bg-amber-100 dark:bg-slate-800 space-y-2.5 rounded-2xl">
              <History className="w-10 h-10 mx-auto text-cyan-500 animate-spin-slow" strokeWidth={2.5} />
              <h3 className="text-xl font-black text-[var(--text-primary)] font-['Grandstander']">No History Yet</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">
                Start playing songs to see your playback history automatically populate here!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 sm:gap-3">

              {history.map((song) => (
                <SongCard key={`hist-page-${song.id}`} song={song} queueList={history} onSelectArtist={onSelectArtist} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="toon-box p-6 bg-[var(--bg-secondary)] max-w-md w-full space-y-4"
          >
            <h3 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2 font-['Grandstander']">
              <Sparkles className="w-6 h-6 text-amber-400" />
              Create New Playlist
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-1">
                  Playlist Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Midnight Party Grooves"
                  value={newPlName}
                  onChange={(e) => setNewPlName(e.target.value)}
                  className="toon-input w-full"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Cool vibes for long drives..."
                  value={newPlDesc}
                  onChange={(e) => setNewPlDesc(e.target.value)}
                  className="toon-input w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-2xl border-2 border-[var(--border-color)] font-bold text-xs"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="toon-button toon-button-pink px-5 py-2 text-xs"
                >
                  CREATE MIX
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* File Import Modal */}
      <FileImportModal 
        isOpen={showFileImportModal} 
        onClose={() => setShowFileImportModal(false)} 
      />
    </div>
  );
}
