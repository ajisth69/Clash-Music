import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { fetchSyncedLyrics } from '../services/lrcLibApi';
import { extractDominantColor } from '../services/colorExtractor';
import { useLibrary } from './LibraryContext';
import { createPlayableBlobUrl, ensurePlayableUrl, saveLocalSongs } from '../services/localMusicService';
import { getSongById } from '../services/musicApi';

const AudioContext = createContext();

export function AudioProvider({ children }) {
  const { addToHistory } = useLibrary();
  
  // Audio element - configured for maximum quality and compatibility
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
    audioRef.current.playsInline = true;
    // Don't set crossOrigin for local/ content URIs - causes CORS issues on Android WebView
    audioRef.current.volume = 1.0;
  }
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
  // Maximum volume for best sound quality - like every music player
  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('toon_volume');
      return saved !== null ? parseFloat(saved) : 1.0;
    } catch { return 1.0; }
  });
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
  const [audioQuality, setAudioQuality] = useState(() => {
    try { return localStorage.getItem('toon_audio_quality') || '320kbps'; } catch { return '320kbps'; }
  });
  const [downloadQuality, setDownloadQuality] = useState(() => {
    try { return localStorage.getItem('toon_download_quality') || '320kbps'; } catch { return '320kbps'; }
  });

  // Persist quality settings
  useEffect(() => {
    try { localStorage.setItem('toon_audio_quality', audioQuality); } catch (e) {}
  }, [audioQuality]);
  useEffect(() => {
    try { localStorage.setItem('toon_download_quality', downloadQuality); } catch (e) {}
  }, [downloadQuality]);
  useEffect(() => {
    try { localStorage.setItem('toon_volume', volume.toString()); } catch (e) {}
  }, [volume]);

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
  const lastAddedSongIdRef = useRef(null);

  // Sync state to localStorage for page refresh persistence
  useEffect(() => {
    try {
      if (currentSong) {
        const { fileBlob, downloadUrls, ...safe } = currentSong;
        localStorage.setItem('toon_current_song', JSON.stringify(safe));
      } else {
        localStorage.removeItem('toon_current_song');
      }
    } catch (e) {}
  }, [currentSong]);

  useEffect(() => {
    try {
      const safeQueue = queue.map(s => {
        const { fileBlob, downloadUrls, ...safe } = s || {};
        return safe;
      });
      localStorage.setItem('toon_queue', JSON.stringify(safeQueue));
    } catch (e) {}
  }, [queue]);

  useEffect(() => {
    try { localStorage.setItem('toon_queue_index', queueIndex.toString()); } catch (e) {}
  }, [queueIndex]);

  useEffect(() => {
    if (currentTime > 0) {
      localStorage.setItem('toon_current_time', currentTime.toString());
    }
  }, [currentTime]);

  const handleNextTrackRef = useRef(null);

  const currentSongRef = useRef(currentSong);
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const syncDuration = () => {
    const audio = audioRef.current;
    if (!audio) return;

    let d = 0;
    if (isFinite(audio.duration) && audio.duration > 0) {
      d = Math.round(audio.duration);
    } else if (currentSongRef.current && currentSongRef.current.duration > 0) {
      d = currentSongRef.current.duration;
    }

    if (d > 0) {
      setDuration(d);
      const active = currentSongRef.current;
      if (active && (!active.duration || active.duration === 0)) {
        const updated = { ...active, duration: d };
        setCurrentSong(updated);
        if (active.isLocal) {
          try { saveLocalSongs([updated]); } catch (e) {}
        }
      }
    }
  };

  // Setup HTML5 Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      syncDuration();
    };

    const handleLoadedMetadata = () => {
      syncDuration();
      if (pendingSyncTimeRef.current !== null && !isNaN(pendingSyncTimeRef.current)) {
        try {
          audio.currentTime = pendingSyncTimeRef.current;
          setCurrentTime(pendingSyncTimeRef.current);
        } catch (e) {}
        pendingSyncTimeRef.current = null;
      }
    };

    const handleDurationChange = () => {
      syncDuration();
    };

    const handleCanPlay = () => {
      // Ensure volume is at max on track change for best sound quality
      audio.volume = isMuted ? 0 : volume;
      syncDuration();
    };

    const handleEnded = () => {
      if (handleNextTrackRef.current) {
        handleNextTrackRef.current();
      }
    };

    const handleError = async (e) => {
      console.warn('Audio element error:', e, 'src:', audio.src);
      if (!currentSong) {
        setIsPlaying(false);
        return;
      }

      // 1. Fallback for local Blob objects (Web / IndexedDB)
      if (currentSong.fileBlob && (currentSong.fileBlob instanceof Blob || currentSong.fileBlob instanceof File)) {
        const file = currentSong.fileBlob;
        const nameStr = currentSong.filePath || currentSong.name || currentSong.title || '';
        const ext = nameStr.split('.').pop().toLowerCase();

        const candidateTypes = ext === 'opus' || ext === 'ogg' 
          ? ['audio/ogg; codecs=opus', 'audio/webm; codecs=opus', 'audio/opus', 'audio/webm', 'audio/ogg']
          : ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/flac'];

        for (const type of candidateTypes) {
          try {
            const fallbackUrl = createPlayableBlobUrl(file, nameStr, type);
            if (fallbackUrl && audio.src !== fallbackUrl) {
              audio.src = fallbackUrl;
              audio.load();
              const playPromise = audio.play();
              if (playPromise) {
                await playPromise;
                setIsPlaying(true);
                return;
              }
            }
          } catch (err) {}
        }

        // Try raw Blob URL directly
        try {
          const rawUrl = URL.createObjectURL(file);
          if (rawUrl && audio.src !== rawUrl) {
            audio.src = rawUrl;
            audio.load();
            await audio.play();
            setIsPlaying(true);
            return;
          }
        } catch (err) {}
      }

      // 2. Fallback for Native Android content:// or file:// URIs (fetch into memory Blob)
      if (currentSong.isLocal && currentSong.streamUrl) {
        const originalUrl = currentSong.streamUrl;
        const playableUrl = ensurePlayableUrl(originalUrl);
        
        try {
          const response = await fetch(playableUrl);
          if (response.ok) {
            const fetchedBlob = await response.blob();
            const fallbackUrl = createPlayableBlobUrl(fetchedBlob, currentSong.name || currentSong.title);
            if (fallbackUrl && audio.src !== fallbackUrl) {
              audio.src = fallbackUrl;
              audio.load();
              await audio.play();
              setIsPlaying(true);
              return;
            }
          }
        } catch (fetchErr) {
          console.warn('Fetch fallback failed for local content URI:', fetchErr);
        }
      }

      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Volume & Mute Sync
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = isMuted ? 0 : volume;
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
    if (!audio) return;
    
    // Choose best stream URL based on quality setting (supporting API streams, Blobs, and local file URLs)
    let streamUrl = currentSong.streamUrl || currentSong.url || currentSong.downloadUrl;
    if (currentSong.fileBlob && (currentSong.fileBlob instanceof Blob || currentSong.fileBlob instanceof File)) {
      streamUrl = createPlayableBlobUrl(currentSong.fileBlob, currentSong.filePath || currentSong.name || currentSong.title || currentSong.format);
    } else if (currentSong.downloadUrls && currentSong.downloadUrls.length > 0) {
      const matched = currentSong.downloadUrls.find(d => d.quality === audioQuality);
      if (matched) streamUrl = matched.url;
    }

    // Convert content:// URIs for Android WebView playback (MediaStore tracks)
    if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('content://')) {
      streamUrl = ensurePlayableUrl(streamUrl);
    }

    if (streamUrl) {
      if (audio.src !== streamUrl) {
        audio.src = streamUrl;
        audio.load();
      }
      // Set volume to max for best sound quality
      audio.volume = isMuted ? 0 : volume;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Autoplay error:', err);
        setIsPlaying(false);
      });
    } else if (currentSong.id && !currentSong.isLocal) {
      // Fallback: If streamUrl is missing (e.g. legacy cached item), fetch fresh track details by ID
      getSongById(currentSong.id).then(fetched => {
        if (fetched && fetched.streamUrl) {
          setCurrentSong(prev => prev && prev.id === currentSong.id ? { ...prev, ...fetched } : prev);
        }
      });
    }

    // Extract dominant album artwork colors for ambient backdrop gradient
    extractDominantColor(currentSong.image).then(({ primary, secondary }) => {
      document.documentElement.style.setProperty('--ambient-primary', primary);
      document.documentElement.style.setProperty('--ambient-secondary', secondary);
    });

    // Add to listening history (deduplicated by song ID)
    if (currentSong.id && currentSong.id !== lastAddedSongIdRef.current) {
      lastAddedSongIdRef.current = currentSong.id;
      addToHistory(currentSong);
    }

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
  }, [currentSong?.id, currentSong?.streamUrl, currentSong?.url, audioQuality, addToHistory]);

  // Play / Pause Toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentSong && queue.length > 0) {
      playSong(queue[0], queue, 0);
      return;
    }
    if (!currentSong) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.volume = isMuted ? 0 : volume;
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
    const audio = audioRef.current;
    if (repeatMode === 'one') {
      if (audio) {
        audio.currentTime = 0;
        audio.volume = isMuted ? 0 : volume;
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
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
  handleNextTrackRef.current = handleNextTrack;

  // Prev Track
  const handlePrevTrack = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
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
    if (audio) {
      audio.currentTime = seconds;
      setCurrentTime(seconds);
    }
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

  // Stop playback and remove song from player state & localStorage if it matches
  const stopAndClearIfCurrent = (songId) => {
    if (currentSong && (currentSong.id === songId || songId === 'all')) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch (e) {}
      }
      setCurrentSong(null);
      setIsPlaying(false);
      try {
        localStorage.removeItem('toon_current_song');
        localStorage.removeItem('toon_current_time');
      } catch (e) {}
    }
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
      stopAndClearIfCurrent,
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContext);
}
