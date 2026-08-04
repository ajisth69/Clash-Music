import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchSyncedLyrics } from '../services/lrcLibApi';
import { extractDominantColor } from '../services/colorExtractor';
import { useLibrary } from './LibraryContext';

const AudioContext = createContext();

export function AudioProvider({ children }) {
  const { addToHistory } = useLibrary();
  
  // Audio state (Persisted across page refresh)
  const audioRef = useRef(new Audio());
  const [currentSong, setCurrentSong] = useState(() => {
    try {
      const saved = localStorage.getItem('toon_current_song');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Queue & Playback Modes (Persisted across page refresh)
  const [queue, setQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('toon_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [queueIndex, setQueueIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('toon_queue_index');
      return saved !== null ? parseInt(saved, 10) : -1;
    } catch {
      return -1;
    }
  });

  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'

  // Lyrics State
  const [lyricsData, setLyricsData] = useState({ synced: false, lines: [], plain: '' });
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);

  // Quality preference
  const [audioQuality, setAudioQuality] = useState('320kbps');
  const [downloadQuality, setDownloadQuality] = useState('320kbps');

  // Pending sync target time for audio loading race condition fix
  const initialTime = (() => {
    try {
      const saved = localStorage.getItem('toon_current_time');
      return saved !== null ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  })();
  const pendingSyncTimeRef = useRef(initialTime);

  // Sync state to localStorage for page refresh persistence
  useEffect(() => {
    if (currentSong) {
      localStorage.setItem('toon_current_song', JSON.stringify(currentSong));
    } else {
      localStorage.removeItem('toon_current_song');
    }
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem('toon_queue', JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    localStorage.setItem('toon_queue_index', queueIndex.toString());
  }, [queueIndex]);

  useEffect(() => {
    if (currentTime > 0) {
      localStorage.setItem('toon_current_time', currentTime.toString());
    }
  }, [currentTime]);

  // Setup HTML5 Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      if (pendingSyncTimeRef.current !== null && !isNaN(pendingSyncTimeRef.current)) {
        try {
          audio.currentTime = pendingSyncTimeRef.current;
          setCurrentTime(pendingSyncTimeRef.current);
        } catch (e) {}
        pendingSyncTimeRef.current = null;
      }
    };

    const handleEnded = () => {
      handleNextTrack();
    };

    const handleError = (e) => {
      console.warn('Audio element error:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [queue, queueIndex, repeatMode, isShuffle]);

  // Volume & MuteSync
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Sync Lyrics active line as time updates
  useEffect(() => {
    if (!lyricsData.lines || lyricsData.lines.length === 0 || !lyricsData.synced) {
      setActiveLyricIndex(-1);
      return;
    }

    const index = lyricsData.lines.findIndex((line, i) => {
      const nextLine = lyricsData.lines[i + 1];
      return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
    });

    setActiveLyricIndex(index);
  }, [currentTime, lyricsData]);

  // Load song audio source, lyrics & Ambient Dominant Color Tinting
  useEffect(() => {
    if (!currentSong) return;

    const audio = audioRef.current;
    
    // Choose best stream URL based on quality setting
    let streamUrl = currentSong.streamUrl;
    if (currentSong.downloadUrls && currentSong.downloadUrls.length > 0) {
      const matched = currentSong.downloadUrls.find(d => d.quality === audioQuality);
      if (matched) streamUrl = matched.url;
    }

    if (streamUrl) {
      audio.src = streamUrl;
      audio.load();
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Autoplay error:', err);
        setIsPlaying(false);
      });
    }

    // Extract dominant album artwork colors for ambient backdrop gradient
    extractDominantColor(currentSong.image).then(({ primary, secondary }) => {
      document.documentElement.style.setProperty('--ambient-primary', primary);
      document.documentElement.style.setProperty('--ambient-secondary', secondary);
    });

    // Add to listening history
    addToHistory(currentSong);

    // Fetch Lyrics from LrcLib
    setIsLoadingLyrics(true);
    fetchSyncedLyrics(currentSong.name, currentSong.artist, currentSong.duration)
      .then(res => {
        setLyricsData(res);
        setIsLoadingLyrics(false);
      })
      .catch(() => {
        setLyricsData({ synced: false, lines: [], plain: 'Could not load lyrics.' });
        setIsLoadingLyrics(false);
      });
  }, [currentSong?.id, audioQuality]);

  // Play / Pause Toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!currentSong && queue.length > 0) {
      playSong(queue[0], queue, 0);
      return;
    }
    if (!currentSong) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(err => console.warn('Play error:', err));
    }
  };

  // Play specific song with optional queue context
  const playSong = (song, newQueue = null, index = 0) => {
    if (!song) return;

    // Reset pending sync time so we start from the beginning of the new song
    pendingSyncTimeRef.current = null;

    if (newQueue) {
      setQueue(newQueue);
      setQueueIndex(index);
    } else if (!queue.some(s => s.id === song.id)) {
      setQueue(prev => [song, ...prev]);
      setQueueIndex(0);
    } else {
      const foundIdx = queue.findIndex(s => s.id === song.id);
      if (foundIdx !== -1) setQueueIndex(foundIdx);
    }

    setCurrentSong(song);
    setIsPlaying(true);
  };

  // Next Track
  const handleNextTrack = () => {
    if (repeatMode === 'one') {
      const audio = audioRef.current;
      audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
      return;
    }

    if (queue.length === 0) return;

    let currentIndex = queue.findIndex(s => s?.id === currentSong?.id);
    if (currentIndex === -1) currentIndex = queueIndex;

    let nextIndex = currentIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    const nextSong = queue[nextIndex];
    if (nextSong) {
      setQueueIndex(nextIndex);
      setCurrentSong(nextSong);
      setIsPlaying(true);
    }
  };

  // Prev Track
  const handlePrevTrack = () => {
    const audio = audioRef.current;
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }

    if (queue.length === 0) return;

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    setQueueIndex(prevIndex);
    setCurrentSong(queue[prevIndex]);
    setIsPlaying(true);
  };

  // Seek To
  const seekTo = (seconds) => {
    const audio = audioRef.current;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  };

  // Add to Queue
  const addToQueue = (song) => {
    setQueue(prev => [...prev, song]);
  };

  // Remove from Queue
  const removeFromQueue = (index) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
    if (index < queueIndex) {
      setQueueIndex(prev => prev - 1);
    } else if (index === queueIndex) {
      // If removing the currently playing track, keep index but don't change song
    }
  };

  // Move queue item (for drag-drop and up/down reorder)
  const moveQueueItem = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    setQueue(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    // Adjust queueIndex to keep tracking the currently playing song
    if (queueIndex === fromIndex) {
      setQueueIndex(toIndex);
    } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
      setQueueIndex(prev => prev - 1);
    } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
      setQueueIndex(prev => prev + 1);
    }
  };

  // Clear entire queue
  const clearQueue = () => {
    setQueue([]);
    setQueueIndex(-1);
  };



  return (
    <AudioContext.Provider value={{
      currentSong,
      isPlaying,
      currentTime,
      duration,
      volume,
      setVolume,
      isMuted,
      setIsMuted,
      queue,
      queueIndex,
      isShuffle,
      setIsShuffle,
      repeatMode,
      setRepeatMode,
      lyricsData,
      isLoadingLyrics,
      activeLyricIndex,
      audioQuality,
      setAudioQuality,
      downloadQuality,
      setDownloadQuality,
      togglePlay,
      playSong,
      handleNextTrack,
      handlePrevTrack,
      seekTo,
      addToQueue,
      removeFromQueue,
      moveQueueItem,
      clearQueue,

    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContext);
}
