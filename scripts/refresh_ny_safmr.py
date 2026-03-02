#!/usr/bin/env python3
"""
RenewalReply — Refresh NY Metro SAFMR Data
Downloads the FY2025 SAFMR Excel from HUD and updates rentData.json
for all zip codes in the New York, NY HUD Metro FMR Area.

Usage:
  pip install openpyxl
  cd scripts
  python refresh_ny_safmr.py

The script:
  1. Downloads fy2025_safmrs.xlsx from huduser.gov
  2. Filters rows where the metro area matches "New York, NY"
  3. Updates the `f` array (FMR) for each matching zip in rentData.json
  4. Recalculates `y` (YoY % change) from the prior-year `p` values
"""

import json, os, sys
from urllib.request import urlretrieve

try:
    import openpyxl
except ImportError:
    print("Install openpyxl first:  pip install openpyxl")
    sys.exit(1)

SAFMR_URL = "https://www.huduser.gov/portal/datasets/fmr/fmr2025/fy2025_safmrs.xlsx"
RENT_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "rentData.json")
NY_METRO_NEEDLE = "New York, NY"  # matches "New York, NY HUD Metro FMR Area"

def main():
    # 1. Download Excel
    tmp_path = "/tmp/fy2025_safmrs.xlsx"
    if not os.path.exists(tmp_path):
        print(f"Downloading SAFMR Excel from HUD...")
        urlretrieve(SAFMR_URL, tmp_path)
        print("  Downloaded.")
    else:
        print(f"Using cached {tmp_path}")

    # 2. Parse Excel — find column indices
    print("Parsing Excel...")
    wb = openpyxl.load_workbook(tmp_path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    header_lower = [str(h).strip().lower() if h else "" for h in header]

    # Find relevant columns — HUD uses varying column names
    def find_col(*candidates):
        for c in candidates:
            c_lower = c.lower()
            for i, h in enumerate(header_lower):
                if c_lower in h:
                    return i
        return None

    col_zip = find_col("zip", "zcta", "zip_code", "zipcode")
    col_metro = find_col("metro_name", "hmfa_name", "areaname", "area_name", "metro", "safmr_area_name")
    col_0br = find_col("safmr_0br", "safmr0br", "rent_0br", "0br", "eff")
    col_1br = find_col("safmr_1br", "safmr1br", "rent_1br", "1br")
    col_2br = find_col("safmr_2br", "safmr2br", "rent_2br", "2br")
    col_3br = find_col("safmr_3br", "safmr3br", "rent_3br", "3br")
    col_4br = find_col("safmr_4br", "safmr4br", "rent_4br", "4br")

    if col_zip is None:
        # Try printing first row to help debug
        print("Could not find ZIP column. Headers found:")
        for i, h in enumerate(header):
            print(f"  [{i}] {h}")
        sys.exit(1)

    if col_metro is None:
        print("Could not find metro/area name column. Headers found:")
        for i, h in enumerate(header):
            print(f"  [{i}] {h}")
        sys.exit(1)

    if col_0br is None:
        print("Could not find FMR rent columns. Headers found:")
        for i, h in enumerate(header):
            print(f"  [{i}] {h}")
        sys.exit(1)

    print(f"  ZIP col: {col_zip} ({header[col_zip]})")
    print(f"  Metro col: {col_metro} ({header[col_metro]})")
    print(f"  FMR cols: 0BR={col_0br}, 1BR={col_1br}, 2BR={col_2br}, 3BR={col_3br}, 4BR={col_4br}")

    # 3. Extract NY metro zip data
    ny_data = {}
    for row in rows:
        metro = str(row[col_metro] or "").strip()
        if NY_METRO_NEEDLE not in metro:
            continue
        z = str(row[col_zip] or "").strip().zfill(5)
        if len(z) != 5:
            continue
        fmr = [
            int(row[col_0br] or 0),
            int(row[col_1br] or 0),
            int(row[col_2br] or 0),
            int(row[col_3br] or 0),
            int(row[col_4br] or 0),
        ]
        if all(v == 0 for v in fmr):
            continue
        ny_data[z] = fmr

    wb.close()
    print(f"  Found {len(ny_data)} NY metro zip codes in SAFMR Excel.")

    if not ny_data:
        print("ERROR: No NY metro zips found. Check the metro name filter.")
        print("  Searched for:", repr(NY_METRO_NEEDLE))
        sys.exit(1)

    # 4. Load rentData.json
    print(f"Loading {RENT_DATA_PATH}...")
    with open(RENT_DATA_PATH) as f:
        rd = json.load(f)

    # 5. Update matching zips
    updated = 0
    added = 0
    unchanged = 0
    for z, fmr in ny_data.items():
        if z not in rd:
            # Skip zips not in our dataset — we don't have census/other data for them
            added += 1
            continue

        entry = rd[z]
        old_fmr = entry.get("f", [0, 0, 0, 0, 0])

        if old_fmr == fmr:
            unchanged += 1
            continue

        entry["f"] = fmr

        # Recalculate YoY from prior-year data
        prior = entry.get("p", [])
        if len(prior) >= 2 and prior[1] and prior[1] > 0:
            yoy = round(((fmr[1] - prior[1]) / prior[1]) * 100, 1)
            yoy = max(-30, min(30, yoy))  # cap at ±30%
            entry["y"] = yoy

        updated += 1

    print(f"\n  Results:")
    print(f"    Updated: {updated} zips")
    print(f"    Unchanged: {unchanged} zips")
    print(f"    In Excel but not in dataset: {added} zips (skipped)")

    if updated == 0:
        print("\n  No changes needed — data is already up to date.")
        return

    # 6. Show sample changes
    print(f"\n  Sample updates (first 5):")
    count = 0
    for z, fmr in ny_data.items():
        if z in rd and count < 5:
            print(f"    {z}: 1BR=${fmr[1]}, 2BR=${fmr[2]}")
            count += 1

    # 7. Write back
    confirm = input(f"\n  Write {updated} updates to rentData.json? (y/N): ").strip().lower()
    if confirm != "y":
        print("  Aborted.")
        return

    with open(RENT_DATA_PATH, "w") as f:
        json.dump(rd, f, separators=(",", ":"))

    size_mb = os.path.getsize(RENT_DATA_PATH) / 1024 / 1024
    print(f"  Wrote rentData.json ({size_mb:.1f} MB). Done!")


if __name__ == "__main__":
    main()
