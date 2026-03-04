#!/usr/bin/env python3
"""
RenewalReply — HUD 50th Percentile Rent Refresh Script
Run annually (October). Merges HUD 50th percentile (median) rents into hud50_processed.json.

Input:  scripts/hud_50pct_fy2026.xlsx  (from huduser.gov/portal/datasets/50per.html)
        public/data/tab20_zcta520_county20_natl.txt  (Census ZCTA-to-county crosswalk)

Output: public/data/hud50_processed.json  (keyed by ZIP)

Fields per ZIP:
  f50 = [studio, 1br, 2br, 3br, 4br]  (50th percentile rent by bedroom count)
"""

import csv, json, os, sys

try:
    import openpyxl
except ImportError:
    print("Install openpyxl first:  pip install openpyxl")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "public", "data")
EXCEL_PATH = os.path.join(SCRIPT_DIR, "hud_50pct_fy2026.xlsx")
CROSSWALK_PATH = os.path.join(DATA_DIR, "tab20_zcta520_county20_natl.txt")
OUTPUT_PATH = os.path.join(DATA_DIR, "hud50_processed.json")


def safe_float(val):
    if val is None:
        return None
    val = str(val).strip()
    if not val or val.lower() in ('na', 'nan', 'null', '.', '-'):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    f = safe_float(val)
    return int(f) if f is not None else 0


def load_crosswalk():
    """Parse Census ZCTA-to-county crosswalk. Returns ZIP → county_fips (largest pop overlap)."""
    if not os.path.exists(CROSSWALK_PATH):
        print(f"ERROR: Crosswalk not found: {CROSSWALK_PATH}")
        print("  Download from: https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/")
        sys.exit(1)

    print("Loading Census ZCTA-to-county crosswalk...")
    zip_county = {}

    with open(CROSSWALK_PATH, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter='|')
        header = next(reader)
        header_lower = [h.strip().lower() for h in header]

        col_zcta = None
        col_county = None
        col_pop = None

        for i, h in enumerate(header_lower):
            if 'zcta' in h:
                col_zcta = i
            elif 'geoid_county' in h or h == 'county':
                col_county = i
            elif h in ('poppt', 'pop_pct', 'zpoppct'):
                col_pop = i

        if col_zcta is None:
            col_zcta = 0
        if col_county is None:
            for i, h in enumerate(header_lower):
                if 'county' in h or 'geoid' in h:
                    col_county = i
                    break
            if col_county is None:
                print(f"  ERROR: Cannot find county column. Headers: {header}")
                sys.exit(1)

        for row in reader:
            if len(row) <= max(col_zcta, col_county):
                continue
            zcta = str(row[col_zcta]).strip().zfill(5)
            county_fips = str(row[col_county]).strip().zfill(5)
            if len(zcta) != 5 or not zcta.isdigit():
                continue
            pop = safe_float(row[col_pop]) if col_pop is not None and col_pop < len(row) else 0
            pop = pop or 0
            if zcta not in zip_county or pop > zip_county[zcta][1]:
                zip_county[zcta] = (county_fips, pop)

    result = {z: fips for z, (fips, _) in zip_county.items()}
    print(f"  Loaded {len(result)} ZCTA → county mappings.")
    return result


def parse_hud50_excel():
    """
    Parse HUD 50th percentile Excel file.
    Returns: fmr_area_code → [studio, 1br, 2br, 3br, 4br] and
             county_fips → fmr_area_code mapping.
    
    The HUD 50th percentile file is keyed by FMR area (FIPS-based).
    We need to map: ZIP → county FIPS → FMR area → rents.
    
    Some FMR areas ARE counties (5-digit FIPS), others are metro areas (CBSA codes).
    We extract both the area code and the FIPS to build the lookup.
    """
    if not os.path.exists(EXCEL_PATH):
        print(f"ERROR: {EXCEL_PATH} not found.")
        print("  Download from: https://www.huduser.gov/portal/datasets/50per.html")
        print("  Save as: scripts/hud_50pct_fy2026.xlsx")
        sys.exit(1)

    print(f"Parsing HUD 50th percentile Excel ({EXCEL_PATH})...")
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    header_lower = [str(h).strip().lower() if h else "" for h in header]

    def find_col(*candidates):
        for c in candidates:
            c_lower = c.lower()
            for i, h in enumerate(header_lower):
                if c_lower in h:
                    return i
        return None

    # Find key columns
    col_fips = find_col("fips", "fips_code", "county_fips", "state_county_fips", "fmr_area_code", "code")
    col_state = find_col("state", "stusab", "st")
    col_name = find_col("areaname", "area_name", "name", "county_name")
    col_0br = find_col("rent50_0", "50th_0br", "50rent_0", "0br", "eff", "rent_50_0")
    col_1br = find_col("rent50_1", "50th_1br", "50rent_1", "1br", "rent_50_1")
    col_2br = find_col("rent50_2", "50th_2br", "50rent_2", "2br", "rent_50_2")
    col_3br = find_col("rent50_3", "50th_3br", "50rent_3", "3br", "rent_50_3")
    col_4br = find_col("rent50_4", "50th_4br", "50rent_4", "4br", "rent_50_4")

    if col_fips is None:
        print("  Could not find FIPS/area code column. Headers:")
        for i, h in enumerate(header):
            print(f"    [{i}] {repr(h)}")
        sys.exit(1)

    if col_0br is None:
        print("  Could not find rent columns. Headers:")
        for i, h in enumerate(header):
            print(f"    [{i}] {repr(h)}")
        sys.exit(1)

    print(f"  FIPS col: {col_fips} ({header[col_fips]})")
    print(f"  Rent cols: 0BR={col_0br}, 1BR={col_1br}, 2BR={col_2br}, 3BR={col_3br}, 4BR={col_4br}")

    # Parse: build fips_code → f50 lookup
    # HUD uses various FIPS formats — we normalize to 5-digit county FIPS where possible
    area_data = {}
    for row in rows:
        fips_raw = str(row[col_fips] or "").strip()
        if not fips_raw:
            continue

        f50 = [
            safe_int(row[col_0br]),
            safe_int(row[col_1br]) if col_1br is not None else 0,
            safe_int(row[col_2br]) if col_2br is not None else 0,
            safe_int(row[col_3br]) if col_3br is not None else 0,
            safe_int(row[col_4br]) if col_4br is not None else 0,
        ]

        if all(v == 0 for v in f50):
            continue

        # Normalize FIPS: some are state+county (e.g., "36061"), some are longer FMR area codes
        # Store under all plausible keys
        # Remove any non-numeric characters
        fips_clean = ''.join(c for c in fips_raw if c.isdigit())

        if len(fips_clean) >= 5:
            # Could be a county FIPS (first 5 digits)
            county_key = fips_clean[:5]
            area_data[county_key] = f50

        # Also store under full code for metro areas
        area_data[fips_clean] = f50

    wb.close()
    print(f"  Parsed {len(area_data)} FMR area entries.")
    return area_data


def main():
    print("RenewalReply — HUD 50th Percentile Rent Refresh\n")

    # 1. Load crosswalk
    zip_to_county = load_crosswalk()

    # 2. Parse HUD 50th percentile Excel
    area_data = parse_hud50_excel()

    # 3. Build ZIP-level lookup
    print(f"\nMerging county data to ZIP level...")
    hud50_by_zip = {}
    matched = 0
    unmatched = 0

    for z, county_fips in zip_to_county.items():
        f50 = area_data.get(county_fips)
        if f50 is not None:
            hud50_by_zip[z] = {"f50": f50}
            matched += 1
        else:
            unmatched += 1

    print(f"  ZIPs with HUD 50th pct data: {matched}")
    print(f"  ZIPs without (no county match): {unmatched}")

    # 4. Write output
    with open(OUTPUT_PATH, "w") as f:
        json.dump(hud50_by_zip, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n  Wrote {OUTPUT_PATH} ({size_kb:.0f} KB)")

    # Show sample
    print(f"\n  Sample entries (first 5):")
    for z in sorted(hud50_by_zip.keys())[:5]:
        print(f"    {z}: f50={hud50_by_zip[z]['f50']}")

    print(f"\n  Done! HUD 50th percentile data refreshed for {len(hud50_by_zip)} ZIPs.")
    print(f"  Update public/data/data_freshness.json with today's date for hud_50pct.")


if __name__ == "__main__":
    main()
