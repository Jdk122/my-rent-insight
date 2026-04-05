import { useRef, useEffect, useState } from 'react';

const MARKET_DATA = [
  { city: "Hoboken", state: "NJ", zip: "07030", bed: "1BR", rent: 3100, pctChange: -5.9 },
  { city: "Austin", state: "TX", zip: "78701", bed: "1BR", rent: 1450, pctChange: -3.2 },
  { city: "Denver", state: "CO", zip: "80202", bed: "1BR", rent: 1780, pctChange: -2.8 },
  { city: "San Francisco", state: "CA", zip: "94102", bed: "1BR", rent: 2950, pctChange: -1.4 },
  { city: "Miami", state: "FL", zip: "33130", bed: "1BR", rent: 2200, pctChange: 1.3 },
  { city: "Brooklyn", state: "NY", zip: "11201", bed: "1BR", rent: 3400, pctChange: -1.8 },
  { city: "Chicago", state: "IL", zip: "60614", bed: "1BR", rent: 1950, pctChange: 0.7 },
  { city: "Seattle", state: "WA", zip: "98101", bed: "1BR", rent: 2100, pctChange: -2.1 },
  { city: "Portland", state: "OR", zip: "97201", bed: "1BR", rent: 1580, pctChange: -4.1 },
  { city: "Jersey City", state: "NJ", zip: "07302", bed: "1BR", rent: 2850, pctChange: -3.5 },
  { city: "Phoenix", state: "AZ", zip: "85004", bed: "1BR", rent: 1320, pctChange: -1.9 },
  { city: "Nashville", state: "TN", zip: "37203", bed: "1BR", rent: 1680, pctChange: 0.4 },
  { city: "Charlotte", state: "NC", zip: "28202", bed: "1BR", rent: 1540, pctChange: -0.8 },
  { city: "DC", state: "DC", zip: "20001", bed: "1BR", rent: 2350, pctChange: -1.1 },
  { city: "Boston", state: "MA", zip: "02108", bed: "1BR", rent: 3200, pctChange: 0.9 },
  { city: "Los Angeles", state: "CA", zip: "90012", bed: "1BR", rent: 2400, pctChange: -0.6 },
];

const TickerItem = ({ item }: { item: typeof MARKET_DATA[number] }) => {
  const isNegative = item.pctChange < 0;
  const arrow = isNegative ? '▼' : '▲';
  const sign = isNegative ? '' : '+';
  return (
    <span className="inline-flex items-center gap-[5px] shrink-0">
      <span className="text-foreground font-medium text-[11px] sm:text-[12px]">
        {item.city}
      </span>
      <span className="text-muted-foreground text-[10px] sm:text-[11px]">{item.zip}</span>
      <span className="text-foreground text-[11px] sm:text-[12px]">
        ${item.rent.toLocaleString('en-US')}
      </span>
      <span className={`font-medium text-[11px] sm:text-[12px] ${isNegative ? 'text-green-600' : 'text-red-500'}`}>
        {arrow} {sign}{item.pctChange}%
      </span>
    </span>
  );
};

const MarketTicker = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(60);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      const width = contentRef.current.scrollWidth / 2;
      setDuration(width / 60);
    }
  }, []);

  const items = MARKET_DATA.map((item, i) => (
    <span key={i} className="inline-flex items-center shrink-0">
      <TickerItem item={item} />
      <span className="text-border/40 text-[9px] mx-1.5 sm:mx-2">|</span>
    </span>
  ));

  return (
    <div className="w-full border-t border-border/40">
      {/* Row 1 — Static source attribution */}
      <div className="py-1 border-b border-border/40 flex items-center justify-center gap-1.5">
        <span className="w-[5px] h-[5px] rounded-full bg-green-500 animate-[pulse-dot_2s_ease-in-out_infinite] shrink-0" />
        <p className="text-[9px] sm:text-[10px] text-muted-foreground tracking-wide">
          Data from HUD FMR · Zillow ZORI · Apartment List · Rentcast · DHCR
        </p>
      </div>

      {/* Row 2 — Scrolling ticker */}
      <div
        className="bg-muted/20 py-1.5 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          ref={contentRef}
          className="flex items-center motion-safe:animate-[ticker-scroll_var(--ticker-duration)_linear_infinite] motion-reduce:animate-none"
          style={{
            willChange: 'transform',
            animationPlayState: paused ? 'paused' : 'running',
            '--ticker-duration': `${duration}s`,
          } as React.CSSProperties}
        >
          <div className="flex items-center shrink-0">{items}</div>
          <div className="flex items-center shrink-0" aria-hidden="true">{items}</div>
        </div>
      </div>
    </div>
  );
};

export default MarketTicker;
