import React, { createContext, useContext, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { downloadPlaylistAsZip } from '../services/downloadService';
import { playPopSfx } from '../services/soundEffects';

const DownloadContext = createContext();

export function DownloadProvider({ children }) {
  const [downloadTask, setDownloadTask] = useState(null); // { title, pct, status, isCompleted }
  const [showPopover, setShowPopover] = useState(false);
  const abortControllerRef = useRef(null);

  const startBatchZipDownload = async (title, tracks) => {
    if (!tracks || tracks.length === 0) return;
    playPopSfx();

    // Create fresh AbortController for this download session
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setDownloadTask({
      title: title || 'Music Archive',
      pct: 5,
      status: 'Preparing background MP3 packaging...',
      isCompleted: false
    });
    setShowPopover(true);

    try {
      await downloadPlaylistAsZip(
        title,
        tracks,
        (pct, status) => {
          setDownloadTask({
            title: title || 'Music Archive',
            pct,
            status,
            isCompleted: pct === 100
          });
        },
        controller.signal
      );

      confetti({
        particleCount: 75,
        spread: 90,
        origin: { y: 0.7 }
      });

      setTimeout(() => {
        setDownloadTask(null);
        setShowPopover(false);
      }, 4000);
    } catch (err) {
      if (err.message.includes('cancelled')) {
        console.log('Download cancelled by user.');
      } else {
        alert('Download error: ' + err.message);
      }
      setDownloadTask(null);
      setShowPopover(false);
    }
  };

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    playPopSfx();
    setDownloadTask(null);
    setShowPopover(false);
  };

  return (
    <DownloadContext.Provider value={{
      downloadTask,
      showPopover,
      setShowPopover,
      startBatchZipDownload,
      cancelDownload
    }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  return useContext(DownloadContext);
}
