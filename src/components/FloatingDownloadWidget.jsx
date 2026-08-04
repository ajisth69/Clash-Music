import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, X, StopCircle } from 'lucide-react';
import { useDownload } from '../context/DownloadContext';

export default function FloatingDownloadWidget() {
  const { downloadTask, showPopover, setShowPopover, cancelDownload } = useDownload();

  if (!downloadTask) return null;

  const { title, pct, status, isCompleted } = downloadTask;

  return (
    <div className="fixed bottom-24 right-4 sm:right-6 z-50 pointer-events-auto select-none">
      
      {/* Expanded Progress Popover */}
      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            className="mb-3 w-72 sm:w-80 toon-box p-4 bg-[var(--bg-secondary)] border-3.5 border-[var(--border-color)] shadow-[6px_6px_0px_var(--shadow-color)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Download className="w-5 h-5 text-amber-500 animate-bounce shrink-0" />
                <h4 className="font-black text-sm text-[var(--text-primary)] font-['Grandstander'] truncate">
                  {title}
                </h4>
              </div>

              {/* Close Popover (Minimize) */}
              <button
                onClick={() => setShowPopover(false)}
                className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-[var(--text-muted)] shrink-0"
                title="Minimize popover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] font-bold text-[var(--text-muted)] truncate">
              {status}
            </p>

            {/* Cartoon Progress Bar */}
            <div className="w-full h-4 rounded-full bg-[var(--bg-primary)] border-2 border-[var(--border-color)] overflow-hidden p-0.5 shadow-[2px_2px_0px_var(--shadow-color)]">
              <div
                className="h-full rounded-full bg-pink-500 dark:bg-cyan-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Footer Row with Percentage & Cancel Button */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-black text-[var(--text-primary)]">
                {pct}% COMPLETED
              </span>

              {!isCompleted && (
                <button
                  onClick={cancelDownload}
                  className="px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  CANCEL DOWNLOAD
                </button>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Animated Cartoon Icon Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowPopover(prev => !prev)}
        className="relative w-14 h-14 rounded-2xl bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white border-3.5 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center cursor-pointer group"
        title="Background Download Progress"
      >
        {isCompleted ? (
          <CheckCircle className="w-7 h-7 text-emerald-700 dark:text-emerald-300 animate-bounce" strokeWidth={2.5} />
        ) : (
          <Download className="w-7 h-7 text-stone-900 dark:text-white animate-bounce" strokeWidth={2.5} />
        )}

        {/* Floating Percentage Badge */}
        <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-pink-500 dark:bg-cyan-400 text-white dark:text-stone-900 border-2 border-black font-black text-[10px] shadow-[2px_2px_0px_#000]">
          {pct}%
        </span>
      </motion.button>

    </div>
  );
}
