import React from 'react';
import { WifiOff, HardDrive, RefreshCw } from 'lucide-react';
import { playPopSfx } from '../services/soundEffects';

export default function OfflineView({ onOpenLocal }) {
  return (
    <div className="toon-box p-8 sm:p-12 text-center max-w-lg mx-auto my-12 bg-amber-100 dark:bg-slate-800 space-y-4 rounded-3xl border-3 border-[var(--border-color)] shadow-[6px_6px_0px_var(--shadow-color)] select-none animate-fade-in">
      <div className="w-20 h-20 mx-auto rounded-full bg-rose-400 border-3 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center">
        <WifiOff className="w-10 h-10 text-stone-900 animate-pulse" strokeWidth={2.5} />
      </div>

      <h3 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-['Grandstander']">
        No Internet Available
      </h3>

      <p className="font-extrabold text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
        Online music streaming, live search, and artist profiles require an active internet connection. Please connect to Wi-Fi or mobile data, or switch to your Local Library to play music files stored offline on your device.
      </p>

      {onOpenLocal && (
        <button
          onClick={() => {
            playPopSfx();
            onOpenLocal();
          }}
          className="toon-button bg-amber-400 hover:bg-amber-300 text-stone-900 px-6 py-3 text-xs sm:text-sm font-black flex items-center justify-center gap-2 mx-auto shadow-[4px_4px_0px_#000] transition-all hover:scale-105"
        >
          <HardDrive className="w-4 h-4" />
          OPEN LOCAL MUSIC LIBRARY
        </button>
      )}
    </div>
  );
}
