import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sliders, Music, Download, Volume2, Moon, Sun, ShieldCheck } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import { playPopSfx } from '../services/soundEffects';

export default function SettingsModal({ isOpen, onClose }) {
  const { audioQuality, setAudioQuality, downloadQuality, setDownloadQuality } = useAudio();
  const { isDark, toggleTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md toon-box p-6 bg-[var(--bg-secondary)] border-4 border-[var(--border-color)] shadow-[8px_8px_0px_var(--shadow-color)] space-y-6 select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-3 border-[var(--border-color)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 dark:bg-pink-500 border-2.5 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
                <Sliders className="w-5 h-5 text-stone-900 dark:text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-[var(--text-primary)] font-['Grandstander']">
                Audio Settings
              </h2>
            </div>

            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { playPopSfx(); onClose(); }}
              className="p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)]"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </motion.button>
          </div>

          {/* Setting 1: Streaming Audio Quality */}
          <div className="space-y-2">
            <label className="text-xs font-black text-[var(--text-primary)] flex items-center gap-2">
              <Music className="w-4 h-4 text-pink-500" strokeWidth={2.5} />
              STREAMING AUDIO QUALITY
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '320kbps', label: '320 kbps HD' },
                { id: '160kbps', label: '160 kbps' },
                { id: '128kbps', label: '128 kbps' }
              ].map((q) => {
                const isSel = audioQuality === q.id;
                return (
                  <button
                    key={`stream-${q.id}`}
                    onClick={() => { playPopSfx(); setAudioQuality(q.id); }}
                    className={`py-2 px-1 rounded-xl text-xs font-black border-2 border-black transition-all ${
                      isSel
                        ? 'bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white shadow-[2.5px_2.5px_0px_#000] scale-[1.02]'
                        : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:bg-stone-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Setting 2: Download Quality */}
          <div className="space-y-2">
            <label className="text-xs font-black text-[var(--text-primary)] flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" strokeWidth={2.5} />
              DOWNLOAD AUDIO QUALITY
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '320kbps', label: '320 kbps Ultra' },
                { id: '160kbps', label: '160 kbps Standard' },
                { id: '128kbps', label: '128 kbps Compact' }
              ].map((q) => {
                const isSel = downloadQuality === q.id;
                return (
                  <button
                    key={`dl-${q.id}`}
                    onClick={() => { playPopSfx(); setDownloadQuality(q.id); }}
                    className={`py-2 px-1 rounded-xl text-xs font-black border-2 border-black transition-all ${
                      isSel
                        ? 'bg-cyan-400 text-stone-900 shadow-[2.5px_2.5px_0px_#000] scale-[1.02]'
                        : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:bg-stone-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Setting 3: Theme Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black text-[var(--text-primary)] flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              APP THEME PALETTE
            </label>
            <button
              onClick={() => { playPopSfx(); toggleTheme(); }}
              className="w-full py-2.5 px-4 rounded-2xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2.5 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] font-extrabold text-xs flex items-center justify-between"
            >
              <span>Current Theme: <strong>{isDark ? 'Dark Mode' : 'Light Mode'}</strong></span>
              <span className="px-2 py-0.5 rounded-lg bg-pink-500 text-white font-black text-[10px] border border-black">
                TOGGLE
              </span>
            </button>
          </div>

          {/* Footer Info */}
          <div className="pt-2 border-t-2 border-[var(--border-color)]/20 text-center">
            <p className="text-[10px] font-extrabold text-[var(--text-muted)] flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              TOON TUNES HD AUDIO ENGINE • V2.5
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
