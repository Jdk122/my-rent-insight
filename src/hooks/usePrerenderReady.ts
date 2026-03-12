import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Signals to Prerender.io that the page is ready for snapshotting.
 * Uses double-rAF to ensure the DOM has actually painted before signaling.
 * Resets on route change and on unmount.
 */
export function usePrerenderReady(ready: boolean) {
  const location = useLocation();

  // Reset on route change so navigations re-gate the flag
  useEffect(() => {
    window.prerenderReady = false;
  }, [location.pathname]);

  useEffect(() => {
    if (ready) {
      // Double requestAnimationFrame ensures the browser has
      // actually painted the DOM before we tell Prerender to snapshot
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.prerenderReady = true;
        });
      });
    }

    return () => {
      window.prerenderReady = false;
    };
  }, [ready]);
}
