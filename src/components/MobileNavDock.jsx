import React from 'react';
import { motion } from 'framer-motion';
import { Disc, Search, Heart } from 'lucide-react';

import { playPopSfx } from '../services/soundEffects';

export default function MobileNavDock({ activeTab, setActiveTab }) {


  const navItems = [
    { id: 'home', label: 'Home', icon: Disc, color: 'bg-amber-400 dark:bg-pink-500' },
    { id: 'search', label: 'Search', icon: Search, color: 'bg-pink-400 dark:bg-cyan-400' },
    { id: 'library', label: 'Library', icon: Heart, color: 'bg-rose-500 dark:bg-rose-500' },
  ];

  const handleTabSelect = (id) => {
    playPopSfx();
    setActiveTab(id);
  };

  return (
    <div className="fixed bottom-1.5 left-0 right-0 z-50 px-4 lg:hidden pointer-events-none select-none">
      <div className="max-w-xs mx-auto bg-[var(--bg-secondary)]/95 backdrop-blur-lg border-2 border-[var(--border-color)] shadow-[0_4px_12px_rgba(0,0,0,0.15)] rounded-full p-1 flex items-center justify-around pointer-events-auto transition-colors">
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 1.15, y: -2 }}
              onClick={() => handleTabSelect(item.id)}
              className={`relative px-3.5 py-1 rounded-full font-black text-[9px] flex flex-col items-center justify-center gap-0.5 transition-all ${
                isActive
                  ? `${item.color} text-stone-900 shadow-[1.5px_1.5px_0px_#000]`
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={2.5} />
              <span className="text-[9px] uppercase tracking-wider leading-none">{item.label}</span>

            </motion.button>
          );
        })}

      </div>
    </div>
  );
}
