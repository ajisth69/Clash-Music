import React, { useState, useEffect } from 'react';
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

import ArtistDetailView from './components/ArtistDetailView';
import AlbumDetailView from './components/AlbumDetailView';
import DockedPlayer from './components/DockedPlayer';
import MaximizedPlayerModal from './components/MaximizedPlayerModal';
import QueuePanel from './components/QueuePanel';
import FloatingDownloadWidget from './components/FloatingDownloadWidget';
import SettingsView from './components/SettingsView';
import { getSongById } from './services/jiosaavnApi';
import { fetchPlaylist } from './services/playlistDb';
import { useLibrary } from './context/LibraryContext';

function MainApp() {
  const { playSong } = useAudio();
  const { importPlaylist } = useLibrary();
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'search' | 'library' | 'artistDetail' | 'albumDetail' | 'settings'
  const [selectedArtist, setSelectedArtist] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerMaximized, setIsPlayerMaximized] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [importedPlaylistId, setImportedPlaylistId] = useState(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  // Handle URL Deep-Linking for Shared Songs (?song=id), Albums (?album=name), Artists (?artist=name), and Playlists (?playlist=id)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const songId = params.get('song');
    const albumParam = params.get('album');
    const artistParam = params.get('artist');
    const playlistParam = params.get('playlist');

    if (playlistParam) {
      setIsGlobalLoading(true);
      fetchPlaylist(playlistParam).then(pl => {
        if (pl && pl.tracks && pl.tracks.length > 0) {
          const newPl = importPlaylist(pl);
          setImportedPlaylistId(newPl.id);
          setActiveTab('library');
          
          // Clean up URL without reloading page
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.pushState({path:newUrl},'',newUrl);
        } else {
          alert('Shared mix not found or is empty!');
        }
        setIsGlobalLoading(false);
      });
    } else if (songId) {
      getSongById(songId).then(song => {
        if (song) {
          playSong(song);
        }
      });
    } else if (albumParam) {
      handleSelectAlbum(decodeURIComponent(albumParam));
    } else if (artistParam) {
      handleSelectArtist(decodeURIComponent(artistParam));
    }
  }, []);

  const handleSelectArtist = (artistName) => {
    setSelectedArtist(artistName);
    setActiveTab('artistDetail');
  };

  const handleSelectAlbum = (albumName) => {
    setSelectedAlbum(albumName);
    setActiveTab('albumDetail');
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
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 pt-4 sm:pt-5 pb-32 lg:pb-20 z-10">
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
          />
        )}
      </main>

      {/* Non-Blocking Floating Background Download Badge */}
      <FloatingDownloadWidget />

      {/* Floating Mini Player (Positioned above mobile dock) */}
      <DockedPlayer
        onExpandPlayer={() => setIsPlayerMaximized(true)}
        onOpenQueue={() => setIsQueueOpen(true)}
      />

      {/* Floating Mobile Bottom Navigation Dock (< 1024px) */}
      <MobileNavDock activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Maximized Full-Screen Lyrics & Player Modal */}
      <MaximizedPlayerModal
        isOpen={isPlayerMaximized}
        onClose={() => setIsPlayerMaximized(false)}
        onOpenQueue={() => setIsQueueOpen(true)}
      />

      {/* Queue Slide-Over Panel */}
      <QueuePanel
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LibraryProvider>
        <AudioProvider>
          <DownloadProvider>
            <MainApp />
          </DownloadProvider>
        </AudioProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}
