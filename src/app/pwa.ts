/**
 * Installable app support: the service worker (offline use and updates) and the
 * browser's install prompt. The service worker only exists in production builds.
 */
import { registerSW } from 'virtual:pwa-register';

export interface OfflineCallbacks {
  /** A new version is ready; call `apply` to reload into it. */
  onUpdateReady: (apply: () => void) => void;
  /** Everything is cached: the app now works without a connection. */
  onOfflineReady: () => void;
}

export function setUpOfflineSupport({ onUpdateReady, onOfflineReady }: OfflineCallbacks): void {
  if (!('serviceWorker' in navigator)) return;
  const updateServiceWorker = registerSW({
    onNeedRefresh: () => onUpdateReady(() => updateServiceWorker(true)),
    onOfflineReady,
  });
}

/** The `beforeinstallprompt` event (Chromium browsers); not in the standard DOM types. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Calls `onAvailable` with an `install` function when the browser offers
 * installation, and with `null` once the app is installed.
 */
export function watchInstallPrompt(onAvailable: (install: (() => Promise<void>) | null) => void): () => void {
  const offer = (event: Event) => {
    event.preventDefault(); // show our own button instead of the browser's mini-bar
    const prompt = event as InstallPromptEvent;
    onAvailable(async () => {
      await prompt.prompt();
      await prompt.userChoice;
      onAvailable(null); // a prompt can only be used once
    });
  };
  const installed = () => onAvailable(null);
  window.addEventListener('beforeinstallprompt', offer);
  window.addEventListener('appinstalled', installed);
  return () => {
    window.removeEventListener('beforeinstallprompt', offer);
    window.removeEventListener('appinstalled', installed);
  };
}
