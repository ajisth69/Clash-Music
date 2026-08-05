import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ListMusic, ChevronUp, ChevronDown, Trash2, GripVertical, Play, Pause, Music } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { playPopSfx } from '../services/soundEffects';
import { getDisplayImage } from '../services/musicApi';
import { RenderArtistLinks } from './SongCard';

export default function QueuePanel({ isOpen, onClose, onSelectArtist }) {
  const {
    queue,
    queueIndex,
    currentSong,
    isPlaying,
    playSong,
    removeFromQueue,
    moveQueueItem,
    clearQueue
  } = useAudio();

  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragNodeRef = useRef(null);

  const handleDragStart = (e, index) => {
    dragNodeRef.current = e.target;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag ghost semi-transparent
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.4';
      }
    }, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      moveQueueItem(dragIndex, dragOverIndex);
      playPopSfx();
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  };

  const handleMoveUp = (index) => {
    if (index <= 0) return;
    moveQueueItem(index, index - 1);
    playPopSfx();
  };

  const handleMoveDown = (index) => {
    if (index >= queue.length - 1) return;
    moveQueueItem(index, index + 1);
    playPopSfx();
  };

  const handleRemove = (index) => {
    removeFromQueue(index);
    playPopSfx();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] md:w-[420px] lg:w-[440px] z-[61] bg-[var(--bg-primary)] border-l-4 border-[var(--border-color)] shadow-[-6px_0_0px_var(--shadow-color)] flex flex-col select-none overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b-3 border-[var(--border-color)] shrink-0 bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-400 dark:bg-pink-500 border-3 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] flex items-center justify-center shrink-0">
                  <ListMusic className="w-4 h-4 sm:w-5 sm:h-5 text-stone-900 dark:text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base sm:text-lg text-[var(--text-primary)] font-['Grandstander']">Queue</h3>
                  <p className="font-bold text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {queue.length > 0 && (
                  <button
                    onClick={() => { clearQueue(); playPopSfx(); }}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500 text-white font-black text-[9px] sm:text-[10px] border-2 border-black shadow-[2px_2px_0px_#000] hover:scale-105 active:scale-95 transition-all uppercase"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border-2.5 border-[var(--border-color)] shadow-[2.5px_2.5px_0px_var(--shadow-color)] hover:scale-105 active:scale-95 transition-all"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Now Playing Banner */}
            {currentSong && (
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-amber-300/40 dark:bg-pink-500/20 border-b-2.5 border-[var(--border-color)] shrink-0">
                <p className="font-black text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Now Playing</p>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <img
                    src={getDisplayImage(currentSong)}
                    alt=""
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border-2.5 border-[var(--border-color)] shadow-[2px_2px_0px_var(--shadow-color)] object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs sm:text-sm text-[var(--text-primary)] truncate">{currentSong.name}</p>
                    <p 
                      onClick={(e) => {
                        if (onSelectArtist && currentSong.artist && currentSong.artist !== 'Unknown Artist') {
                          e.stopPropagation();
                          onClose();
                          onSelectArtist(currentSong.artist);
                        }
                      }}
                      className={`font-bold text-[10px] sm:text-[11px] text-pink-600 dark:text-cyan-400 truncate ${
                        onSelectArtist ? 'hover:underline cursor-pointer' : ''
                      }`}
                    >
                      {currentSong.artist}
                    </p>
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    {isPlaying ? (
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-1 bg-pink-500 dark:bg-cyan-400 rounded-full animate-eq-1" style={{height: '60%'}} />
                        <span className="w-1 bg-pink-500 dark:bg-cyan-400 rounded-full animate-eq-2" style={{height: '100%'}} />
                        <span className="w-1 bg-pink-500 dark:bg-cyan-400 rounded-full animate-eq-3" style={{height: '40%'}} />
                      </div>
                    ) : (
                      <Pause className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-2 sm:py-3 space-y-1.5 min-h-0">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-[var(--bg-secondary)] border-3 border-[var(--border-color)] shadow-[3px_3px_0px_var(--shadow-color)] flex items-center justify-center">
                    <Music className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--text-muted)]" />
                  </div>
                  <p className="font-black text-xs sm:text-sm text-[var(--text-muted)]">Queue is empty</p>
                  <p className="font-bold text-[10px] sm:text-xs text-[var(--text-muted)] text-center max-w-[200px]">
                    Play a song or add tracks to your queue
                  </p>
                </div>
              ) : (
                queue.map((track, idx) => {
                  const isCurrent = currentSong && currentSong.id === track.id && idx === queueIndex;
                  const isDragging = dragIndex === idx;
                  const isDragOver = dragOverIndex === idx && dragIndex !== idx;

                  return (
                    <div
                      key={`queue-${track.id}-${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onClick={() => playSong(track, queue, idx)}
                      className={`group p-2 sm:p-2.5 rounded-2xl border-2 sm:border-2.5 border-[var(--border-color)] flex items-center gap-2 sm:gap-2.5 cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-amber-300 dark:bg-pink-500/30 shadow-[3px_3px_0px_var(--shadow-color)]'
                          : 'bg-[var(--bg-secondary)] hover:bg-stone-200 dark:hover:bg-slate-700 shadow-[2px_2px_0px_var(--shadow-color)]'
                      } ${isDragging ? 'opacity-40 scale-95' : ''} ${isDragOver ? 'border-cyan-400 dark:border-pink-400 border-dashed' : ''}`}
                    >
                      {/* Drag Handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-all shrink-0"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                      </div>

                      {/* Track Number */}
                      <span className={`text-[10px] sm:text-xs font-black w-5 text-center shrink-0 ${isCurrent ? 'text-pink-600 dark:text-cyan-300' : 'text-[var(--text-muted)]'}`}>
                        {isCurrent ? '▶' : idx + 1}
                      </span>

                      {/* Album Art */}
                      <img
                        src={getDisplayImage(track)}
                        alt=""
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 border-[var(--border-color)] object-cover shrink-0"
                      />

                      {/* Track Info */}
                      <div className="min-w-0 flex-1">
                        <p className={`font-black text-[11px] sm:text-xs truncate ${isCurrent ? 'text-stone-900 dark:text-white' : 'text-[var(--text-primary)]'}`}>
                          {track.name}
                        </p>
                        <p 
                          onClick={(e) => {
                            if (onSelectArtist && track.artist && track.artist !== 'Unknown Artist') {
                              e.stopPropagation();
                              onClose();
                              onSelectArtist(track.artist);
                            }
                          }}
                          className={`font-bold text-[9px] sm:text-[10px] text-[var(--text-muted)] truncate ${
                            onSelectArtist ? 'hover:underline hover:text-amber-500 dark:hover:text-pink-400 cursor-pointer' : ''
                          }`}
                        >
                          {track.artist}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          title="Move up"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                        >
                          <ChevronUp className="w-4 h-4" strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === queue.length - 1}
                          title="Move down"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] disabled:opacity-30 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                        >
                          <ChevronDown className="w-4 h-4" strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => handleRemove(idx)}
                          title="Remove from queue"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
