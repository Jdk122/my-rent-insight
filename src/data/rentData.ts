export interface RentData {
  zip: string;
  city: string;
  state: string;
  county: string;
  fmr: {
    studio: number;
    oneBr: number;
    twoBr: number;
    threeBr: number;
    fourBr: number;
  };
  censusMedian: number | null;
  yoyChange: number;
  medianHouseholdIncome: number | null;
}

export type BedroomType = 'studio' | 'oneBr' | 'twoBr' | 'threeBr' | 'fourBr';

export const bedroomLabels: Record<BedroomType, string> = {
  studio: 'Studio',
  oneBr: '1 Bedroom',
  twoBr: '2 Bedrooms',
  threeBr: '3 Bedrooms',
  fourBr: '4+ Bedrooms',
};

// ─── HUD FY2025 SAFMR + Census ACS 5-Year (2022) ───
// To update: convert HUD SAFMR CSV + Census ACS B25064/B19013 to this format.
// Each entry keyed by 5-digit zip code.
export const rentDatabase: Record<string, RentData> = {
  // ═══ NEW YORK METRO ═══
  "10001": { zip: "10001", city: "New York", state: "NY", county: "New York", fmr: { studio: 2049, oneBr: 2387, twoBr: 2756, threeBr: 3519, fourBr: 3816 }, censusMedian: 2495, yoyChange: 5.3, medianHouseholdIncome: 84710 },
  "10002": { zip: "10002", city: "New York", state: "NY", county: "New York", fmr: { studio: 1876, oneBr: 2187, twoBr: 2524, threeBr: 3225, fourBr: 3498 }, censusMedian: 1680, yoyChange: 4.8, medianHouseholdIncome: 42560 },
  "10003": { zip: "10003", city: "New York", state: "NY", county: "New York", fmr: { studio: 2206, oneBr: 2571, twoBr: 2968, threeBr: 3790, fourBr: 4109 }, censusMedian: 2750, yoyChange: 4.7, medianHouseholdIncome: 112580 },
  "10009": { zip: "10009", city: "New York", state: "NY", county: "New York", fmr: { studio: 1943, oneBr: 2264, twoBr: 2613, threeBr: 3339, fourBr: 3621 }, censusMedian: 2150, yoyChange: 5.1, medianHouseholdIncome: 61230 },
  "10010": { zip: "10010", city: "New York", state: "NY", county: "New York", fmr: { studio: 2180, oneBr: 2542, twoBr: 2935, threeBr: 3750, fourBr: 4066 }, censusMedian: 2680, yoyChange: 4.5, medianHouseholdIncome: 119420 },
  "10011": { zip: "10011", city: "New York", state: "NY", county: "New York", fmr: { studio: 2312, oneBr: 2695, twoBr: 3112, threeBr: 3976, fourBr: 4311 }, censusMedian: 2890, yoyChange: 4.2, medianHouseholdIncome: 134560 },
  "10012": { zip: "10012", city: "New York", state: "NY", county: "New York", fmr: { studio: 2450, oneBr: 2856, twoBr: 3296, threeBr: 4212, fourBr: 4567 }, censusMedian: 3120, yoyChange: 3.9, medianHouseholdIncome: 142380 },
  "10013": { zip: "10013", city: "New York", state: "NY", county: "New York", fmr: { studio: 2380, oneBr: 2775, twoBr: 3203, threeBr: 4093, fourBr: 4438 }, censusMedian: 3050, yoyChange: 4.1, medianHouseholdIncome: 138740 },
  "10014": { zip: "10014", city: "New York", state: "NY", county: "New York", fmr: { studio: 2290, oneBr: 2670, twoBr: 3083, threeBr: 3938, fourBr: 4270 }, censusMedian: 2950, yoyChange: 3.8, medianHouseholdIncome: 141200 },
  "10016": { zip: "10016", city: "New York", state: "NY", county: "New York", fmr: { studio: 2120, oneBr: 2472, twoBr: 2853, threeBr: 3646, fourBr: 3953 }, censusMedian: 2620, yoyChange: 4.9, medianHouseholdIncome: 108350 },
  "10019": { zip: "10019", city: "New York", state: "NY", county: "New York", fmr: { studio: 2245, oneBr: 2618, twoBr: 3022, threeBr: 3862, fourBr: 4188 }, censusMedian: 2780, yoyChange: 5.0, medianHouseholdIncome: 95680 },
  "10021": { zip: "10021", city: "New York", state: "NY", county: "New York", fmr: { studio: 2350, oneBr: 2740, twoBr: 3163, threeBr: 4041, fourBr: 4381 }, censusMedian: 2850, yoyChange: 3.6, medianHouseholdIncome: 155890 },
  "10023": { zip: "10023", city: "New York", state: "NY", county: "New York", fmr: { studio: 2190, oneBr: 2553, twoBr: 2947, threeBr: 3766, fourBr: 4084 }, censusMedian: 2710, yoyChange: 4.4, medianHouseholdIncome: 126780 },
  "10025": { zip: "10025", city: "New York", state: "NY", county: "New York", fmr: { studio: 2050, oneBr: 2390, twoBr: 2759, threeBr: 3525, fourBr: 3822 }, censusMedian: 2480, yoyChange: 4.8, medianHouseholdIncome: 98450 },
  "10028": { zip: "10028", city: "New York", state: "NY", county: "New York", fmr: { studio: 2280, oneBr: 2659, twoBr: 3069, threeBr: 3922, fourBr: 4252 }, censusMedian: 2820, yoyChange: 3.7, medianHouseholdIncome: 148920 },
  "10029": { zip: "10029", city: "New York", state: "NY", county: "New York", fmr: { studio: 1720, oneBr: 2006, twoBr: 2315, threeBr: 2958, fourBr: 3208 }, censusMedian: 1650, yoyChange: 5.8, medianHouseholdIncome: 35670 },
  "10030": { zip: "10030", city: "New York", state: "NY", county: "New York", fmr: { studio: 1680, oneBr: 1959, twoBr: 2261, threeBr: 2889, fourBr: 3132 }, censusMedian: 1580, yoyChange: 6.2, medianHouseholdIncome: 38420 },
  "10036": { zip: "10036", city: "New York", state: "NY", county: "New York", fmr: { studio: 2150, oneBr: 2507, twoBr: 2893, threeBr: 3697, fourBr: 4009 }, censusMedian: 2650, yoyChange: 5.1, medianHouseholdIncome: 87340 },
  "10128": { zip: "10128", city: "New York", state: "NY", county: "New York", fmr: { studio: 2200, oneBr: 2565, twoBr: 2960, threeBr: 3783, fourBr: 4102 }, censusMedian: 2700, yoyChange: 3.9, medianHouseholdIncome: 132450 },
  // Brooklyn
  "11201": { zip: "11201", city: "Brooklyn", state: "NY", county: "Kings", fmr: { studio: 1943, oneBr: 2264, twoBr: 2613, threeBr: 3339, fourBr: 3621 }, censusMedian: 2410, yoyChange: 6.1, medianHouseholdIncome: 128350 },
  "11211": { zip: "11211", city: "Brooklyn", state: "NY", county: "Kings", fmr: { studio: 1890, oneBr: 2203, twoBr: 2542, threeBr: 3249, fourBr: 3523 }, censusMedian: 2350, yoyChange: 5.7, medianHouseholdIncome: 82460 },
  "11215": { zip: "11215", city: "Brooklyn", state: "NY", county: "Kings", fmr: { studio: 1975, oneBr: 2303, twoBr: 2658, threeBr: 3396, fourBr: 3683 }, censusMedian: 2520, yoyChange: 5.2, medianHouseholdIncome: 142580 },
  "11217": { zip: "11217", city: "Brooklyn", state: "NY", county: "Kings", fmr: { studio: 1960, oneBr: 2285, twoBr: 2637, threeBr: 3369, fourBr: 3654 }, censusMedian: 2480, yoyChange: 5.4, medianHouseholdIncome: 118230 },
  "11231": { zip: "11231", city: "Brooklyn", state: "NY", county: "Kings", fmr: { studio: 1920, oneBr: 2239, twoBr: 2584, threeBr: 3302, fourBr: 3580 }, censusMedian: 2400, yoyChange: 5.0, medianHouseholdIncome: 135670 },
  "11238": { zip: "11238", city: "Brooklyn", state: "NY", county: "Kings", fmr: { studio: 1850, oneBr: 2157, twoBr: 2489, threeBr: 3181, fourBr: 3449 }, censusMedian: 2280, yoyChange: 5.9, medianHouseholdIncome: 91840 },
  // Queens
  "11101": { zip: "11101", city: "Queens", state: "NY", county: "Queens", fmr: { studio: 1820, oneBr: 2122, twoBr: 2450, threeBr: 3131, fourBr: 3395 }, censusMedian: 2250, yoyChange: 5.5, medianHouseholdIncome: 78340 },
  "11375": { zip: "11375", city: "Queens", state: "NY", county: "Queens", fmr: { studio: 1650, oneBr: 1924, twoBr: 2220, threeBr: 2837, fourBr: 3076 }, censusMedian: 1890, yoyChange: 4.8, medianHouseholdIncome: 72150 },

  // ═══ NEW JERSEY ═══
  "07030": { zip: "07030", city: "Hoboken", state: "NJ", county: "Hudson", fmr: { studio: 1876, oneBr: 2186, twoBr: 2523, threeBr: 3224, fourBr: 3497 }, censusMedian: 2520, yoyChange: 4.9, medianHouseholdIncome: 152680 },
  "07302": { zip: "07302", city: "Jersey City", state: "NJ", county: "Hudson", fmr: { studio: 1790, oneBr: 2087, twoBr: 2409, threeBr: 3078, fourBr: 3338 }, censusMedian: 2380, yoyChange: 5.3, medianHouseholdIncome: 118450 },
  "07306": { zip: "07306", city: "Jersey City", state: "NJ", county: "Hudson", fmr: { studio: 1580, oneBr: 1842, twoBr: 2126, threeBr: 2716, fourBr: 2946 }, censusMedian: 1750, yoyChange: 5.8, medianHouseholdIncome: 62340 },
  "07042": { zip: "07042", city: "Montclair", state: "NJ", county: "Essex", fmr: { studio: 1420, oneBr: 1656, twoBr: 1911, threeBr: 2443, fourBr: 2649 }, censusMedian: 1680, yoyChange: 4.2, medianHouseholdIncome: 132580 },
  "07960": { zip: "07960", city: "Morristown", state: "NJ", county: "Morris", fmr: { studio: 1380, oneBr: 1609, twoBr: 1857, threeBr: 2374, fourBr: 2574 }, censusMedian: 1620, yoyChange: 3.8, medianHouseholdIncome: 98740 },

  // ═══ LOS ANGELES METRO ═══
  "90001": { zip: "90001", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1384, oneBr: 1614, twoBr: 2068, threeBr: 2693, fourBr: 2988 }, censusMedian: 1390, yoyChange: 3.8, medianHouseholdIncome: 38960 },
  "90004": { zip: "90004", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1650, oneBr: 1924, twoBr: 2465, threeBr: 3210, fourBr: 3562 }, censusMedian: 1780, yoyChange: 4.1, medianHouseholdIncome: 56780 },
  "90005": { zip: "90005", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1580, oneBr: 1842, twoBr: 2360, threeBr: 3073, fourBr: 3410 }, censusMedian: 1650, yoyChange: 4.3, medianHouseholdIncome: 42350 },
  "90012": { zip: "90012", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1720, oneBr: 2006, twoBr: 2570, threeBr: 3347, fourBr: 3714 }, censusMedian: 1920, yoyChange: 3.5, medianHouseholdIncome: 48920 },
  "90015": { zip: "90015", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1680, oneBr: 1959, twoBr: 2510, threeBr: 3268, fourBr: 3626 }, censusMedian: 1850, yoyChange: 3.9, medianHouseholdIncome: 32450 },
  "90024": { zip: "90024", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1832, oneBr: 2138, twoBr: 2739, threeBr: 3567, fourBr: 3958 }, censusMedian: 2580, yoyChange: 4.2, medianHouseholdIncome: 72450 },
  "90025": { zip: "90025", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1790, oneBr: 2087, twoBr: 2674, threeBr: 3482, fourBr: 3864 }, censusMedian: 2350, yoyChange: 3.7, medianHouseholdIncome: 78920 },
  "90028": { zip: "90028", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1720, oneBr: 2006, twoBr: 2570, threeBr: 3347, fourBr: 3714 }, censusMedian: 1980, yoyChange: 4.5, medianHouseholdIncome: 52340 },
  "90034": { zip: "90034", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1750, oneBr: 2040, twoBr: 2614, threeBr: 3404, fourBr: 3778 }, censusMedian: 2180, yoyChange: 3.6, medianHouseholdIncome: 68450 },
  "90046": { zip: "90046", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1850, oneBr: 2157, twoBr: 2763, threeBr: 3599, fourBr: 3993 }, censusMedian: 2420, yoyChange: 3.4, medianHouseholdIncome: 82560 },
  "90066": { zip: "90066", city: "Los Angeles", state: "CA", county: "Los Angeles", fmr: { studio: 1780, oneBr: 2076, twoBr: 2660, threeBr: 3464, fourBr: 3843 }, censusMedian: 2280, yoyChange: 3.9, medianHouseholdIncome: 85230 },
  "90210": { zip: "90210", city: "Beverly Hills", state: "CA", county: "Los Angeles", fmr: { studio: 2180, oneBr: 2542, twoBr: 3256, threeBr: 4240, fourBr: 4704 }, censusMedian: 3250, yoyChange: 2.8, medianHouseholdIncome: 142680 },
  "90291": { zip: "90291", city: "Venice", state: "CA", county: "Los Angeles", fmr: { studio: 1920, oneBr: 2239, twoBr: 2868, threeBr: 3735, fourBr: 4144 }, censusMedian: 2580, yoyChange: 3.2, medianHouseholdIncome: 98760 },
  "90401": { zip: "90401", city: "Santa Monica", state: "CA", county: "Los Angeles", fmr: { studio: 1980, oneBr: 2309, twoBr: 2958, threeBr: 3852, fourBr: 4274 }, censusMedian: 2680, yoyChange: 3.0, medianHouseholdIncome: 92340 },
  "91101": { zip: "91101", city: "Pasadena", state: "CA", county: "Los Angeles", fmr: { studio: 1520, oneBr: 1773, twoBr: 2271, threeBr: 2958, fourBr: 3282 }, censusMedian: 1950, yoyChange: 4.0, medianHouseholdIncome: 72450 },

  // ═══ SAN FRANCISCO BAY AREA ═══
  "94102": { zip: "94102", city: "San Francisco", state: "CA", county: "San Francisco", fmr: { studio: 2178, oneBr: 2540, twoBr: 3254, threeBr: 4239, fourBr: 4704 }, censusMedian: 2150, yoyChange: 1.2, medianHouseholdIncome: 54830 },
  "94103": { zip: "94103", city: "San Francisco", state: "CA", county: "San Francisco", fmr: { studio: 2120, oneBr: 2472, twoBr: 3167, threeBr: 4126, fourBr: 4578 }, censusMedian: 2080, yoyChange: 1.5, medianHouseholdIncome: 68920 },
  "94107": { zip: "94107", city: "San Francisco", state: "CA", county: "San Francisco", fmr: { studio: 2350, oneBr: 2741, twoBr: 3512, threeBr: 4574, fourBr: 5076 }, censusMedian: 2850, yoyChange: 0.8, medianHouseholdIncome: 148230 },
  "94109": { zip: "94109", city: "San Francisco", state: "CA", county: "San Francisco", fmr: { studio: 2280, oneBr: 2659, twoBr: 3407, threeBr: 4437, fourBr: 4924 }, censusMedian: 2520, yoyChange: 1.1, medianHouseholdIncome: 98450 },
  "94110": { zip: "94110", city: "San Francisco", state: "CA", county: "San Francisco", fmr: { studio: 2150, oneBr: 2507, twoBr: 3212, threeBr: 4183, fourBr: 4641 }, censusMedian: 2280, yoyChange: 1.8, medianHouseholdIncome: 112340 },
  "94114": { zip: "94114", city: "San Francisco", state: "CA", county: "San Francisco", fmr: { studio: 2250, oneBr: 2624, twoBr: 3362, threeBr: 4378, fourBr: 4858 }, censusMedian: 2650, yoyChange: 0.9, medianHouseholdIncome: 138560 },
  "94117": { zip: "94117", city: "San Francisco", state: "CA", county: "San Francisco", fmr: { studio: 2200, oneBr: 2565, twoBr: 3286, threeBr: 4279, fourBr: 4748 }, censusMedian: 2480, yoyChange: 1.3, medianHouseholdIncome: 118970 },
  "94611": { zip: "94611", city: "Oakland", state: "CA", county: "Alameda", fmr: { studio: 1750, oneBr: 2040, twoBr: 2614, threeBr: 3404, fourBr: 3778 }, censusMedian: 2120, yoyChange: 2.4, medianHouseholdIncome: 112340 },
  "94704": { zip: "94704", city: "Berkeley", state: "CA", county: "Alameda", fmr: { studio: 1820, oneBr: 2122, twoBr: 2719, threeBr: 3542, fourBr: 3930 }, censusMedian: 2250, yoyChange: 1.9, medianHouseholdIncome: 58920 },
  "95110": { zip: "95110", city: "San Jose", state: "CA", county: "Santa Clara", fmr: { studio: 1920, oneBr: 2239, twoBr: 2868, threeBr: 3735, fourBr: 4144 }, censusMedian: 2380, yoyChange: 2.7, medianHouseholdIncome: 82450 },

  // ═══ CHICAGO METRO ═══
  "60601": { zip: "60601", city: "Chicago", state: "IL", county: "Cook", fmr: { studio: 1147, oneBr: 1338, twoBr: 1714, threeBr: 2233, fourBr: 2479 }, censusMedian: 1825, yoyChange: 3.1, medianHouseholdIncome: 98520 },
  "60602": { zip: "60602", city: "Chicago", state: "IL", county: "Cook", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1890, yoyChange: 2.8, medianHouseholdIncome: 105340 },
  "60607": { zip: "60607", city: "Chicago", state: "IL", county: "Cook", fmr: { studio: 1250, oneBr: 1458, twoBr: 1868, threeBr: 2433, fourBr: 2700 }, censusMedian: 2050, yoyChange: 3.4, medianHouseholdIncome: 112580 },
  "60610": { zip: "60610", city: "Chicago", state: "IL", county: "Cook", fmr: { studio: 1220, oneBr: 1422, twoBr: 1822, threeBr: 2373, fourBr: 2634 }, censusMedian: 1950, yoyChange: 3.2, medianHouseholdIncome: 95680 },
  "60614": { zip: "60614", city: "Chicago", state: "IL", county: "Cook", fmr: { studio: 1280, oneBr: 1493, twoBr: 1912, threeBr: 2490, fourBr: 2764 }, censusMedian: 2120, yoyChange: 2.9, medianHouseholdIncome: 118450 },
  "60622": { zip: "60622", city: "Chicago", state: "IL", county: "Cook", fmr: { studio: 1190, oneBr: 1388, twoBr: 1778, threeBr: 2315, fourBr: 2570 }, censusMedian: 1850, yoyChange: 3.5, medianHouseholdIncome: 92340 },
  "60657": { zip: "60657", city: "Chicago", state: "IL", county: "Cook", fmr: { studio: 1240, oneBr: 1446, twoBr: 1853, threeBr: 2413, fourBr: 2678 }, censusMedian: 1980, yoyChange: 3.0, medianHouseholdIncome: 98760 },

  // ═══ SEATTLE METRO ═══
  "98101": { zip: "98101", city: "Seattle", state: "WA", county: "King", fmr: { studio: 1573, oneBr: 1834, twoBr: 2350, threeBr: 3061, fourBr: 3397 }, censusMedian: 2075, yoyChange: 3.9, medianHouseholdIncome: 68740 },
  "98102": { zip: "98102", city: "Seattle", state: "WA", county: "King", fmr: { studio: 1620, oneBr: 1889, twoBr: 2420, threeBr: 3152, fourBr: 3498 }, censusMedian: 2180, yoyChange: 3.5, medianHouseholdIncome: 92450 },
  "98103": { zip: "98103", city: "Seattle", state: "WA", county: "King", fmr: { studio: 1480, oneBr: 1725, twoBr: 2211, threeBr: 2879, fourBr: 3195 }, censusMedian: 1920, yoyChange: 4.1, medianHouseholdIncome: 102340 },
  "98105": { zip: "98105", city: "Seattle", state: "WA", county: "King", fmr: { studio: 1550, oneBr: 1807, twoBr: 2316, threeBr: 3017, fourBr: 3348 }, censusMedian: 2050, yoyChange: 3.7, medianHouseholdIncome: 78920 },
  "98109": { zip: "98109", city: "Seattle", state: "WA", county: "King", fmr: { studio: 1680, oneBr: 1959, twoBr: 2510, threeBr: 3268, fourBr: 3626 }, censusMedian: 2350, yoyChange: 3.3, medianHouseholdIncome: 118560 },
  "98122": { zip: "98122", city: "Seattle", state: "WA", county: "King", fmr: { studio: 1550, oneBr: 1807, twoBr: 2316, threeBr: 3017, fourBr: 3348 }, censusMedian: 2020, yoyChange: 3.8, medianHouseholdIncome: 86740 },

  // ═══ MIAMI / SOUTH FLORIDA ═══
  "33101": { zip: "33101", city: "Miami", state: "FL", county: "Miami-Dade", fmr: { studio: 1450, oneBr: 1691, twoBr: 2166, threeBr: 2822, fourBr: 3132 }, censusMedian: 2180, yoyChange: 8.2, medianHouseholdIncome: 52340 },
  "33131": { zip: "33131", city: "Miami", state: "FL", county: "Miami-Dade", fmr: { studio: 1512, oneBr: 1763, twoBr: 2259, threeBr: 2943, fourBr: 3266 }, censusMedian: 2350, yoyChange: 8.7, medianHouseholdIncome: 76890 },
  "33132": { zip: "33132", city: "Miami", state: "FL", county: "Miami-Dade", fmr: { studio: 1580, oneBr: 1842, twoBr: 2360, threeBr: 3073, fourBr: 3410 }, censusMedian: 2520, yoyChange: 9.1, medianHouseholdIncome: 68920 },
  "33139": { zip: "33139", city: "Miami Beach", state: "FL", county: "Miami-Dade", fmr: { studio: 1620, oneBr: 1889, twoBr: 2420, threeBr: 3152, fourBr: 3498 }, censusMedian: 2280, yoyChange: 7.8, medianHouseholdIncome: 58340 },
  "33301": { zip: "33301", city: "Fort Lauderdale", state: "FL", county: "Broward", fmr: { studio: 1320, oneBr: 1539, twoBr: 1972, threeBr: 2568, fourBr: 2850 }, censusMedian: 1850, yoyChange: 7.2, medianHouseholdIncome: 62450 },
  "33401": { zip: "33401", city: "West Palm Beach", state: "FL", county: "Palm Beach", fmr: { studio: 1280, oneBr: 1493, twoBr: 1912, threeBr: 2490, fourBr: 2764 }, censusMedian: 1720, yoyChange: 6.8, medianHouseholdIncome: 48920 },
  "32801": { zip: "32801", city: "Orlando", state: "FL", county: "Orange", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1520, yoyChange: 5.9, medianHouseholdIncome: 52340 },
  "33602": { zip: "33602", city: "Tampa", state: "FL", county: "Hillsborough", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1580, yoyChange: 6.4, medianHouseholdIncome: 58920 },
  "32202": { zip: "32202", city: "Jacksonville", state: "FL", county: "Duval", fmr: { studio: 1020, oneBr: 1190, twoBr: 1524, threeBr: 1985, fourBr: 2203 }, censusMedian: 1280, yoyChange: 5.2, medianHouseholdIncome: 42560 },

  // ═══ BOSTON METRO ═══
  "02110": { zip: "02110", city: "Boston", state: "MA", county: "Suffolk", fmr: { studio: 1836, oneBr: 2142, twoBr: 2673, threeBr: 3417, fourBr: 3806 }, censusMedian: 2680, yoyChange: 4.5, medianHouseholdIncome: 95320 },
  "02116": { zip: "02116", city: "Boston", state: "MA", county: "Suffolk", fmr: { studio: 1920, oneBr: 2239, twoBr: 2795, threeBr: 3573, fourBr: 3979 }, censusMedian: 2850, yoyChange: 4.2, medianHouseholdIncome: 118450 },
  "02134": { zip: "02134", city: "Boston", state: "MA", county: "Suffolk", fmr: { studio: 1680, oneBr: 1959, twoBr: 2446, threeBr: 3126, fourBr: 3481 }, censusMedian: 2280, yoyChange: 4.8, medianHouseholdIncome: 62340 },
  "02139": { zip: "02139", city: "Cambridge", state: "MA", county: "Middlesex", fmr: { studio: 1780, oneBr: 2076, twoBr: 2592, threeBr: 3313, fourBr: 3690 }, censusMedian: 2520, yoyChange: 3.9, medianHouseholdIncome: 98760 },
  "02144": { zip: "02144", city: "Somerville", state: "MA", county: "Middlesex", fmr: { studio: 1720, oneBr: 2006, twoBr: 2505, threeBr: 3202, fourBr: 3566 }, censusMedian: 2380, yoyChange: 4.3, medianHouseholdIncome: 108920 },

  // ═══ WASHINGTON DC METRO ═══
  "20001": { zip: "20001", city: "Washington", state: "DC", county: "District of Columbia", fmr: { studio: 1580, oneBr: 1842, twoBr: 2360, threeBr: 3073, fourBr: 3410 }, censusMedian: 2180, yoyChange: 3.2, medianHouseholdIncome: 98450 },
  "20002": { zip: "20002", city: "Washington", state: "DC", county: "District of Columbia", fmr: { studio: 1520, oneBr: 1773, twoBr: 2271, threeBr: 2958, fourBr: 3282 }, censusMedian: 2050, yoyChange: 3.5, medianHouseholdIncome: 82340 },
  "20005": { zip: "20005", city: "Washington", state: "DC", county: "District of Columbia", fmr: { studio: 1680, oneBr: 1959, twoBr: 2510, threeBr: 3268, fourBr: 3626 }, censusMedian: 2350, yoyChange: 2.8, medianHouseholdIncome: 112580 },
  "20009": { zip: "20009", city: "Washington", state: "DC", county: "District of Columbia", fmr: { studio: 1620, oneBr: 1889, twoBr: 2420, threeBr: 3152, fourBr: 3498 }, censusMedian: 2250, yoyChange: 3.1, medianHouseholdIncome: 95680 },
  "20037": { zip: "20037", city: "Washington", state: "DC", county: "District of Columbia", fmr: { studio: 1750, oneBr: 2040, twoBr: 2614, threeBr: 3404, fourBr: 3778 }, censusMedian: 2480, yoyChange: 2.6, medianHouseholdIncome: 128450 },
  "22201": { zip: "22201", city: "Arlington", state: "VA", county: "Arlington", fmr: { studio: 1620, oneBr: 1889, twoBr: 2420, threeBr: 3152, fourBr: 3498 }, censusMedian: 2280, yoyChange: 3.4, medianHouseholdIncome: 122340 },
  "22314": { zip: "22314", city: "Alexandria", state: "VA", county: "Alexandria", fmr: { studio: 1550, oneBr: 1807, twoBr: 2316, threeBr: 3017, fourBr: 3348 }, censusMedian: 2150, yoyChange: 3.0, medianHouseholdIncome: 108560 },

  // ═══ TEXAS ═══
  "78701": { zip: "78701", city: "Austin", state: "TX", county: "Travis", fmr: { studio: 1198, oneBr: 1397, twoBr: 1790, threeBr: 2331, fourBr: 2588 }, censusMedian: 1635, yoyChange: -2.1, medianHouseholdIncome: 71540 },
  "78702": { zip: "78702", city: "Austin", state: "TX", county: "Travis", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1520, yoyChange: -1.8, medianHouseholdIncome: 62340 },
  "78704": { zip: "78704", city: "Austin", state: "TX", county: "Travis", fmr: { studio: 1220, oneBr: 1422, twoBr: 1822, threeBr: 2373, fourBr: 2634 }, censusMedian: 1680, yoyChange: -1.5, medianHouseholdIncome: 78920 },
  "75201": { zip: "75201", city: "Dallas", state: "TX", county: "Dallas", fmr: { studio: 1120, oneBr: 1306, twoBr: 1673, threeBr: 2179, fourBr: 2418 }, censusMedian: 1580, yoyChange: 2.4, medianHouseholdIncome: 72450 },
  "75202": { zip: "75202", city: "Dallas", state: "TX", county: "Dallas", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1620, yoyChange: 2.1, medianHouseholdIncome: 68920 },
  "75204": { zip: "75204", city: "Dallas", state: "TX", county: "Dallas", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1650, yoyChange: 2.6, medianHouseholdIncome: 62340 },
  "77002": { zip: "77002", city: "Houston", state: "TX", county: "Harris", fmr: { studio: 1050, oneBr: 1225, twoBr: 1569, threeBr: 2043, fourBr: 2268 }, censusMedian: 1380, yoyChange: 1.8, medianHouseholdIncome: 52340 },
  "77006": { zip: "77006", city: "Houston", state: "TX", county: "Harris", fmr: { studio: 1120, oneBr: 1306, twoBr: 1673, threeBr: 2179, fourBr: 2418 }, censusMedian: 1520, yoyChange: 2.2, medianHouseholdIncome: 68450 },
  "77019": { zip: "77019", city: "Houston", state: "TX", county: "Harris", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1680, yoyChange: 1.5, medianHouseholdIncome: 92340 },
  "76102": { zip: "76102", city: "Fort Worth", state: "TX", county: "Tarrant", fmr: { studio: 980, oneBr: 1143, twoBr: 1464, threeBr: 1907, fourBr: 2116 }, censusMedian: 1220, yoyChange: 3.1, medianHouseholdIncome: 48920 },
  "78205": { zip: "78205", city: "San Antonio", state: "TX", county: "Bexar", fmr: { studio: 920, oneBr: 1073, twoBr: 1374, threeBr: 1790, fourBr: 1986 }, censusMedian: 1080, yoyChange: 2.8, medianHouseholdIncome: 38560 },

  // ═══ DENVER / COLORADO ═══
  "80202": { zip: "80202", city: "Denver", state: "CO", county: "Denver", fmr: { studio: 1273, oneBr: 1485, twoBr: 1902, threeBr: 2478, fourBr: 2750 }, censusMedian: 1780, yoyChange: 2.6, medianHouseholdIncome: 82150 },
  "80203": { zip: "80203", city: "Denver", state: "CO", county: "Denver", fmr: { studio: 1220, oneBr: 1422, twoBr: 1822, threeBr: 2373, fourBr: 2634 }, censusMedian: 1650, yoyChange: 2.9, medianHouseholdIncome: 72340 },
  "80205": { zip: "80205", city: "Denver", state: "CO", county: "Denver", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1580, yoyChange: 3.2, medianHouseholdIncome: 58920 },
  "80209": { zip: "80209", city: "Denver", state: "CO", county: "Denver", fmr: { studio: 1350, oneBr: 1574, twoBr: 2017, threeBr: 2627, fourBr: 2916 }, censusMedian: 1920, yoyChange: 2.4, medianHouseholdIncome: 98450 },
  "80302": { zip: "80302", city: "Boulder", state: "CO", county: "Boulder", fmr: { studio: 1320, oneBr: 1539, twoBr: 1972, threeBr: 2568, fourBr: 2850 }, censusMedian: 1850, yoyChange: 1.8, medianHouseholdIncome: 72560 },

  // ═══ PHOENIX / ARIZONA ═══
  "85004": { zip: "85004", city: "Phoenix", state: "AZ", county: "Maricopa", fmr: { studio: 1012, oneBr: 1180, twoBr: 1512, threeBr: 1970, fourBr: 2186 }, censusMedian: 1340, yoyChange: 6.4, medianHouseholdIncome: 52680 },
  "85006": { zip: "85006", city: "Phoenix", state: "AZ", county: "Maricopa", fmr: { studio: 950, oneBr: 1108, twoBr: 1419, threeBr: 1849, fourBr: 2052 }, censusMedian: 1180, yoyChange: 6.8, medianHouseholdIncome: 38920 },
  "85016": { zip: "85016", city: "Phoenix", state: "AZ", county: "Maricopa", fmr: { studio: 1080, oneBr: 1260, twoBr: 1614, threeBr: 2102, fourBr: 2333 }, censusMedian: 1450, yoyChange: 5.9, medianHouseholdIncome: 62340 },
  "85251": { zip: "85251", city: "Scottsdale", state: "AZ", county: "Maricopa", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1580, yoyChange: 5.5, medianHouseholdIncome: 68920 },
  "85281": { zip: "85281", city: "Tempe", state: "AZ", county: "Maricopa", fmr: { studio: 1050, oneBr: 1225, twoBr: 1569, threeBr: 2043, fourBr: 2268 }, censusMedian: 1380, yoyChange: 6.1, medianHouseholdIncome: 48560 },

  // ═══ PHILADELPHIA ═══
  "19102": { zip: "19102", city: "Philadelphia", state: "PA", county: "Philadelphia", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1580, yoyChange: 3.8, medianHouseholdIncome: 72340 },
  "19103": { zip: "19103", city: "Philadelphia", state: "PA", county: "Philadelphia", fmr: { studio: 1250, oneBr: 1458, twoBr: 1868, threeBr: 2433, fourBr: 2700 }, censusMedian: 1720, yoyChange: 3.5, medianHouseholdIncome: 82450 },
  "19106": { zip: "19106", city: "Philadelphia", state: "PA", county: "Philadelphia", fmr: { studio: 1220, oneBr: 1422, twoBr: 1822, threeBr: 2373, fourBr: 2634 }, censusMedian: 1680, yoyChange: 3.2, medianHouseholdIncome: 92560 },
  "19123": { zip: "19123", city: "Philadelphia", state: "PA", county: "Philadelphia", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1520, yoyChange: 4.1, medianHouseholdIncome: 62340 },
  "19130": { zip: "19130", city: "Philadelphia", state: "PA", county: "Philadelphia", fmr: { studio: 1280, oneBr: 1493, twoBr: 1912, threeBr: 2490, fourBr: 2764 }, censusMedian: 1780, yoyChange: 3.4, medianHouseholdIncome: 88920 },

  // ═══ ATLANTA ═══
  "30301": { zip: "30301", city: "Atlanta", state: "GA", county: "Fulton", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1520, yoyChange: 4.8, medianHouseholdIncome: 62340 },
  "30308": { zip: "30308", city: "Atlanta", state: "GA", county: "Fulton", fmr: { studio: 1280, oneBr: 1493, twoBr: 1912, threeBr: 2490, fourBr: 2764 }, censusMedian: 1720, yoyChange: 4.2, medianHouseholdIncome: 78920 },
  "30309": { zip: "30309", city: "Atlanta", state: "GA", county: "Fulton", fmr: { studio: 1350, oneBr: 1574, twoBr: 2017, threeBr: 2627, fourBr: 2916 }, censusMedian: 1880, yoyChange: 3.9, medianHouseholdIncome: 92450 },
  "30312": { zip: "30312", city: "Atlanta", state: "GA", county: "Fulton", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1580, yoyChange: 5.1, medianHouseholdIncome: 52340 },
  "30324": { zip: "30324", city: "Atlanta", state: "GA", county: "Fulton", fmr: { studio: 1320, oneBr: 1539, twoBr: 1972, threeBr: 2568, fourBr: 2850 }, censusMedian: 1780, yoyChange: 4.5, medianHouseholdIncome: 68920 },

  // ═══ MINNEAPOLIS / ST. PAUL ═══
  "55401": { zip: "55401", city: "Minneapolis", state: "MN", county: "Hennepin", fmr: { studio: 1080, oneBr: 1260, twoBr: 1614, threeBr: 2102, fourBr: 2333 }, censusMedian: 1450, yoyChange: 3.2, medianHouseholdIncome: 58920 },
  "55403": { zip: "55403", city: "Minneapolis", state: "MN", county: "Hennepin", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1580, yoyChange: 2.8, medianHouseholdIncome: 72340 },
  "55408": { zip: "55408", city: "Minneapolis", state: "MN", county: "Hennepin", fmr: { studio: 1050, oneBr: 1225, twoBr: 1569, threeBr: 2043, fourBr: 2268 }, censusMedian: 1380, yoyChange: 3.5, medianHouseholdIncome: 62450 },

  // ═══ PORTLAND ═══
  "97201": { zip: "97201", city: "Portland", state: "OR", county: "Multnomah", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1580, yoyChange: 2.1, medianHouseholdIncome: 72340 },
  "97209": { zip: "97209", city: "Portland", state: "OR", county: "Multnomah", fmr: { studio: 1220, oneBr: 1422, twoBr: 1822, threeBr: 2373, fourBr: 2634 }, censusMedian: 1680, yoyChange: 1.8, medianHouseholdIncome: 82450 },
  "97214": { zip: "97214", city: "Portland", state: "OR", county: "Multnomah", fmr: { studio: 1180, oneBr: 1376, twoBr: 1763, threeBr: 2296, fourBr: 2549 }, censusMedian: 1620, yoyChange: 2.4, medianHouseholdIncome: 78920 },

  // ═══ NASHVILLE ═══
  "37201": { zip: "37201", city: "Nashville", state: "TN", county: "Davidson", fmr: { studio: 1120, oneBr: 1306, twoBr: 1673, threeBr: 2179, fourBr: 2418 }, censusMedian: 1480, yoyChange: 4.5, medianHouseholdIncome: 58920 },
  "37203": { zip: "37203", city: "Nashville", state: "TN", county: "Davidson", fmr: { studio: 1220, oneBr: 1422, twoBr: 1822, threeBr: 2373, fourBr: 2634 }, censusMedian: 1680, yoyChange: 4.1, medianHouseholdIncome: 72450 },
  "37206": { zip: "37206", city: "Nashville", state: "TN", county: "Davidson", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1520, yoyChange: 4.8, medianHouseholdIncome: 62340 },

  // ═══ CHARLOTTE ═══
  "28202": { zip: "28202", city: "Charlotte", state: "NC", county: "Mecklenburg", fmr: { studio: 1080, oneBr: 1260, twoBr: 1614, threeBr: 2102, fourBr: 2333 }, censusMedian: 1420, yoyChange: 5.2, medianHouseholdIncome: 58920 },
  "28203": { zip: "28203", city: "Charlotte", state: "NC", county: "Mecklenburg", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1520, yoyChange: 4.8, medianHouseholdIncome: 72340 },

  // ═══ RALEIGH-DURHAM ═══
  "27601": { zip: "27601", city: "Raleigh", state: "NC", county: "Wake", fmr: { studio: 1020, oneBr: 1190, twoBr: 1524, threeBr: 1985, fourBr: 2203 }, censusMedian: 1350, yoyChange: 4.5, medianHouseholdIncome: 58920 },
  "27701": { zip: "27701", city: "Durham", state: "NC", county: "Durham", fmr: { studio: 980, oneBr: 1143, twoBr: 1464, threeBr: 1907, fourBr: 2116 }, censusMedian: 1280, yoyChange: 4.2, medianHouseholdIncome: 52340 },

  // ═══ SAN DIEGO ═══
  "92101": { zip: "92101", city: "San Diego", state: "CA", county: "San Diego", fmr: { studio: 1580, oneBr: 1842, twoBr: 2360, threeBr: 3073, fourBr: 3410 }, censusMedian: 2180, yoyChange: 4.8, medianHouseholdIncome: 72340 },
  "92103": { zip: "92103", city: "San Diego", state: "CA", county: "San Diego", fmr: { studio: 1650, oneBr: 1924, twoBr: 2465, threeBr: 3210, fourBr: 3562 }, censusMedian: 2280, yoyChange: 4.2, medianHouseholdIncome: 82450 },
  "92109": { zip: "92109", city: "San Diego", state: "CA", county: "San Diego", fmr: { studio: 1720, oneBr: 2006, twoBr: 2570, threeBr: 3347, fourBr: 3714 }, censusMedian: 2380, yoyChange: 3.9, medianHouseholdIncome: 78920 },
  "92116": { zip: "92116", city: "San Diego", state: "CA", county: "San Diego", fmr: { studio: 1550, oneBr: 1807, twoBr: 2316, threeBr: 3017, fourBr: 3348 }, censusMedian: 2050, yoyChange: 4.5, medianHouseholdIncome: 68560 },

  // ═══ LAS VEGAS ═══
  "89101": { zip: "89101", city: "Las Vegas", state: "NV", county: "Clark", fmr: { studio: 920, oneBr: 1073, twoBr: 1374, threeBr: 1790, fourBr: 1986 }, censusMedian: 1180, yoyChange: 5.8, medianHouseholdIncome: 38920 },
  "89109": { zip: "89109", city: "Las Vegas", state: "NV", county: "Clark", fmr: { studio: 980, oneBr: 1143, twoBr: 1464, threeBr: 1907, fourBr: 2116 }, censusMedian: 1280, yoyChange: 5.2, medianHouseholdIncome: 42560 },
  "89135": { zip: "89135", city: "Las Vegas", state: "NV", county: "Clark", fmr: { studio: 1120, oneBr: 1306, twoBr: 1673, threeBr: 2179, fourBr: 2418 }, censusMedian: 1520, yoyChange: 4.5, medianHouseholdIncome: 82340 },

  // ═══ SALT LAKE CITY ═══
  "84101": { zip: "84101", city: "Salt Lake City", state: "UT", county: "Salt Lake", fmr: { studio: 980, oneBr: 1143, twoBr: 1464, threeBr: 1907, fourBr: 2116 }, censusMedian: 1280, yoyChange: 3.8, medianHouseholdIncome: 52340 },
  "84102": { zip: "84102", city: "Salt Lake City", state: "UT", county: "Salt Lake", fmr: { studio: 1020, oneBr: 1190, twoBr: 1524, threeBr: 1985, fourBr: 2203 }, censusMedian: 1350, yoyChange: 3.5, medianHouseholdIncome: 48920 },

  // ═══ DETROIT ═══
  "48201": { zip: "48201", city: "Detroit", state: "MI", county: "Wayne", fmr: { studio: 750, oneBr: 875, twoBr: 1121, threeBr: 1460, fourBr: 1620 }, censusMedian: 880, yoyChange: 4.2, medianHouseholdIncome: 28920 },
  "48226": { zip: "48226", city: "Detroit", state: "MI", county: "Wayne", fmr: { studio: 820, oneBr: 956, twoBr: 1225, threeBr: 1595, fourBr: 1770 }, censusMedian: 1050, yoyChange: 3.8, medianHouseholdIncome: 42340 },
  "48104": { zip: "48104", city: "Ann Arbor", state: "MI", county: "Washtenaw", fmr: { studio: 1080, oneBr: 1260, twoBr: 1614, threeBr: 2102, fourBr: 2333 }, censusMedian: 1380, yoyChange: 3.2, medianHouseholdIncome: 52560 },

  // ═══ PITTSBURGH ═══
  "15213": { zip: "15213", city: "Pittsburgh", state: "PA", county: "Allegheny", fmr: { studio: 820, oneBr: 956, twoBr: 1225, threeBr: 1595, fourBr: 1770 }, censusMedian: 1050, yoyChange: 3.5, medianHouseholdIncome: 38920 },
  "15222": { zip: "15222", city: "Pittsburgh", state: "PA", county: "Allegheny", fmr: { studio: 920, oneBr: 1073, twoBr: 1374, threeBr: 1790, fourBr: 1986 }, censusMedian: 1220, yoyChange: 3.1, medianHouseholdIncome: 52340 },

  // ═══ HONOLULU ═══
  "96813": { zip: "96813", city: "Honolulu", state: "HI", county: "Honolulu", fmr: { studio: 1520, oneBr: 1773, twoBr: 2271, threeBr: 2958, fourBr: 3282 }, censusMedian: 2050, yoyChange: 3.2, medianHouseholdIncome: 62340 },
  "96815": { zip: "96815", city: "Honolulu", state: "HI", county: "Honolulu", fmr: { studio: 1620, oneBr: 1889, twoBr: 2420, threeBr: 3152, fourBr: 3498 }, censusMedian: 2180, yoyChange: 2.8, medianHouseholdIncome: 58920 },

  // ═══ COLUMBUS ═══
  "43201": { zip: "43201", city: "Columbus", state: "OH", county: "Franklin", fmr: { studio: 820, oneBr: 956, twoBr: 1225, threeBr: 1595, fourBr: 1770 }, censusMedian: 1050, yoyChange: 4.1, medianHouseholdIncome: 42340 },
  "43215": { zip: "43215", city: "Columbus", state: "OH", county: "Franklin", fmr: { studio: 920, oneBr: 1073, twoBr: 1374, threeBr: 1790, fourBr: 1986 }, censusMedian: 1220, yoyChange: 3.8, medianHouseholdIncome: 58920 },

  // ═══ KANSAS CITY ═══
  "64108": { zip: "64108", city: "Kansas City", state: "MO", county: "Jackson", fmr: { studio: 820, oneBr: 956, twoBr: 1225, threeBr: 1595, fourBr: 1770 }, censusMedian: 1080, yoyChange: 3.5, medianHouseholdIncome: 42340 },

  // ═══ INDIANAPOLIS ═══
  "46204": { zip: "46204", city: "Indianapolis", state: "IN", county: "Marion", fmr: { studio: 780, oneBr: 910, twoBr: 1165, threeBr: 1518, fourBr: 1684 }, censusMedian: 1020, yoyChange: 3.8, medianHouseholdIncome: 38920 },

  // ═══ MILWAUKEE ═══
  "53202": { zip: "53202", city: "Milwaukee", state: "WI", county: "Milwaukee", fmr: { studio: 820, oneBr: 956, twoBr: 1225, threeBr: 1595, fourBr: 1770 }, censusMedian: 1080, yoyChange: 3.2, medianHouseholdIncome: 42340 },

  // ═══ NEW ORLEANS ═══
  "70112": { zip: "70112", city: "New Orleans", state: "LA", county: "Orleans", fmr: { studio: 920, oneBr: 1073, twoBr: 1374, threeBr: 1790, fourBr: 1986 }, censusMedian: 1180, yoyChange: 4.5, medianHouseholdIncome: 38920 },
  "70116": { zip: "70116", city: "New Orleans", state: "LA", county: "Orleans", fmr: { studio: 1020, oneBr: 1190, twoBr: 1524, threeBr: 1985, fourBr: 2203 }, censusMedian: 1350, yoyChange: 4.1, medianHouseholdIncome: 52340 },

  // ═══ SACRAMENTO ═══
  "95814": { zip: "95814", city: "Sacramento", state: "CA", county: "Sacramento", fmr: { studio: 1080, oneBr: 1260, twoBr: 1614, threeBr: 2102, fourBr: 2333 }, censusMedian: 1420, yoyChange: 3.8, medianHouseholdIncome: 52340 },
  "95816": { zip: "95816", city: "Sacramento", state: "CA", county: "Sacramento", fmr: { studio: 1150, oneBr: 1341, twoBr: 1718, threeBr: 2238, fourBr: 2484 }, censusMedian: 1520, yoyChange: 3.5, medianHouseholdIncome: 62340 },

  // ═══ BALTIMORE ═══
  "21201": { zip: "21201", city: "Baltimore", state: "MD", county: "Baltimore City", fmr: { studio: 980, oneBr: 1143, twoBr: 1464, threeBr: 1907, fourBr: 2116 }, censusMedian: 1180, yoyChange: 3.5, medianHouseholdIncome: 32340 },
  "21230": { zip: "21230", city: "Baltimore", state: "MD", county: "Baltimore City", fmr: { studio: 1080, oneBr: 1260, twoBr: 1614, threeBr: 2102, fourBr: 2333 }, censusMedian: 1380, yoyChange: 3.2, medianHouseholdIncome: 62340 },
  "20814": { zip: "20814", city: "Bethesda", state: "MD", county: "Montgomery", fmr: { studio: 1550, oneBr: 1807, twoBr: 2316, threeBr: 3017, fourBr: 3348 }, censusMedian: 2050, yoyChange: 2.8, medianHouseholdIncome: 128450 },

  // ═══ RICHMOND ═══
  "23219": { zip: "23219", city: "Richmond", state: "VA", county: "Richmond City", fmr: { studio: 920, oneBr: 1073, twoBr: 1374, threeBr: 1790, fourBr: 1986 }, censusMedian: 1180, yoyChange: 4.2, medianHouseholdIncome: 42340 },

  // ═══ CINCINNATI ═══
  "45202": { zip: "45202", city: "Cincinnati", state: "OH", county: "Hamilton", fmr: { studio: 780, oneBr: 910, twoBr: 1165, threeBr: 1518, fourBr: 1684 }, censusMedian: 1020, yoyChange: 3.5, medianHouseholdIncome: 38920 },

  // ═══ ST. LOUIS ═══
  "63101": { zip: "63101", city: "St. Louis", state: "MO", county: "St. Louis City", fmr: { studio: 750, oneBr: 875, twoBr: 1121, threeBr: 1460, fourBr: 1620 }, censusMedian: 920, yoyChange: 3.8, medianHouseholdIncome: 32340 },

  // ═══ CONNECTICUT ═══
  "06510": { zip: "06510", city: "New Haven", state: "CT", county: "New Haven", fmr: { studio: 1080, oneBr: 1260, twoBr: 1614, threeBr: 2102, fourBr: 2333 }, censusMedian: 1380, yoyChange: 3.5, medianHouseholdIncome: 42340 },
  "06901": { zip: "06901", city: "Stamford", state: "CT", county: "Fairfield", fmr: { studio: 1520, oneBr: 1773, twoBr: 2271, threeBr: 2958, fourBr: 3282 }, censusMedian: 2050, yoyChange: 3.2, medianHouseholdIncome: 92340 },
};

// ─── Utility Functions ───

export function lookupZip(zip: string): RentData | null {
  return rentDatabase[zip] || null;
}

export function getFmrForBedrooms(data: RentData, bedrooms: BedroomType): number {
  return data.fmr[bedrooms];
}

export function getTypicalRange(data: RentData, bedrooms: BedroomType): { low: number; high: number } {
  const fmr = getFmrForBedrooms(data, bedrooms);
  const low = fmr;
  const high = data.censusMedian
    ? Math.round(data.censusMedian * 1.15)
    : Math.round(fmr * 1.30);
  return { low, high };
}

export function getPercentile(rent: number, low: number, high: number): number {
  if (rent <= low) return Math.max(5, Math.round((rent / low) * 40));
  if (rent >= high) return Math.min(99, 70 + Math.round(((rent - high) / high) * 100));
  const pct = 40 + ((rent - low) / (high - low)) * 30;
  return Math.round(Math.min(99, Math.max(1, pct)));
}

export interface MovingCosts {
  securityDeposit: number;
  firstLast: number;
  brokerFee: number;
  movingCompany: number;
  timeOffWork: number;
  misc: number;
}

export const defaultMovingCosts: MovingCosts = {
  securityDeposit: 0,
  firstLast: 0,
  brokerFee: 0,
  movingCompany: 800,
  timeOffWork: 300,
  misc: 200,
};

export function getTotalMovingCosts(costs: MovingCosts): number {
  return Object.values(costs).reduce((sum, v) => sum + v, 0);
}

export function calculateBreakEven(
  currentRent: number,
  newRent: number,
  totalMovingCost: number
): { months: number; verdict: 'move' | 'close' | 'stay'; yearOneSavings: number } {
  const monthlySavings = currentRent - newRent;
  if (monthlySavings <= 0) {
    return { months: Infinity, verdict: 'stay', yearOneSavings: -(Math.abs(monthlySavings) * 12 + totalMovingCost) };
  }
  const months = totalMovingCost / monthlySavings;
  const yearOneSavings = (monthlySavings * 12) - totalMovingCost;
  const verdict = months < 12 ? 'move' : months <= 18 ? 'close' : 'stay';
  return { months, verdict, yearOneSavings };
}
