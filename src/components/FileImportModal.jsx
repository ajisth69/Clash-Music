import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, FileUp, Link2, ListPlus } from 'lucide-react';
import { parsePlaylistFile } from '../services/fileImport';
import { fetchSpotifyTracks, matchTracksToApi } from '../services/spotifyImport';
import { fetchPlaylist } from '../services/playlistDb';
import { useLibrary } from '../context/LibraryContext';
import { playPopSfx, playLikeSfx } from '../services/soundEffects';

export default function FileImportModal({ isOpen, onClose }) {
  const { createPlaylist, addSongToPlaylist } = useLibrary();
  
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'link'
  const [status, setStatus] = useState('idle'); // 'idle' | 'parsing' | 'matching' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [matchedCount, setMatchedCount] = useState(0);
  const [pastedLink, setPastedLink] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('parsing');
    setErrorMsg('');
    setProgress({ current: 0, total: 0 });
    setMatchedCount(0);

    try {
      const playlistData = await parsePlaylistFile(file);
      
      setStatus('matching');
      setProgress({ current: 0, total: playlistData.tracks.length });

      const matchedSongs = await matchTracksToApi(playlistData.tracks, (current, total) => {
        setProgress({ current, total });
      });

      setMatchedCount(matchedSongs.length);

      if (matchedSongs.length === 0) {
        throw new Error("Could not find any matching songs for this file.");
      }

      const newPl = createPlaylist(playlistData.name || 'Imported Playlist', 'Imported from file');
      matchedSongs.forEach(song => {
        addSongToPlaylist(newPl.id, song);
      });

      setStatus('success');
      playLikeSfx();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'An error occurred during file import.');
    }
  };

  const handleLinkImport = async (e) => {
    e.preventDefault();
    const rawVal = pastedLink.trim();
    if (!rawVal) return;

    setStatus('parsing');
    setErrorMsg('');
    setProgress({ current: 0, total: 0 });
    setMatchedCount(0);

    try {
      // 1. Check if it's a Spotify link
      if (rawVal.includes('spotify.com') || rawVal.includes('spotify:playlist')) {
        const spotData = await fetchSpotifyTracks(rawVal);
        if (!spotData || !spotData.tracks || spotData.tracks.length === 0) {
          throw new Error('No tracks found in Spotify link');
        }

        setStatus('matching');
        setProgress({ current: 0, total: spotData.tracks.length });

        const matchedSongs = await matchTracksToApi(spotData.tracks, (current, total) => {
          setProgress({ current, total });
        });

        setMatchedCount(matchedSongs.length);

        if (matchedSongs.length === 0) {
          throw new Error('Could not match any tracks from this Spotify playlist.');
        }

        const newPl = createPlaylist(spotData.name || 'Spotify Playlist', 'Imported from Spotify Link');
        matchedSongs.forEach(song => addSongToPlaylist(newPl.id, song));
        setStatus('success');
        playLikeSfx();
        return;
      }

      // 2. Check if it's a Clash Music link or Playlist ID
      let plId = rawVal;
      if (rawVal.includes('playlist=')) {
        try {
          const u = new URL(rawVal.startsWith('http') ? rawVal : `https://${rawVal}`);
          plId = u.searchParams.get('playlist') || plId;
        } catch {}
      } else if (rawVal.includes('/')) {
        const parts = rawVal.split('/');
        plId = parts[parts.length - 1];
      }

      // Fetch playlist from cloud DB
      const remotePl = await fetchPlaylist(plId);
      if (remotePl && remotePl.tracks && remotePl.tracks.length > 0) {
        const newPl = createPlaylist(remotePl.name || 'Shared Playlist', remotePl.description || 'Imported via Link / ID');
        remotePl.tracks.forEach(song => addSongToPlaylist(newPl.id, song));
        setMatchedCount(remotePl.tracks.length);
        setProgress({ current: remotePl.tracks.length, total: remotePl.tracks.length });
        setStatus('success');
        playLikeSfx();
        return;
      }

      throw new Error('Could not find playlist with the provided Link or ID.');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to import playlist from Link/ID.');
    }
  };

  const handleClose = () => {
    if (status === 'parsing' || status === 'matching') return;
    setStatus('idle');
    setPastedLink('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="toon-box p-5 sm:p-6 w-full max-w-md bg-[var(--bg-secondary)] relative z-10 rounded-2xl border-4 border-black shadow-[6px_6px_0px_#000]"
          >
            {status !== 'parsing' && status !== 'matching' && (
              <button 
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-rose-500 text-white border-2 border-black hover:scale-110 active:scale-95 transition-transform"
              >
                <X className="w-4 h-4 font-black" strokeWidth={3} />
              </button>
            )}

            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto bg-purple-500 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center mb-2">
                <ListPlus className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-['Grandstander'] text-[var(--text-primary)]">Add Playlist</h2>
              <p className="text-[var(--text-muted)] text-xs sm:text-sm mt-0.5 font-bold leading-tight">
                Import playlists from files, Spotify links, or Playlist IDs
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            {status !== 'parsing' && status !== 'matching' && status !== 'success' && (
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => { playPopSfx(); setActiveTab('file'); }}
                  className={`flex-1 py-2 px-3 rounded-xl border-2 border-black font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'file'
                      ? 'bg-purple-500 text-white shadow-[2px_2px_0px_#000]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-purple-100'
                  }`}
                >
                  <FileUp className="w-4 h-4" />
                  <span>UPLOAD FILE</span>
                </button>
                
                <button
                  onClick={() => { playPopSfx(); setActiveTab('link'); }}
                  className={`flex-1 py-2 px-3 rounded-xl border-2 border-black font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'link'
                      ? 'bg-amber-400 text-stone-900 shadow-[2px_2px_0px_#000]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-amber-100'
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                  <span>PASTE LINK / ID</span>
                </button>
              </div>
            )}

            {status === 'idle' || status === 'error' ? (
              <div className="space-y-4">
                {status === 'error' && (
                  <div className="p-3 bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-500 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold text-center">
                    {errorMsg}
                  </div>
                )}
                
                {activeTab === 'file' ? (
                  <>
                    <input 
                      type="file" 
                      accept=".csv,.txt,.json"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button 
                      onClick={() => { playPopSfx(); fileInputRef.current?.click(); }}
                      className="toon-button w-full bg-purple-500 hover:bg-purple-400 text-white border-black py-4 text-sm flex flex-col items-center gap-1 border-dashed"
                    >
                      <FileUp className="w-6 h-6 mb-1" />
                      <span>SELECT PLAYLIST FILE</span>
                      <span className="text-[10px] font-bold opacity-80 normal-case">Supported formats: .txt, .csv, .json</span>
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleLinkImport} className="space-y-3">
                    <div>
                      <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-1">
                        Playlist Link or Playlist ID
                      </label>
                      <input 
                        type="text"
                        placeholder="Paste Spotify URL, Clash Link, or Playlist ID..."
                        value={pastedLink}
                        onChange={(e) => setPastedLink(e.target.value)}
                        className="toon-input w-full text-xs font-bold"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={!pastedLink.trim()}
                      className="toon-button w-full bg-amber-400 text-stone-900 border-black py-3 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>IMPORT PLAYLIST</span>
                    </button>
                  </form>
                )}
              </div>
            ) : status === 'success' ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
                <h3 className="text-xl font-black text-[var(--text-primary)] font-['Grandstander']">Import Successful!</h3>
                <p className="font-bold text-sm text-[var(--text-muted)]">
                  Successfully imported {matchedCount} track{matchedCount !== 1 ? 's' : ''} into your library!
                </p>
                <button 
                  onClick={handleClose}
                  className="toon-button w-full bg-amber-400 text-stone-900 py-3 text-sm mt-2"
                >
                  VIEW PLAYLISTS
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4 py-6">
                <Loader2 className="w-12 h-12 mx-auto text-purple-500 animate-spin" strokeWidth={2.5} />
                <h3 className="text-lg font-black text-[var(--text-primary)] font-['Grandstander']">
                  {status === 'parsing' ? 'Fetching Playlist Data...' : 'Matching Track Metadata...'}
                </h3>
                
                {status === 'matching' && progress.total > 0 && (
                  <div className="w-full space-y-2">
                    <div className="w-full bg-stone-200 dark:bg-slate-700 h-4 rounded-full border-2 border-black overflow-hidden relative">
                      <div 
                        className="absolute top-0 left-0 bottom-0 bg-purple-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                      />
                    </div>
                    <p className="font-bold text-xs text-[var(--text-muted)]">
                      {progress.current} / {progress.total} Processed
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
