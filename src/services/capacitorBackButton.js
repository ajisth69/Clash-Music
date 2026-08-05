import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Native Capacitor Hardware Back Button Controller
 * Enforces single-step web history back navigation:
 * 1. Closes open UI modals / slide-over panels / maximized player first.
 * 2. Steps back in custom state history or window.history.back().
 * 3. Minimizes the app gracefully on root home screen (never random exits or reloads).
 */
export function setupCapacitorBackButton(options = {}) {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  const {
    getOverlayStates = () => ({}),
    closeOverlay = () => {},
    getActiveTab = () => 'home',
    onBackStep = null,
  } = options;

  const backButtonListener = App.addListener('backButton', async () => {
    const overlays = getOverlayStates();

    // 1. Prioritize closing open modals & panels (1 step)
    if (overlays.isQueueOpen) {
      closeOverlay('queue');
      return;
    }
    if (overlays.isPlayerMaximized) {
      closeOverlay('maximizedPlayer');
      return;
    }
    if (overlays.isFileImportOpen) {
      closeOverlay('fileImport');
      return;
    }

    // 2. Execute 1-step custom navigation stack handler if provided
    if (typeof onBackStep === 'function') {
      const handled = onBackStep();
      if (handled) return;
    }

    const currentTab = getActiveTab();

    // 3. Root Home screen -> minimize app safely
    if (currentTab === 'home') {
      App.minimizeApp();
    }
  });

  return () => {
    backButtonListener.then((handler) => handler.remove());
  };
}
