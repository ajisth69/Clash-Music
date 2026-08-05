import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Music, Download, Moon, Sun, Trash2, RotateCcw, Heart, History, Check, AlertTriangle } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import { useLibrary } from '../context/LibraryContext';
import { playPopSfx } from '../services/soundEffects';

export default function SettingsView() {
  const { audioQuality, setAudioQuality, downloadQuality, setDownloadQuality } = useAudio();
  const { isDark, toggleTheme } = useTheme();
  const { clearHistory, clearLikedSongs, resetAllData } = useLibrary();

  const [confirmResetModal, setConfirmResetModal] = useState(null); // 'history' | 'liked' | 'all' | null
  const [notification, setNotification] = useState('');

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleActionConfirm = () => {
    playPopSfx();
    if (confirmResetModal === 'history') {
      clearHistory();
      showToast('Playback history cleared!');
    } else if (confirmResetModal === 'liked') {
      clearLikedSongs();
      showToast('Liked songs list cleared!');
    } else if (confirmResetModal === 'all') {
      resetAllData();
      showToast('All app data has been reset to defaults!');
    }
    setConfirmResetModal(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 select-none">
      
      {/* Toast Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-400 text-stone-900 border-3 border-black shadow-[4px_4px_0px_#000] font-black text-sm flex items-center gap-2"
        >
          <Check className="w-5 h-5" strokeWidth={3} />
          <span>{notification}</span>
        </motion.div>
      )}

      {/* Main Page Header */}
      <div className="flex items-center gap-3.5 border-b-4 border-[var(--border-color)] pb-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-400 dark:bg-pink-500 border-3.5 border-[var(--border-color)] shadow-[4px_4px_0px_var(--shadow-color)] flex items-center justify-center">
          <Sliders className="w-7 h-7 text-stone-900 dark:text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] font-['Grandstander']">
            App Settings
          </h2>
          <p className="font-extrabold text-xs sm:text-sm text-[var(--text-muted)]">
            Manage audio streaming, download quality, visual theme & app data storage
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 1. STREAMING AUDIO QUALITY */}
        <div className="toon-box p-6 bg-[var(--bg-secondary)] border-3.5 border-[var(--border-color)] shadow-[5px_5px_0px_var(--shadow-color)] space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-400 border-2.5 border-[var(--border-color)]">
              <Music className="w-5 h-5 text-stone-900" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-lg text-[var(--text-primary)] font-['Grandstander']">Streaming Audio Quality</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">Select playback bitrate for audio streams</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { id: '320kbps', label: '320 kbps HD', desc: 'Highest audio quality (Ultra clarity)' },
              { id: '160kbps', label: '160 kbps Standard', desc: 'Balanced audio and data usage' },
              { id: '128kbps', label: '128 kbps Compact', desc: 'Saves network data on slower connections' }
            ].map((q) => {
              const isSel = audioQuality === q.id;
              return (
                <button
                  key={`stream-page-${q.id}`}
                  onClick={() => { playPopSfx(); setAudioQuality(q.id); }}
                  className={`w-full p-3.5 rounded-2xl border-3 border-black text-left flex items-center justify-between transition-all ${
                    isSel
                      ? 'bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white shadow-[3px_3px_0px_#000] scale-[1.01]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-black text-sm">{q.label}</div>
                    <div className="text-[11px] font-extrabold opacity-80">{q.desc}</div>
                  </div>
                  {isSel && <Check className="w-5 h-5 shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. DOWNLOAD AUDIO QUALITY */}
        <div className="toon-box p-6 bg-[var(--bg-secondary)] border-3.5 border-[var(--border-color)] shadow-[5px_5px_0px_var(--shadow-color)] space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-400 border-2.5 border-[var(--border-color)]">
              <Download className="w-5 h-5 text-stone-900" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-lg text-[var(--text-primary)] font-['Grandstander']">Download Bitrate</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">Set default audio quality for offline MP3 downloads</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { id: '320kbps', label: '320 kbps Ultra', desc: 'Studio quality MP3 downloads' },
              { id: '160kbps', label: '160 kbps Standard', desc: 'Standard MP3 download file size' },
              { id: '128kbps', label: '128 kbps Compact', desc: 'Smallest MP3 file footprint' }
            ].map((q) => {
              const isSel = downloadQuality === q.id;
              return (
                <button
                  key={`dl-page-${q.id}`}
                  onClick={() => { playPopSfx(); setDownloadQuality(q.id); }}
                  className={`w-full p-3.5 rounded-2xl border-3 border-black text-left flex items-center justify-between transition-all ${
                    isSel
                      ? 'bg-cyan-400 text-stone-900 shadow-[3px_3px_0px_#000] scale-[1.01]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-black text-sm">{q.label}</div>
                    <div className="text-[11px] font-extrabold opacity-80">{q.desc}</div>
                  </div>
                  {isSel && <Check className="w-5 h-5 text-stone-900 shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. VISUAL THEME SELECTION */}
        <div className="toon-box p-6 bg-[var(--bg-secondary)] border-3.5 border-[var(--border-color)] shadow-[5px_5px_0px_var(--shadow-color)] space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-300 border-2.5 border-[var(--border-color)]">
              {isDark ? <Moon className="w-5 h-5 text-purple-900" strokeWidth={2.5} /> : <Sun className="w-5 h-5 text-amber-600" strokeWidth={2.5} />}
            </div>
            <div>
              <h3 className="font-black text-lg text-[var(--text-primary)] font-['Grandstander']">App Theme Mode</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">Toggle between Light Mode Sun & Dark Mode Moon</p>
            </div>
          </div>

          <button
            onClick={() => { playPopSfx(); toggleTheme(); }}
            className="w-full p-4 rounded-2xl bg-[var(--bg-primary)] border-3 border-[var(--border-color)] shadow-[3.5px_3.5px_0px_var(--shadow-color)] flex items-center justify-between hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-6 h-6 text-cyan-400" /> : <Sun className="w-6 h-6 text-amber-500" />}
              <span className="font-black text-sm text-[var(--text-primary)]">
                Active Theme: <strong>{isDark ? 'Dark Mode' : 'Light Mode'}</strong>
              </span>
            </div>
            <span className="px-3 py-1 rounded-xl bg-pink-500 text-white font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000]">
              TOGGLE
            </span>
          </button>
        </div>

        {/* 4. DATA MANAGEMENT & RESET OPTIONS */}
        <div className="toon-box p-6 bg-[var(--bg-secondary)] border-3.5 border-[var(--border-color)] shadow-[5px_5px_0px_var(--shadow-color)] space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500 text-white border-2.5 border-[var(--border-color)]">
              <Trash2 className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-lg text-[var(--text-primary)] font-['Grandstander']">Data & Reset Storage</h3>
              <p className="text-xs font-bold text-[var(--text-muted)]">Clear history, favorites, or completely reset app data</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => { playPopSfx(); setConfirmResetModal('history'); }}
              className="w-full p-3 rounded-2xl bg-amber-100 dark:bg-slate-800 text-stone-900 dark:text-amber-100 border-2 border-[var(--border-color)] font-extrabold text-xs flex items-center justify-between hover:bg-amber-200 dark:hover:bg-slate-700 transition-colors shadow-[2px_2px_0px_var(--shadow-color)]"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Clear Playback History
              </span>
              <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 bg-amber-300/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">CLEAR</span>
            </button>

            <button
              onClick={() => { playPopSfx(); setConfirmResetModal('liked'); }}
              className="w-full p-3 rounded-2xl bg-rose-100 dark:bg-slate-800 text-stone-900 dark:text-rose-100 border-2 border-[var(--border-color)] font-extrabold text-xs flex items-center justify-between hover:bg-rose-200 dark:hover:bg-slate-700 transition-colors shadow-[2px_2px_0px_var(--shadow-color)]"
            >
              <span className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Clear Liked Favorites List
              </span>
              <span className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-300 bg-rose-300/60 dark:bg-rose-900/60 px-2 py-0.5 rounded-md">CLEAR</span>
            </button>

            <button
              onClick={() => { playPopSfx(); setConfirmResetModal('all'); }}
              className="w-full p-3 rounded-2xl bg-rose-500 text-white border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black text-xs flex items-center justify-between hover:bg-rose-600 transition-all active:scale-[0.98]"
            >
              <span className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 animate-spin-slow" />
                RESET ALL APP DATA & STORAGE
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-black text-white text-[9px] font-black">
                DANGER ZONE
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {confirmResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="toon-box p-6 bg-[var(--bg-secondary)] border-4 border-black shadow-[8px_8px_0px_#000] max-w-md w-full space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-8 h-8 shrink-0" strokeWidth={2.5} />
              <h3 className="text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
                Confirm Reset Action
              </h3>
            </div>

            <p className="font-extrabold text-xs text-[var(--text-muted)] leading-relaxed">
              {confirmResetModal === 'history' && 'Are you sure you want to clear your listening history and play counts? This cannot be undone.'}
              {confirmResetModal === 'liked' && 'Are you sure you want to clear your entire liked songs list?'}
              {confirmResetModal === 'all' && 'WARNING: This will erase all your local playlists, liked songs, listening history, and saved preferences. Are you completely sure?'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmResetModal(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-black font-extrabold text-xs"
              >
                Cancel
              </button>

              <button
                onClick={handleActionConfirm}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs hover:bg-rose-600 transition-colors"
              >
                Yes, Reset Now
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
