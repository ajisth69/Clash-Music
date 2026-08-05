import React from 'react';
import { motion } from 'framer-motion';
import { Disc, Search, Heart, HardDrive } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

import { playPopSfx } from '../services/soundEffects';

export default function MobileNavDock({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Disc, color: 'bg-amber-400 dark:bg-pink-500' },
    { id: 'search', label: 'Search', icon: Search, color: 'bg-pink-400 dark:bg-cyan-400' },
    { id: 'library', label: 'Library', icon: Heart, color: 'bg-rose-500 dark:bg-rose-500' },
    { id: 'local', label: 'Local', icon: HardDrive, color: 'bg-purple-500 text-white dark:bg-purple-600' },
  ];

  const handleTabSelect = (id) => {
    playPopSfx();
    setActiveTab(id);
  };

  return (
    <div className="fixed bottom-4 sm:bottom-5 left-0 right-0 z-50 px-2 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-0.5 lg:hidden pointer-events-none select-none">
      <div className="max-w-[calc(100vw-1.5rem)] xs:max-w-xs sm:max-w-sm md:max-w-md mx-auto h-11 sm:h-12 bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-2 border-[var(--border-color)] shadow-[0_6px_24px_rgba(0,0,0,0.35)] rounded-full px-1.5 flex items-center justify-around pointer-events-auto transition-colors">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTabSelect(item.id)}
              className={`relative px-1.5 py-0.5 rounded-full font-black flex flex-col items-center justify-center gap-0.5 transition-all min-h-[34px] min-w-[42px] flex-1 max-w-[72px] ${
                isActive
                  ? `${item.color} ${item.id === 'local' ? 'text-white' : 'text-stone-900'} border border-black shadow-[1px_1px_0px_#000]`
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span className="text-[8px] font-black uppercase tracking-wider leading-none">{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

