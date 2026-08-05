import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ThemeProvider } from './context/ThemeContext';
import { LibraryProvider } from './context/LibraryContext';
import { AudioProvider, useAudio } from './context/AudioContext';

import { DownloadProvider } from './context/DownloadContext';

import WatermarkBg from './components/WatermarkBg';
import Navbar from './components/Navbar';
import MobileNavDock from './components/MobileNavDock';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import LibraryView from './components/LibraryView';
import LocalMusicView from './components/LocalMusicView';

import ArtistDetailView from './components/ArtistDetailView';
import AlbumDetailView from './components/AlbumDetailView';
import DockedPlayer from './components/DockedPlayer';
import MaximizedPlayerModal from './components/MaximizedPlayerModal';
import QueuePanel from './components/QueuePanel';
import FloatingDownloadWidget from './components/FloatingDownloadWidget';
import SettingsView from './components/SettingsView';
import OfflineView from './components/OfflineView';
import { getSongById } from './services/musicApi';
import { fetchPlaylist } from './services/playlistDb';
import { useLibrary } from './context/LibraryContext';
import { setupCapacitorBackButton } from './services/capacitorBackButton';
import { checkPendingAudioIntent, listenToAudioIntent, autoScanDeviceMusic, ensurePlayableUrl } from './services/localMusicService';

function MainApp() {
  const { playSong } = useAudio();
  const { importPlaylist } = useLibrary();
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'search' | 'library' | 'local' | 'artistDetail' | 'albumDetail' | 'settings'
  const [selectedArtist, setSelectedArtist] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerMaximized, setIsPlayerMaximized] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [importedPlaylistId, setImportedPlaylistId] = useState(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isAppLaunching, setIsAppLaunching] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [navHistory, setNavHistory] = useState([]);

  const changeTabWithHistory = (newTab, options = {}) => {
    if (newTab === activeTab && !options.artist && !options.album) return;
    setNavHistory((prev) => [...prev, { tab: activeTab, artist: selectedArtist, album: selectedAlbum }]);
    if (options.artist !== undefined) setSelectedArtist(options.artist);
    if (options.album !== undefined) setSelectedAlbum(options.album);
    setActiveTab(newTab);
  };

  const handleGoBackStep = () => {
    if (navHistory.length > 0) {
      const lastState = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      if (lastState.artist !== undefined) setSelectedArtist(lastState.artist);
      if (lastState.album !== undefined) setSelectedAlbum(lastState.album);
      setActiveTab(lastState.tab);
      return true;
    }
    if (activeTab !== 'home') {
      setActiveTab('home');
      return true;
    }
    return false;
  };

  // Monitor network online / offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Setup Capacitor Native Hardware Back Button Handler & Status Bar Overlays
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      try {
        StatusBar.setOverlaysWebView({ overlay: false });
        StatusBar.setBackgroundColor({ color: '#0b0f19' });
        StatusBar.setStyle({ style: Style.Dark });
      } catch (err) {
        // Status bar plugin initial styling fallback
      }
    }

    const cleanupBackButton = setupCapacitorBackButton({
      getOverlayStates: () => ({
        isQueueOpen,
        isPlayerMaximized,
      }),
      closeOverlay: (overlayName) => {
        if (overlayName === 'queue') setIsQueueOpen(false);
        if (overlayName === 'maximizedPlayer') setIsPlayerMaximized(false);
      },
      getActiveTab: () => activeTab,
      onBackStep: handleGoBackStep,
    });

    return () => cleanupBackButton();
  }, [activeTab, isQueueOpen, isPlayerMaximized, navHistory]);

  // Helper to resolve deep link URLs for shared songs, playlists, albums, and artists
  const handleDeepLinkUrl = async (urlString) => {
    if (!urlString) return;
    setIsGlobalLoading(true);
    // Timeout safety fallback (8 seconds max)
    const timeoutTimer = setTimeout(() => setIsGlobalLoading(false), 8000);

    try {
      let queryStr = '';
      if (urlString.includes('?')) {
        queryStr = urlString.substring(urlString.indexOf('?'));
      } else {
        queryStr = urlString;
      }
      const params = new URLSearchParams(queryStr);
      const songId = params.get('songId') || params.get('song');
      const pName = params.get('pName');
      const pData = params.get('pData');
      const albumParam = params.get('album');
      const artistParam = params.get('artist');
      const playlistParam = params.get('playlist');

      if (pName && pData) {
        try {
          const rawName = decodeURIComponent(pName);
          const rawIds = JSON.parse(atob(decodeURIComponent(pData)));
          if (Array.isArray(rawIds) && rawIds.length > 0) {
            const fetchedTracks = await Promise.all(rawIds.map((id) => getSongById(id)));
            const validTracks = fetchedTracks.filter(Boolean);
            if (validTracks.length > 0) {
              const newPl = importPlaylist({
                name: rawName,
                description: 'Shared Playlist',
                tracks: validTracks,
              });
              setImportedPlaylistId(newPl.id);
              setActiveTab('library');
            }
          }
        } catch (err) {
          console.error('Error importing shared playlist URL:', err);
        }
      } else if (playlistParam) {
        try {
          const pl = await fetchPlaylist(playlistParam);
          if (pl && pl.tracks && pl.tracks.length > 0) {
            const newPl = importPlaylist(pl);
            setImportedPlaylistId(newPl.id);
            setActiveTab('library');
          } else {
            alert('Shared mix not found or is empty!');
          }
        } catch (err) {
          console.error('Error fetching shared mix:', err);
        }
      } else if (songId) {
        try {
          const song = await getSongById(songId);
          if (song) {
            playSong(song);
          }
        } catch (err) {
          console.error('Error fetching song deep link:', err);
        }
      } else if (albumParam) {
        handleSelectAlbum(decodeURIComponent(albumParam));
      } else if (artistParam) {
        handleSelectArtist(decodeURIComponent(artistParam));
      }

      // Clean up URL search params after parsing on web/native
      if (typeof window !== 'undefined' && window.history && window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err) {
      console.error('Error handling deep link URL:', err);
    } finally {
      clearTimeout(timeoutTimer);
      setIsGlobalLoading(false);
    }
  };

  // Handle Initial Mount & Native Capacitor Deep Links ('appUrlOpen') & Audio File Intents
  useEffect(() => {
    // 1. Initial Web/Native URL parse
    if (window.location.search) {
      handleDeepLinkUrl(window.location.search);
    }

    // 2. Custom event listener for smooth cross-component artist selection
    const handleCustomSelectArtist = (e) => {
      if (e.detail) handleSelectArtist(e.detail);
    };
    window.addEventListener('selectArtist', handleCustomSelectArtist);

    // 3. Auto-scan device music on native platform launch (like every music player)
    //    Runs automatically without requiring folder selection
    const autoScanOnLaunch = async () => {
      try {
        await autoScanDeviceMusic();
      } catch (e) {
        console.warn('Auto-scan on launch error:', e);
      }
    };
    autoScanOnLaunch();

    // 4. Check for external Audio file intent on launch (File Manager song open)
    const checkAudioIntent = async () => {
      const audioSong = await checkPendingAudioIntent();
      if (audioSong) {
        playSong(audioSong, [audioSong]);
        setIsPlayerMaximized(true);
      }
    };
    checkAudioIntent();

    // 5. Listen for real-time external Audio file intent while app is running
    const intentSub = listenToAudioIntent((audioSong) => {
      if (audioSong) {
        playSong(audioSong, [audioSong]);
        setIsPlayerMaximized(true);
      }
    });

    // 6. Native Capacitor App Link Listener
    let appUrlListener;
    if (Capacitor.isNativePlatform()) {
      appUrlListener = NativeApp.addListener('appUrlOpen', (data) => {
        if (data && data.url) {
          // Check if it's an audio file intent
          const lowerUrl = data.url.toLowerCase();
          const isAudioIntent = data.url.startsWith('content://') || 
                                data.url.startsWith('file://') || 
                                lowerUrl.endsWith('.mp3') || 
                                lowerUrl.endsWith('.m4a') || 
                                lowerUrl.endsWith('.flac') || 
                                lowerUrl.endsWith('.wav') || 
                                lowerUrl.endsWith('.ogg') ||
                                lowerUrl.endsWith('.opus') ||
                                lowerUrl.endsWith('.aac') ||
                                lowerUrl.endsWith('.wma');
          
          if (isAudioIntent) {
            const playableUrl = ensurePlayableUrl(data.url);
            const externalSong = {
              id: 'opened_' + Date.now(),
              name: 'External Track',
              title: 'External Track',
              artist: 'Local File',
              album: 'File Manager',
              url: playableUrl,
              streamUrl: playableUrl,
              downloadUrl: playableUrl,
              isLocal: true,
              image: [{ url: '/logo.png' }, { url: '/logo.png' }]
            };
            playSong(externalSong, [externalSong]);
            setIsPlayerMaximized(true);
          } else {
            handleDeepLinkUrl(data.url);
          }
        }
      });
    }

    return () => {
      window.removeEventListener('selectArtist', handleCustomSelectArtist);
      if (intentSub && typeof intentSub.remove === 'function') {
        intentSub.remove();
      }
      if (appUrlListener) {
        appUrlListener.then((handler) => handler.remove());
      }
    };
  }, []);

  const handleSelectArtist = (artistName) => {
    changeTabWithHistory('artistDetail', { artist: artistName });
  };

  const handleSelectAlbum = (albumName) => {
    changeTabWithHistory('albumDetail', { album: albumName });
  };

  return (
    <div className="min-h-screen flex flex-col relative select-none">
      


      {/* Global Loading Overlay for Deep Links */}
      {isGlobalLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="toon-box p-6 bg-[var(--bg-secondary)] flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-amber-400 border-t-pink-500 animate-spin" />
            <h3 className="font-black font-['Grandstander'] animate-pulse">Loading Shared Mix...</h3>
          </div>
        </div>
      )}
      
      {/* Dynamic Ambient Album Gradient Tint Backdrop */}
      <div className="fixed inset-0 ambient-bg-tint pointer-events-none z-0" />

      {/* Interactive Dispersing Cartoon Vector Canvas */}
      <WatermarkBg />

      {/* Top Header Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => changeTabWithHistory(tab)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => changeTabWithHistory('settings')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 pt-3 sm:pt-5 pb-44 lg:pb-24 z-10">
        {!isOnline && ['home', 'search', 'artistDetail', 'albumDetail'].includes(activeTab) ? (
          <OfflineView onOpenLocal={() => setActiveTab('local')} />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeView
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
              />
            )}

            {activeTab === 'search' && (
              <SearchView
                query={searchQuery}
                setQuery={setSearchQuery}
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
              />
            )}

            {activeTab === 'library' && (
              <LibraryView 
                onSelectArtist={handleSelectArtist} 
                onSelectAlbum={handleSelectAlbum}
                initialPlaylistId={importedPlaylistId}
              />
            )}

            {activeTab === 'local' && (
              <LocalMusicView />
            )}

            {activeTab === 'settings' && (
              <SettingsView />
            )}

            {activeTab === 'artistDetail' && (
              <ArtistDetailView
                artistName={selectedArtist}
                onBack={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'albumDetail' && (
              <AlbumDetailView
                albumName={selectedAlbum}
                onBack={() => setActiveTab('home')}
                onSelectArtist={handleSelectArtist}
              />
            )}
          </>
        )}
      </main>


      {/* Non-Blocking Floating Background Download Badge */}
      <FloatingDownloadWidget />

      {/* Floating Mini Player (Positioned above mobile dock) */}
      <DockedPlayer
        onExpandPlayer={() => setIsPlayerMaximized(true)}
        onOpenQueue={() => setIsQueueOpen(true)}
        onSelectArtist={handleSelectArtist}
      />

      {/* Floating Mobile Bottom Navigation Dock (< 1024px) */}
      <MobileNavDock activeTab={activeTab} setActiveTab={(tab) => changeTabWithHistory(tab)} />

      {/* Maximized Full-Screen Lyrics & Player Modal */}
      <MaximizedPlayerModal
        isOpen={isPlayerMaximized}
        onClose={() => setIsPlayerMaximized(false)}
        onOpenQueue={() => setIsQueueOpen(true)}
        onSelectArtist={handleSelectArtist}
      />

      {/* Queue Slide-Over Panel */}
      <QueuePanel
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onSelectArtist={handleSelectArtist}
      />

    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#fff', background: '#1a1a2e', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 500, marginBottom: 20 }}>{this.state.error?.message || 'Unknown error'}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} style={{ padding: '10px 24px', borderRadius: 12, background: '#ec4899', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer' }}>Reload App</button>
            <button onClick={() => { try { localStorage.clear(); } catch(e) {} this.setState({ hasError: false, error: null }); window.location.reload(); }} style={{ padding: '10px 24px', borderRadius: 12, background: '#f59e0b', color: '#1a1a2e', fontWeight: 900, border: 'none', cursor: 'pointer' }}>Clear Storage & Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LibraryProvider>
          <AudioProvider>
            <DownloadProvider>
              <MainApp />
            </DownloadProvider>
          </AudioProvider>
        </LibraryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
