import { useEffect } from 'react';

/**
 * Signals to Prerender.io that the page is ready for snapshotting.
 * Call with `true` once all unique, route-specific content has rendered.
 * Automatically resets to `false` on unmount so page transitions re-gate.
 */
export function usePrerenderReady(ready: boolean) {
  useEffect(() => {
    if (ready) {
      window.prerenderReady = true;
    }
    return () => {
      window.prerenderReady = false;
    };
  }, [ready]);
}
