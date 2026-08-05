import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music, Search, Sun, Moon, Heart, Disc, Sparkles, Command, Sliders, HardDrive } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../context/ThemeContext';

import { playPopSfx } from '../services/soundEffects';

export default function Navbar({ activeTab, setActiveTab, searchQuery, setSearchQuery, onOpenSettings }) {
  const { isDark, toggleTheme } = useTheme();
  const isNative = Capacitor.isNativePlatform() || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Keyboard shortcut listener Ctrl+K to auto-focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('navbar-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim() && activeTab !== 'search') {
      setActiveTab('search');
    }
  };

  const handleTabClick = (tabName) => {
    playPopSfx();
    setActiveTab(tabName);
  };

  return (
    <header className="sticky top-0 z-40 px-2 sm:px-4 py-1.5 sm:py-2 bg-[var(--bg-secondary)]/90 backdrop-blur-md border-b-2 sm:border-b-2.5 border-[var(--border-color)] shadow-[0_2px_8px_rgba(0,0,0,0.1)] transition-colors duration-300 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        
        {/* Brand Logo */}
        <motion.div 
          onClick={() => handleTabClick('home')}
          whileHover={{ scale: 1.03, rotate: -1 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group select-none shrink-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center group-hover:rotate-6 transition-transform duration-200 shrink-0">
            <img src="/logo.svg" alt="Clash Music Logo" className="w-full h-full object-contain" />
          </div>
          <div className="hidden xs:block">
            <h1 className="text-sm sm:text-lg font-black tracking-wider text-[var(--text-primary)] leading-none flex items-center gap-1 font-['Grandstander']">
              CLASH<span className="text-pink-500 dark:text-cyan-400">MUSIC</span>
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 animate-wiggle inline" />
            </h1>
            <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] tracking-widest uppercase hidden sm:block">
              MUSIC PLAYER & STREAMING
            </p>
          </div>
        </motion.div>

        {/* Search Bar (Hidden on mobile < md) */}
        <div className="hidden md:block flex-1 max-w-md relative">
          <div className="relative">
            <input
              id="navbar-search-input"
              type="text"
              placeholder="Search songs, artists, albums..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (activeTab !== 'search') setActiveTab('search');
              }}
              className="w-full pl-9 pr-12 py-1.5 rounded-xl bg-[var(--bg-primary)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] text-xs text-[var(--text-primary)] font-bold placeholder-[var(--text-muted)] focus:outline-none focus:ring-0 transition-all"
            />
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2.5} />
            <kbd className="hidden sm:flex items-center gap-0.5 absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[9px] font-black text-[var(--text-muted)]">
              <Command className="w-2 h-2" /> K
            </kbd>
          </div>
        </div>

        {/* Nav Tabs & Theme Picker */}
        <div className="flex items-center gap-1 sm:gap-2">
          
          {/* Main Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleTabClick('home')}
              className={`px-3 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-extrabold text-xs flex items-center gap-1 transition-all ${
                activeTab === 'home'
                  ? 'bg-amber-400 dark:bg-pink-500 text-stone-900 dark:text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                  : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-amber-100 dark:hover:bg-slate-700'
              }`}
            >
              <Disc className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>Home</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleTabClick('library')}
              className={`px-3 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-extrabold text-xs flex items-center gap-1 transition-all ${
                activeTab === 'library'
                  ? 'bg-rose-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                  : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-rose-100 dark:hover:bg-slate-700'
              }`}
            >
              <Heart className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>Library</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleTabClick('local')}
              className={`px-3 py-1.5 rounded-xl border-2 border-[var(--border-color)] font-extrabold text-xs flex items-center gap-1 transition-all ${
                activeTab === 'local'
                  ? 'bg-purple-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                  : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-purple-100 dark:hover:bg-slate-700'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>Local</span>
            </motion.button>
          </div>


          {/* Settings Button */}
          {onOpenSettings && (
            <motion.button
              whileHover={{ scale: 1.08, rotate: 10 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                playPopSfx();
                onOpenSettings();
              }}
              title="Audio & Quality Settings"
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] hover:bg-amber-300 dark:hover:bg-pink-500 transition-all shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
            >
              <Sliders className="w-4 h-4 sm:w-3.5 sm:h-3.5" strokeWidth={2.5} />
            </motion.button>
          )}

          {/* Theme Switcher Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              playPopSfx();
              toggleTheme();
            }}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="h-10 sm:h-9 px-3 sm:px-2.5 rounded-xl bg-amber-300 dark:bg-purple-900 border-2 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center gap-1 text-stone-900 dark:text-cyan-400 font-black text-xs transition-all shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          >
            {isDark ? (
              <>
                <Moon className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-cyan-400 animate-wiggle" strokeWidth={2.5} />
                <span className="hidden sm:inline text-[11px]">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-500 animate-spin-slow" strokeWidth={2.5} />
                <span className="hidden sm:inline text-[11px]">Light</span>
              </>
            )}
          </motion.button>

        </div>

      </div>
    </header>
  );
}

