import { useEffect } from 'react';

/**
 * Injects a noindex meta tag for Prerender.io and crawlers.
 * Removes the tag on unmount so normal pages aren't affected.
 */
export function NoIndexMeta() {
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"][data-prerender]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      meta.setAttribute('data-prerender', 'true');
      document.head.appendChild(meta);
    }
    meta.content = 'noindex';

    return () => {
      if (meta && meta.parentNode) {
        meta.parentNode.removeChild(meta);
      }
    };
  }, []);

  return null;
}
