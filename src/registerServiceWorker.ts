export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        // Ask the browser to check for a newer worker whenever the app boots.
        registration.update().catch(() => undefined);
      })
      .catch((error) => {
        console.warn('[PWA] Service worker registration failed:', error);
      });
  }, { once: true });
}
