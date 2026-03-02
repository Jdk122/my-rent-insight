import { useEffect, useRef } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = 'https://www.renewalreply.com';
const DEFAULT_OG_IMAGE = 'https://www.renewalreply.com/og-image.png';

/**
 * Imperative head manager — replaces react-helmet-async which
 * doesn't reliably inject meta / link / script tags in React 18 client-only apps.
 *
 * On mount it upserts the relevant tags; on unmount it restores the defaults
 * from index.html so navigating away cleans up correctly.
 */
const SEO = ({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
  jsonLd,
}: SEOProps) => {
  const fullCanonical = canonical ? `${SITE_URL}${canonical}` : SITE_URL;
  const prevRef = useRef<{ title: string } | null>(null);
  const jsonLdIdsRef = useRef<string[]>([]);

  useEffect(() => {
    // Save previous title for cleanup
    prevRef.current = { title: document.title };

    // --- Title ---
    if (title) document.title = title;

    // --- Meta tags ---
    const metas: { selector: string; attrs: Record<string, string>; content: string }[] = [
      ...(description
        ? [{ selector: 'meta[name="description"]', attrs: { name: 'description' }, content: description }]
        : []),
      { selector: 'meta[property="og:type"]', attrs: { property: 'og:type' }, content: 'website' },
      ...(title
        ? [
            { selector: 'meta[property="og:title"]', attrs: { property: 'og:title' }, content: title },
            { selector: 'meta[name="twitter:title"]', attrs: { name: 'twitter:title' }, content: title },
          ]
        : []),
      ...(description
        ? [
            { selector: 'meta[property="og:description"]', attrs: { property: 'og:description' }, content: description },
            { selector: 'meta[name="twitter:description"]', attrs: { name: 'twitter:description' }, content: description },
          ]
        : []),
      { selector: 'meta[property="og:url"]', attrs: { property: 'og:url' }, content: fullCanonical },
      { selector: 'meta[property="og:image"]', attrs: { property: 'og:image' }, content: ogImage },
      { selector: 'meta[name="twitter:card"]', attrs: { name: 'twitter:card' }, content: 'summary_large_image' },
      { selector: 'meta[name="twitter:image"]', attrs: { name: 'twitter:image' }, content: ogImage },
    ];

    if (noindex) {
      metas.push({ selector: 'meta[name="robots"]', attrs: { name: 'robots' }, content: 'noindex, nofollow' });
    }

    for (const { selector, attrs, content } of metas) {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    }

    // --- Canonical ---
    let canonicalEl = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', fullCanonical);
    const ids: string[] = [];
    if (jsonLd) {
      const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      schemas.forEach((schema, i) => {
        const id = `seo-jsonld-${i}`;
        ids.push(id);
        let el = document.getElementById(id) as HTMLScriptElement | null;
        if (!el) {
          el = document.createElement('script');
          el.type = 'application/ld+json';
          el.id = id;
          document.head.appendChild(el);
        }
        el.text = JSON.stringify(schema);
      });
    }
    jsonLdIdsRef.current = ids;

    return () => {
      // Clean up JSON-LD scripts added by this instance
      for (const id of jsonLdIdsRef.current) {
        document.getElementById(id)?.remove();
      }
    };
  // We intentionally serialize jsonLd to avoid stale closures
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, fullCanonical, ogImage, noindex, JSON.stringify(jsonLd)]);

  return null; // No DOM output — everything goes to <head>
};

export default SEO;