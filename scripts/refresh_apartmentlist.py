#!/usr/bin/env python3
"""
RenewalReply — Apartment List Data Refresh Script
Run monthly. Merges Apartment List rent trends into apartmentlist_processed.json.

Input files (all in public/data/apartmentlist/):
  - rent_estimates_summary.csv  (rent YoY, MoM, estimate by county)
  - vacancy_index.csv           (monthly vacancy by county)
  - time_on_market.csv          (monthly time-on-market by county)

Crosswalk:
  - public/data/tab20_zcta520_county20_natl.txt  (Census ZCTA-to-county, pipe-delimited)

Output: public/data/apartmentlist_processed.json  (keyed by ZIP)

Fields per ZIP:
  aly = YoY rent growth %
  alm = MoM rent growth %
  alv = Vacancy rate %
  alt = Time on market (days)
  alr = County name (for attribution)
"""

import csv, json, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "public", "data")
AL_DIR = os.path.join(DATA_DIR, "apartmentlist")
CROSSWALK_PATH = os.path.join(DATA_DIR, "tab20_zcta520_county20_natl.txt")
OUTPUT_PATH = os.path.join(DATA_DIR, "apartmentlist_processed.json")


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


def load_crosswalk():
    """
    Parse Census ZCTA-to-county crosswalk (pipe-delimited).
    Maps each ZCTA to the county with the largest population overlap.
    Expected columns: ZCTA5, STATE, COUNTY (or GEOID), POPPT, etc.
    """
    if not os.path.exists(CROSSWALK_PATH):
        print(f"ERROR: Crosswalk file not found: {CROSSWALK_PATH}")
        print("  Download from: https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/")
        print("  File: tab20_zcta520_county20_natl.txt")
        sys.exit(1)

    print(f"Loading Census ZCTA-to-county crosswalk...")
    zip_county = {}  # zip -> (county_fips, max_pop)

    with open(CROSSWALK_PATH, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter='|')
        header = next(reader)
        header_lower = [h.strip().lower() for h in header]

        # Find columns — Census crosswalk has: ZCTA5, GEOID_COUNTY_20, AREALAND_PART, AREAWATER_PART, POPPT, HUPT
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
            # Try positional — first column is often ZCTA
            print("  Warning: Could not find ZCTA column by name, trying positional.")
            print(f"  Headers: {header}")
            col_zcta = 0

        if col_county is None:
            # Try finding any column with 'county' or 'geoid'
            for i, h in enumerate(header_lower):
                if 'county' in h or 'geoid' in h:
                    col_county = i
                    break
            if col_county is None:
                print(f"  ERROR: Cannot find county FIPS column. Headers: {header}")
                sys.exit(1)

        if col_pop is None:
            # Try POPPT or any population column
            for i, h in enumerate(header_lower):
                if 'pop' in h:
                    col_pop = i
                    break

        print(f"  ZCTA col: {col_zcta} ({header[col_zcta]})")
        print(f"  County col: {col_county} ({header[col_county]})")
        print(f"  Pop col: {col_pop} ({header[col_pop] if col_pop is not None else 'NOT FOUND'})")

        for row in reader:
            if len(row) <= max(col_zcta, col_county):
                continue
            zcta = str(row[col_zcta]).strip().zfill(5)
            county_fips = str(row[col_county]).strip().zfill(5)

            if len(zcta) != 5 or not zcta.isdigit():
                continue

            pop = 0
            if col_pop is not None and col_pop < len(row):
                pop = safe_float(row[col_pop]) or 0

            if zcta not in zip_county or pop > zip_county[zcta][1]:
                zip_county[zcta] = (county_fips, pop)

    result = {z: fips for z, (fips, _) in zip_county.items()}
    print(f"  Loaded {len(result)} ZCTA → county mappings.")
    return result


def load_rent_summary():
    """Parse Apartment List rent estimate summary CSV."""
    candidates = [
        os.path.join(AL_DIR, "rent_estimates_summary.csv"),
        os.path.join(AL_DIR, "Apartment_List_Rent_Estimate_Summary.csv"),
    ]
    path = None
    for c in candidates:
        if os.path.exists(c):
            path = c
            break

    if path is None:
        print(f"  WARNING: No rent summary CSV found in {AL_DIR}")
        print(f"  Looked for: {[os.path.basename(c) for c in candidates]}")
        return {}

    print(f"  Loading rent summary: {os.path.basename(path)}")
    county_data = {}

    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames or []
        fields_lower = {f.lower().strip(): f for f in fields}

        # Find column names (Apartment List uses varying names)
        def find_field(*candidates):
            for c in candidates:
                c_lower = c.lower()
                for fl, fo in fields_lower.items():
                    if c_lower in fl:
                        return fo
            return None

        f_type = find_field('location_type', 'geo_type', 'type')
        f_fips = find_field('location_fips', 'fips', 'geo_fips')
        f_name = find_field('location_name', 'name', 'geo_name')
        f_yoy = find_field('rent_yoy', 'yoy', 'rent_growth_yoy')
        f_mom = find_field('rent_mom', 'mom', 'rent_growth_mom')
        f_est = find_field('rent_estimate', 'median_rent', 'rent')

        if f_fips is None:
            print(f"    ERROR: Cannot find FIPS column. Fields: {fields}")
            return {}

        for row in reader:
            # Filter to county-level rows
            loc_type = (row.get(f_type, '') or '').strip().lower()
            if f_type and loc_type not in ('county', 'counties'):
                continue

            fips = str(row.get(f_fips, '') or '').strip().zfill(5)
            if len(fips) != 5 or not fips.isdigit():
                continue

            entry = {}
            if f_yoy:
                v = safe_float(row.get(f_yoy))
                if v is not None:
                    entry['aly'] = round(v * 100, 1) if abs(v) < 1 else round(v, 1)
            if f_mom:
                v = safe_float(row.get(f_mom))
                if v is not None:
                    entry['alm'] = round(v * 100, 2) if abs(v) < 1 else round(v, 2)
            if f_est:
                v = safe_float(row.get(f_est))
                if v is not None:
                    entry['alr'] = str(row.get(f_name, '')).strip()

            if entry:
                county_data[fips] = entry

    print(f"    Loaded {len(county_data)} counties with rent data.")
    return county_data


def load_vacancy():
    """Parse Apartment List vacancy index CSV. Return county_fips → latest vacancy %."""
    candidates = [
        os.path.join(AL_DIR, "vacancy_index.csv"),
        os.path.join(AL_DIR, "Apartment_List_Vacancy_Index.csv"),
    ]
    path = None
    for c in candidates:
        if os.path.exists(c):
            path = c
            break

    if path is None:
        print(f"  WARNING: No vacancy CSV found in {AL_DIR}")
        return {}

    print(f"  Loading vacancy: {os.path.basename(path)}")
    result = {}

    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)
        header_lower = [h.strip().lower() for h in headers]

        # Find FIPS and type columns
        col_fips = None
        col_type = None
        for i, h in enumerate(header_lower):
            if 'fips' in h:
                col_fips = i
            elif 'type' in h or 'geo_type' in h:
                col_type = i

        if col_fips is None:
            print(f"    ERROR: Cannot find FIPS column. Headers: {headers[:10]}")
            return {}

        # Date columns: find the last one
        date_cols = []
        for i, h in enumerate(headers):
            h_stripped = h.strip()
            # Match patterns like "2024-01", "2024-01-01", "Jan 2024"
            if any(c.isdigit() for c in h_stripped) and i > col_fips:
                date_cols.append(i)

        if not date_cols:
            print(f"    WARNING: No date columns found in vacancy CSV.")
            return {}

        latest_col = date_cols[-1]
        print(f"    Latest vacancy column: {headers[latest_col]}")

        for row in reader:
            if col_type is not None and row[col_type].strip().lower() not in ('county', 'counties', ''):
                continue
            fips = str(row[col_fips]).strip().zfill(5)
            if len(fips) != 5 or not fips.isdigit():
                continue
            val = safe_float(row[latest_col]) if latest_col < len(row) else None
            if val is not None:
                result[fips] = round(val, 1)

    print(f"    Loaded vacancy for {len(result)} counties.")
    return result


def load_time_on_market():
    """Parse Apartment List time-on-market CSV. Return county_fips → latest days."""
    candidates = [
        os.path.join(AL_DIR, "time_on_market.csv"),
        os.path.join(AL_DIR, "Apartment_List_Time_On_Market.csv"),
    ]
    path = None
    for c in candidates:
        if os.path.exists(c):
            path = c
            break

    if path is None:
        print(f"  WARNING: No time-on-market CSV found in {AL_DIR}")
        return {}

    print(f"  Loading time on market: {os.path.basename(path)}")
    result = {}

    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)
        header_lower = [h.strip().lower() for h in headers]

        col_fips = None
        col_type = None
        for i, h in enumerate(header_lower):
            if 'fips' in h:
                col_fips = i
            elif 'type' in h or 'geo_type' in h:
                col_type = i

        if col_fips is None:
            print(f"    ERROR: Cannot find FIPS column. Headers: {headers[:10]}")
            return {}

        date_cols = [i for i, h in enumerate(headers) if any(c.isdigit() for c in h.strip()) and i > col_fips]
        if not date_cols:
            print(f"    WARNING: No date columns found.")
            return {}

        latest_col = date_cols[-1]
        print(f"    Latest column: {headers[latest_col]}")

        for row in reader:
            if col_type is not None and row[col_type].strip().lower() not in ('county', 'counties', ''):
                continue
            fips = str(row[col_fips]).strip().zfill(5)
            if len(fips) != 5 or not fips.isdigit():
                continue
            val = safe_float(row[latest_col]) if latest_col < len(row) else None
            if val is not None:
                result[fips] = round(val, 0)

    print(f"    Loaded time-on-market for {len(result)} counties.")
    return result


def main():
    print("RenewalReply — Apartment List Data Refresh\n")

    # 1. Load crosswalk
    zip_to_county = load_crosswalk()

    # 2. Load Apartment List data
    print(f"\nLoading Apartment List data from {AL_DIR}...")
    if not os.path.exists(AL_DIR):
        print(f"  ERROR: Directory not found: {AL_DIR}")
        print(f"  Create it and place the CSV files inside.")
        sys.exit(1)

    rent_data = load_rent_summary()
    vacancy_data = load_vacancy()
    tom_data = load_time_on_market()

    if not rent_data and not vacancy_data and not tom_data:
        print("\n  ERROR: No Apartment List data loaded. Check CSV files.")
        sys.exit(1)

    # 3. Build ZIP-level lookup
    print(f"\nMerging county data to ZIP level...")
    al_by_zip = {}
    matched = 0
    unmatched = 0

    for z, county_fips in zip_to_county.items():
        entry = {}

        rd = rent_data.get(county_fips, {})
        if 'aly' in rd:
            entry['aly'] = rd['aly']
        if 'alm' in rd:
            entry['alm'] = rd['alm']
        if 'alr' in rd:
            entry['alr'] = rd['alr']

        vac = vacancy_data.get(county_fips)
        if vac is not None:
            entry['alv'] = vac

        tom = tom_data.get(county_fips)
        if tom is not None:
            entry['alt'] = int(tom)

        if entry:
            al_by_zip[z] = entry
            matched += 1
        else:
            unmatched += 1

    print(f"  ZIPs with AL data: {matched}")
    print(f"  ZIPs without AL data: {unmatched}")

    # 4. Write output
    with open(OUTPUT_PATH, "w") as f:
        json.dump(al_by_zip, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n  Wrote {OUTPUT_PATH} ({size_kb:.0f} KB)")

    # Show sample
    print(f"\n  Sample entries (first 5):")
    for z in sorted(al_by_zip.keys())[:5]:
        print(f"    {z}: {al_by_zip[z]}")

    print(f"\n  Done! Apartment List data refreshed for {len(al_by_zip)} ZIPs.")
    print(f"  Update public/data/data_freshness.json with today's date for apartment_list.")


if __name__ == "__main__":
    main()
