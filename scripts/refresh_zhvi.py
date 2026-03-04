#!/usr/bin/env python3
"""
RenewalReply — ZHVI (Zillow Home Value Index) Refresh Script
Run monthly. Merges home value trend data into zhvi_processed.json.

Input:  Zillow ZHVI CSV (download from zillow.com/research/data/)
        Expected at: scripts/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv
        OR auto-downloads if not present.

Output: public/data/zhvi_processed.json  (keyed by ZIP)

Fields per ZIP:
  hvy = YoY % change in home values
  hvm = MoM % change
  hvt = 3-month trailing average MoM (annualized)
  hvd = 'rising' | 'falling' | 'flat'
"""

import csv, json, os, sys
from urllib.request import urlretrieve

ZHVI_URL = "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "zhvi_processed.json")


def safe_float(val):
    """Parse a CSV cell as float, return None if empty/invalid."""
    if val is None:
        return None
    val = str(val).strip()
    if not val:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def main():
    # Download if not present
    if not os.path.exists(CSV_PATH):
        print(f"Downloading ZHVI CSV...")
        urlretrieve(ZHVI_URL, CSV_PATH)
        print(f"  Saved to {CSV_PATH}")
    else:
        print(f"Using existing {CSV_PATH}")

    # Parse headers to find date columns
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)

    # Find the RegionName column (ZIP code)
    header_lower = [h.strip().lower() for h in headers]
    try:
        col_zip = header_lower.index("regionname")
    except ValueError:
        # Fallback: try other common names
        for candidate in ["region name", "zip", "zipcode", "zcta"]:
            if candidate in header_lower:
                col_zip = header_lower.index(candidate)
                break
        else:
            print("ERROR: Could not find ZIP/RegionName column. Headers:")
            for i, h in enumerate(headers[:15]):
                print(f"  [{i}] {h}")
            sys.exit(1)

    # Date columns start after the metadata columns (typically index 5+)
    # They look like "2000-01-31", "2000-02-29", etc.
    date_cols = []
    for i, h in enumerate(headers):
        h_stripped = h.strip()
        if len(h_stripped) == 10 and h_stripped[4] == '-' and h_stripped[7] == '-':
            date_cols.append(i)

    if len(date_cols) < 13:
        print(f"ERROR: Found only {len(date_cols)} date columns, need at least 13.")
        sys.exit(1)

    li = date_cols[-1]  # latest
    m1 = date_cols[-2] if len(date_cols) >= 2 else None  # 1 month ago
    m3 = date_cols[-4] if len(date_cols) >= 4 else None  # 3 months ago
    yr = date_cols[-13] if len(date_cols) >= 13 else None  # 12 months ago

    print(f"  Latest column: {headers[li]}")
    print(f"  1mo ago: {headers[m1] if m1 else 'N/A'}")
    print(f"  3mo ago: {headers[m3] if m3 else 'N/A'}")
    print(f"  12mo ago: {headers[yr] if yr else 'N/A'}")

    # Parse data
    zhvi = {}
    rows_read = 0
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            rows_read += 1
            z = str(row[col_zip]).strip().zfill(5)
            if len(z) != 5 or not z.isdigit():
                continue

            latest = safe_float(row[li])
            if latest is None or latest <= 0:
                continue

            val_1m = safe_float(row[m1]) if m1 else None
            val_3m = safe_float(row[m3]) if m3 else None
            val_yr = safe_float(row[yr]) if yr else None

            hvy = None
            if val_yr and val_yr > 0:
                hvy = round(((latest - val_yr) / val_yr) * 100, 1)
                hvy = max(-50, min(50, hvy))  # cap extreme values

            hvm = None
            if val_1m and val_1m > 0:
                hvm = round(((latest - val_1m) / val_1m) * 100, 2)

            hvt = None
            if val_3m and val_3m > 0:
                hvt = round(((latest - val_3m) / val_3m) * 4 * 100, 1)

            # Direction based on 3-month annualized trend
            if hvt is not None:
                if hvt > 1:
                    hvd = 'rising'
                elif hvt < -1:
                    hvd = 'falling'
                else:
                    hvd = 'flat'
            elif hvm is not None:
                if hvm > 0.1:
                    hvd = 'rising'
                elif hvm < -0.1:
                    hvd = 'falling'
                else:
                    hvd = 'flat'
            else:
                hvd = None

            entry = {}
            if hvy is not None:
                entry['hvy'] = hvy
            if hvm is not None:
                entry['hvm'] = hvm
            if hvt is not None:
                entry['hvt'] = hvt
            if hvd is not None:
                entry['hvd'] = hvd

            if entry:
                zhvi[z] = entry

    print(f"\n  Rows read: {rows_read}")
    print(f"  ZIPs with ZHVI data: {len(zhvi)}")

    # Write output
    with open(OUTPUT_PATH, "w") as f:
        json.dump(zhvi, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"  Wrote {OUTPUT_PATH} ({size_kb:.0f} KB)")

    # Show sample
    print(f"\n  Sample entries (first 5):")
    for z in sorted(zhvi.keys())[:5]:
        print(f"    {z}: {zhvi[z]}")

    print(f"\n  Done! ZHVI data refreshed for {len(zhvi)} ZIPs.")
    print(f"  Update public/data/data_freshness.json with today's date for zillow_zhvi.")


if __name__ == "__main__":
    main()
