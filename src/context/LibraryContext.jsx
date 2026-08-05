import React, { createContext, useContext, useState, useEffect } from 'react';

const LibraryContext = createContext();

const COLOR_PALETTES = ['#FFD166', '#EC4899', '#38BDF8', '#FF9F1C', '#34D399', '#C084FC'];

export function LibraryProvider({ children }) {
  // Liked Songs
  const [likedSongs, setLikedSongs] = useState(() => {
    try {
      const saved = localStorage.getItem('clash_liked_songs') || localStorage.getItem('toon_liked_songs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Custom Playlists
  const [playlists, setPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem('clash_playlists') || localStorage.getItem('toon_playlists');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'pl-chill-vibes',
        name: 'My Playlist',
        description: 'Fun & energetic songs for study or dance!',
        color: '#FFD166',
        tracks: []
      }
    ];
  });

  // Listening History (stores latest 100 tracks)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('clash_history') || localStorage.getItem('toon_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Followed Artists
  const [followedArtists, setFollowedArtists] = useState(() => {
    try {
      const saved = localStorage.getItem('clash_followed_artists') || localStorage.getItem('toon_followed_artists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Saved Albums
  const [savedAlbums, setSavedAlbums] = useState(() => {
    try {
      const saved = localStorage.getItem('clash_saved_albums') || localStorage.getItem('toon_saved_albums');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track Play Frequency per Song ID
  const [playCounts, setPlayCounts] = useState(() => {
    try {
      const saved = localStorage.getItem('clash_play_counts') || localStorage.getItem('toon_play_counts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Safe localStorage write with quota error handling
  const safeSetItem = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Quota exceeded — trim old data and retry
      console.warn(`localStorage quota exceeded for "${key}", pruning...`);
      try {
        // Remove oldest history entries to free space
        const hist = JSON.parse(localStorage.getItem('toon_history') || '[]');
        if (hist.length > 20) {
          localStorage.setItem('toon_history', JSON.stringify(hist.slice(0, 20)));
        }
        localStorage.setItem(key, value);
      } catch (e2) {
        // Last resort: clear history entirely
        try { localStorage.removeItem('toon_history'); } catch (e3) {}
      }
    }
  };

  // Strip bloated data (base64 covers, fileBlobs, full image arrays) before persisting
  const sanitizeSongForStorage = (song) => {
    if (!song) return song;
    const { fileBlob, downloadUrls, ...clean } = song;
    // Strip base64 data URIs from coverUrl (keep only http URLs)
    if (clean.coverUrl && clean.coverUrl.startsWith('data:')) {
      clean.coverUrl = '/logo.svg';
    }
    // Sanitize image array — keep only small URL strings
    if (Array.isArray(clean.image)) {
      clean.image = clean.image.map(img => {
        if (typeof img === 'object' && img.url) {
          return { url: img.url.startsWith('data:') ? '/logo.svg' : img.url };
        }
        return img;
      });
    }
    return clean;
  };

  // Sync to LocalStorage (with safe writes)
  useEffect(() => {
    safeSetItem('clash_liked_songs', JSON.stringify(likedSongs.map(sanitizeSongForStorage)));
  }, [likedSongs]);

  useEffect(() => {
    safeSetItem('clash_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    safeSetItem('clash_history', JSON.stringify(history.map(sanitizeSongForStorage)));
  }, [history]);

  useEffect(() => {
    safeSetItem('clash_play_counts', JSON.stringify(playCounts));
  }, [playCounts]);

  useEffect(() => {
    safeSetItem('clash_followed_artists', JSON.stringify(followedArtists));
  }, [followedArtists]);

  useEffect(() => {
    safeSetItem('clash_saved_albums', JSON.stringify(savedAlbums));
  }, [savedAlbums]);

  // Liked Songs Actions
  const toggleLikeSong = (song) => {
    setLikedSongs(prev => {
      const exists = prev.some(s => s.id === song.id);
      if (exists) {
        return prev.filter(s => s.id !== song.id);
      } else {
        return [sanitizeSongForStorage(song), ...prev];
      }
    });
  };

  const isLiked = (songId) => {
    return likedSongs.some(s => s.id === songId);
  };

  // Followed Artists Actions
  const toggleFollowArtist = (artist) => {
    if (!artist || !artist.name) return;
    const normName = artist.name.trim().toLowerCase();
    setFollowedArtists(prev => {
      const exists = prev.some(a => a.name.trim().toLowerCase() === normName);
      if (exists) {
        return prev.filter(a => a.name.trim().toLowerCase() !== normName);
      } else {
        return [{ name: artist.name, image: artist.image || '' }, ...prev];
      }
    });
  };

  const isArtistFollowed = (artistName) => {
    if (!artistName) return false;
    const normName = artistName.trim().toLowerCase();
    return followedArtists.some(a => a.name.trim().toLowerCase() === normName);
  };

  // Saved Albums Actions
  const toggleSaveAlbum = (album) => {
    if (!album || !album.name) return;
    const normName = album.name.trim().toLowerCase();
    setSavedAlbums(prev => {
      const exists = prev.some(a => a.name.trim().toLowerCase() === normName);
      if (exists) {
        return prev.filter(a => a.name.trim().toLowerCase() !== normName);
      } else {
        return [{ name: album.name, artist: album.artist || '', image: album.image || '' }, ...prev];
      }
    });
  };

  const isAlbumSaved = (albumName) => {
    if (!albumName) return false;
    const normName = albumName.trim().toLowerCase();
    return savedAlbums.some(a => a.name.trim().toLowerCase() === normName);
  };

  // Add to History & increment play count (ONLY for online streaming tracks)
  const addToHistory = (song) => {
    if (!song || !song.id) return;
    
    // Isolate Local Songs — DO NOT pollute online playback history & recommendations
    const isLocalSong = song.isLocal || 
                        (typeof song.id === 'string' && song.id.startsWith('local_')) ||
                        (typeof song.url === 'string' && song.url.startsWith('blob:')) ||
                        (typeof song.streamUrl === 'string' && song.streamUrl.startsWith('blob:')) ||
                        !!song.fileBlob ||
                        !!song.folderName;

    if (isLocalSong) return;

    // Update Play Counts for online songs
    setPlayCounts(prev => ({
      ...prev,
      [song.id]: (prev[song.id] || 0) + 1
    }));

    // Update History (latest first, max 50 items, sanitized for storage)
    setHistory(prev => {
      const filtered = prev.filter(s => 
        s.id !== song.id && 
        !s.isLocal && 
        !(typeof s.id === 'string' && s.id.startsWith('local_')) &&
        !(typeof s.url === 'string' && s.url.startsWith('blob:'))
      );
      return [sanitizeSongForStorage(song), ...filtered].slice(0, 50);
    });
  };

  // Playlist Actions
  const createPlaylist = (name, description = '') => {
    const newPl = {
      id: 'pl-' + Date.now(),
      name: name || 'My Playlist',
      description,
      color: COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)],
      tracks: []
    };
    setPlaylists(prev => [newPl, ...prev]);
    return newPl;
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
  };

  const addSongToPlaylist = (playlistId, song) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        const hasTrack = pl.tracks.some(t => t.id === song.id);
        if (hasTrack) return pl;
        return { ...pl, tracks: [...pl.tracks, song] };
      }
      return pl;
    }));
  };

  const removeSongFromPlaylist = (playlistId, songId) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        return { ...pl, tracks: pl.tracks.filter(t => t.id !== songId) };
      }
      return pl;
    }));
  };

  // Reset Actions
  const clearHistory = () => {
    setHistory([]);
    setPlayCounts({});
    localStorage.removeItem('toon_history');
    localStorage.removeItem('toon_play_counts');
  };

  const clearLikedSongs = () => {
    setLikedSongs([]);
    localStorage.removeItem('toon_liked_songs');
  };

  const resetAllData = () => {
    setLikedSongs([]);
    setHistory([]);
    setFollowedArtists([]);
    setSavedAlbums([]);
    setPlayCounts({});
    setPlaylists([
      {
        id: 'pl-chill-vibes',
        name: 'My Playlist',
        description: 'Fun & energetic songs for study or dance!',
        color: '#FFD166',
        tracks: []
      }
    ]);
    localStorage.clear();
  };

  const importPlaylist = (importedPl) => {
    const newPl = {
      ...importedPl,
      id: 'pl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6) // Ensure unique local ID
    };
    setPlaylists(prev => [newPl, ...prev]);
    return newPl;
  };

  return (
    <LibraryContext.Provider value={{
      likedSongs,
      toggleLikeSong,
      isLiked,
      followedArtists,
      toggleFollowArtist,
      isArtistFollowed,
      savedAlbums,
      toggleSaveAlbum,
      isAlbumSaved,
      playlists,
      createPlaylist,
      deletePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      importPlaylist,
      history,
      playCounts,
      addToHistory,
      clearHistory,
      clearLikedSongs,
      resetAllData
    }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  return useContext(LibraryContext);
}
