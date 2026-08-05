import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Music, CheckCircle2, FileUp } from 'lucide-react';
import { parsePlaylistFile } from '../services/fileImport';
import { matchTracksToApi } from '../services/spotifyImport'; // Reusing the matching logic
import { useLibrary } from '../context/LibraryContext';
import { playPopSfx } from '../services/soundEffects';

export default function FileImportModal({ isOpen, onClose }) {
  const { createPlaylist, addSongToPlaylist } = useLibrary();
  
  const [status, setStatus] = useState('idle'); // 'idle' | 'parsing' | 'matching' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [matchedCount, setMatchedCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('parsing');
    setErrorMsg('');
    setProgress({ current: 0, total: 0 });
    setMatchedCount(0);

    try {
      // 1. Read and parse the file
      const playlistData = await parsePlaylistFile(file);
      
      setStatus('matching');
      setProgress({ current: 0, total: playlistData.tracks.length });

      // 2. Match tracks against Music API
      const matchedSongs = await matchTracksToApi(playlistData.tracks, (current, total) => {
        setProgress({ current, total });
      });

      setMatchedCount(matchedSongs.length);

      if (matchedSongs.length === 0) {
        throw new Error("Could not find any matching songs for this file.");
      }

      // 3. Create the playlist and add songs
      const newPl = createPlaylist(playlistData.name || 'Imported Playlist', 'Imported from file');
      matchedSongs.forEach(song => {
        addSongToPlaylist(newPl.id, song);
      });

      setStatus('success');
      playPopSfx();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'An error occurred during file import.');
    }
  };

  const handleClose = () => {
    if (status === 'parsing' || status === 'matching') return; // prevent closing while importing
    setStatus('idle');
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
            className="toon-box p-6 w-full max-w-md bg-[var(--bg-secondary)] relative z-10 rounded-2xl border-4 border-black"
          >
            {status !== 'parsing' && status !== 'matching' && (
              <button 
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-rose-500 text-white border-2 border-black hover:scale-110 active:scale-95 transition-transform"
              >
                <X className="w-4 h-4 font-black" strokeWidth={3} />
              </button>
            )}

            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto bg-purple-500 rounded-full border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center mb-3">
                <FileUp className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black font-['Grandstander'] text-[var(--text-primary)]">File Import</h2>
              <p className="text-[var(--text-muted)] text-sm mt-1 font-bold leading-tight">
                Upload a playlist `.csv` or `.txt` file exported from Spotify, Apple Music, or TuneMyMusic
              </p>
            </div>

            {status === 'idle' || status === 'error' ? (
              <div className="space-y-4">
                {status === 'error' && (
                  <div className="p-3 bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-500 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold text-center">
                    {errorMsg}
                  </div>
                )}
                
                <input 
                  type="file" 
                  accept=".csv,.txt"
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
                  <span className="text-[10px] font-bold opacity-80 normal-case">Supported formats: .txt, .csv</span>
                </button>
              </div>
            ) : status === 'success' ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
                <h3 className="text-xl font-black text-[var(--text-primary)] font-['Grandstander']">Success!</h3>
                <p className="font-bold text-sm text-[var(--text-muted)]">
                  Successfully matched {matchedCount} out of {progress.total} tracks from the file.
                </p>
                <button 
                  onClick={handleClose}
                  className="toon-button w-full bg-amber-400 text-stone-900 py-3 text-sm mt-2"
                >
                  GO TO PLAYLIST
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4 py-6">
                <Loader2 className="w-12 h-12 mx-auto text-purple-500 animate-spin" strokeWidth={2.5} />
                <h3 className="text-lg font-black text-[var(--text-primary)] font-['Grandstander']">
                  {status === 'parsing' ? 'Reading File...' : 'Matching Songs...'}
                </h3>
                
                {status === 'matching' && (
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
