import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { readFileSync, writeFileSync, existsSync } from "fs";

/** Vite plugin: generate a lightweight search index from rentData.json */
function searchIndexPlugin(): Plugin {
  const generate = () => {
    const rentPath = path.resolve(__dirname, "public/data/rentData.json");
    const outPath = path.resolve(__dirname, "public/data/searchIndex.json");
    if (!existsSync(rentPath)) return;

    const STATE_NAMES: Record<string, string> = {
      AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
      CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',
      GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',
      IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',
      MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
      MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
      NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
      OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',
      SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
      VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',
      WY:'Wyoming',PR:'Puerto Rico',GU:'Guam',VI:'Virgin Islands',
    };

    const rentData = JSON.parse(readFileSync(rentPath, "utf8"));

    const states = Object.entries(STATE_NAMES)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([code, name]) => [name, code]);

    const citySet = new Set<string>();
    const cities: string[][] = [];
    for (const raw of Object.values(rentData) as any[]) {
      const city = (raw.c || "").replace(/^Zcta\s+/i, "");
      const st = raw.s;
      if (!city || !st || !STATE_NAMES[st]) continue;
      const key = `${city}|${st}`;
      if (citySet.has(key)) continue;
      citySet.add(key);
      cities.push([city, st]);
    }
    cities.sort((a, b) => a[0].localeCompare(b[0]));

    const zips: string[][] = [];
    for (const [z, r] of Object.entries(rentData) as [string, any][]) {
      if (!/^\d{5}$/.test(z) || !r.s || !STATE_NAMES[r.s]) continue;
      const city = (r.c || "").replace(/^Zcta\s+/i, "");
      zips.push([z, city, r.s]);
    }
    zips.sort((a, b) => a[0].localeCompare(b[0]));

    writeFileSync(outPath, JSON.stringify({ states, cities, zips }));
    console.log(`✅ searchIndex.json: ${states.length} states, ${cities.length} cities, ${zips.length} zips`);
  };

  return {
    name: "generate-search-index",
    buildStart() { generate(); },
    configureServer() { generate(); },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [searchIndexPlugin(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-tooltip', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-accordion'],
          motion: ['framer-motion'],
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
}));
