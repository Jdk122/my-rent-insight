import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { slugify, STATE_NAMES } from '@/data/cityStateUtils';

// [stateName, stateCode]
type StateEntry = [string, string];
// [cityName, stateCode]
type CityEntry = [string, string];
// [zip, cityName, stateCode]
type ZipEntry = [string, string, string];

interface SearchIndex {
  states: StateEntry[];
  cities: CityEntry[];
  zips: ZipEntry[];
}

interface SearchResult {
  label: string;
  sublabel: string;
  type: 'State' | 'City' | 'Zip';
  route: string;
}

let cachedIndex: SearchIndex | null = null;
let loadPromise: Promise<SearchIndex | null> | null = null;

function loadIndex(): Promise<SearchIndex | null> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (loadPromise) return loadPromise;
  loadPromise = fetch('/data/searchIndex.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then((data: SearchIndex) => { cachedIndex = data; return data; })
    .catch(() => null);
  return loadPromise;
}

function stateRoute(code: string): string {
  const name = STATE_NAMES[code];
  return name ? `/rent-data/${slugify(name)}` : `/rent-data/${code.toLowerCase()}`;
}

function cityRoute(city: string, stateCode: string): string {
  const stateName = STATE_NAMES[stateCode];
  return `/rent-data/${slugify(stateName || stateCode)}/${slugify(city)}`;
}

function search(index: SearchIndex, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: SearchResult[] = [];
  const isNumeric = /^\d+$/.test(q);

  if (isNumeric) {
    // Zip search: exact first, then startsWith
    const exact: SearchResult[] = [];
    const prefix: SearchResult[] = [];
    for (const [zip, city, st] of index.zips) {
      if (zip === q) {
        exact.push({ label: zip, sublabel: city ? `${city}, ${st}` : st, type: 'Zip', route: `/rent/${zip}` });
      } else if (zip.startsWith(q) && prefix.length < 8) {
        prefix.push({ label: zip, sublabel: city ? `${city}, ${st}` : st, type: 'Zip', route: `/rent/${zip}` });
      }
      if (exact.length + prefix.length >= 8) break;
    }
    return [...exact, ...prefix].slice(0, 8);
  }

  // State matches
  const exactStates: SearchResult[] = [];
  const prefixStates: SearchResult[] = [];
  for (const [name, code] of index.states) {
    const nl = name.toLowerCase();
    const cl = code.toLowerCase();
    if (nl === q || cl === q) {
      exactStates.push({ label: name, sublabel: code, type: 'State', route: stateRoute(code) });
    } else if (nl.startsWith(q)) {
      prefixStates.push({ label: name, sublabel: code, type: 'State', route: stateRoute(code) });
    }
  }

  // City matches
  const exactCities: SearchResult[] = [];
  const prefixCities: SearchResult[] = [];
  const containsCities: SearchResult[] = [];
  for (const [city, st] of index.cities) {
    const cl = city.toLowerCase();
    const full = `${cl}, ${st.toLowerCase()}`;
    if (cl === q || full === q) {
      exactCities.push({ label: `${city}, ${st}`, sublabel: STATE_NAMES[st] || st, type: 'City', route: cityRoute(city, st) });
    } else if (cl.startsWith(q)) {
      prefixCities.push({ label: `${city}, ${st}`, sublabel: STATE_NAMES[st] || st, type: 'City', route: cityRoute(city, st) });
    } else if (cl.includes(q) && containsCities.length < 4) {
      containsCities.push({ label: `${city}, ${st}`, sublabel: STATE_NAMES[st] || st, type: 'City', route: cityRoute(city, st) });
    }
    if (exactCities.length + prefixCities.length + containsCities.length > 20) break;
  }

  results.push(...exactStates, ...exactCities, ...prefixStates, ...prefixCities, ...containsCities);
  return results.slice(0, 8);
}

interface LocationSearchProps {
  className?: string;
}

const LocationSearch = ({ className }: LocationSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [index, setIndex] = useState<SearchIndex | null>(cachedIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ensureIndex = useCallback(async () => {
    if (index) return index;
    const loaded = await loadIndex();
    if (loaded) setIndex(loaded);
    return loaded;
  }, [index]);

  const handleChange = useCallback(async (val: string) => {
    setQuery(val);
    setActiveIdx(-1);
    const idx = await ensureIndex();
    if (!idx) { setResults([]); setOpen(false); return; }
    const r = search(idx, val);
    setResults(r);
    setOpen(r.length > 0);
  }, [ensureIndex]);

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(result.route);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < results.length) {
        handleSelect(results[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }, [open, results, activeIdx, handleSelect]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const item = listRef.current.children[activeIdx] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  const typeBadgeClass = (type: string) => {
    switch (type) {
      case 'State': return 'bg-primary/10 text-primary';
      case 'City': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <label htmlFor="location-search" className="sr-only">Search by city, state, or zip code</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} aria-hidden="true" />
        <input
          id="location-search"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="location-search-listbox"
          aria-activedescendant={activeIdx >= 0 ? `search-result-${activeIdx}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search by city, state, or zip code..."
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { ensureIndex(); if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="flex h-12 w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
        />
      </div>
      {open && results.length > 0 && (
        <ul
          id="location-search-listbox"
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[360px] overflow-y-auto"
        >
          {results.map((r, i) => (
            <li
              key={`${r.type}-${r.label}-${i}`}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onClick={() => handleSelect(r)}
              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${
                i === activeIdx ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground truncate block">{r.label}</span>
                {r.sublabel && <span className="text-xs text-muted-foreground truncate block">{r.sublabel}</span>}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ml-2 ${typeBadgeClass(r.type)}`}>
                {r.type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
