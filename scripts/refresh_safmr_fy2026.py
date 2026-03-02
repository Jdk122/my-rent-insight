#!/usr/bin/env python3
"""
RenewalReply — Full SAFMR Data Refresh (FY2025 → FY2026)
Reads the FY2026 SAFMR Excel from HUD and replaces the FMR data in rentData.json.

Usage:
  pip install openpyxl
  python scripts/refresh_safmr_fy2026.py

What it does:
  1. Reads fy2026_safmrs.xlsx (must be in scripts/ directory)
  2. For each zip in rentData.json:
     - Moves current FMR (f) → prior year (p)
     - Replaces FMR with FY2026 values
     - Recalculates YoY change (y)
     - Updates metro name (m) if available
  3. Adds new zips from FY2026 that weren't in the dataset
  4. Removes zips no longer in FY2026 data
  5. Writes updated rentData.json
"""

import json, os, sys

try:
    import openpyxl
except ImportError:
    print("Install openpyxl first:  pip install openpyxl")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(SCRIPT_DIR, "fy2026_safmrs.xlsx")
RENT_DATA_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "rentData.json")


def main():
    if not os.path.exists(EXCEL_PATH):
        print(f"ERROR: {EXCEL_PATH} not found. Place fy2026_safmrs.xlsx in the scripts/ directory.")
        sys.exit(1)

    # 1. Parse Excel
    print("Parsing FY2026 SAFMR Excel...")
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

    col_zip = find_col("zip", "zcta", "zip_code", "zipcode")
    col_metro = find_col("hud fair market rent area name", "metro_name", "hmfa_name", "areaname", "area_name", "safmr_area_name")
    col_0br = find_col("safmr\n0br", "safmr 0br", "safmr_0br", "safmr0br")
    col_1br = find_col("safmr\n1br", "safmr 1br", "safmr_1br", "safmr1br")
    col_2br = find_col("safmr\n2br", "safmr 2br", "safmr_2br", "safmr2br")
    col_3br = find_col("safmr\n3br", "safmr 3br", "safmr_3br", "safmr3br")
    col_4br = find_col("safmr\n4br", "safmr 4br", "safmr_4br", "safmr4br")

    if col_zip is None or col_0br is None:
        print("Could not find required columns. Headers:")
        for i, h in enumerate(header):
            print(f"  [{i}] {repr(h)}")
        sys.exit(1)

    print(f"  ZIP col: {col_zip} ({repr(header[col_zip])})")
    print(f"  Metro col: {col_metro} ({repr(header[col_metro]) if col_metro else 'NOT FOUND'})")
    print(f"  FMR cols: 0BR={col_0br}, 1BR={col_1br}, 2BR={col_2br}, 3BR={col_3br}, 4BR={col_4br}")

    # 2. Extract all zip data from Excel
    new_data = {}
    for row in rows:
        z = str(row[col_zip] or "").strip().zfill(5)
        if len(z) != 5 or not z.isdigit():
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
        metro = str(row[col_metro] or "").strip() if col_metro is not None else ""
        new_data[z] = {"fmr": fmr, "metro": metro}

    wb.close()
    print(f"  Parsed {len(new_data)} zip codes from FY2026 Excel.")

    # 3. Load existing rentData.json
    print(f"Loading {RENT_DATA_PATH}...")
    with open(RENT_DATA_PATH) as f:
        rd = json.load(f)
    print(f"  Existing dataset: {len(rd)} zip codes.")

    # 4. Process updates
    updated = 0
    added = 0
    removed = 0
    unchanged = 0

    existing_zips = set(rd.keys())
    new_zips = set(new_data.keys())

    # Update existing zips
    for z in existing_zips & new_zips:
        entry = rd[z]
        new_fmr = new_data[z]["fmr"]
        old_fmr = entry.get("f", [0, 0, 0, 0, 0])

        # Shift current f → p (prior year)
        entry["p"] = old_fmr

        if old_fmr == new_fmr:
            unchanged += 1
            entry["y"] = 0.0
        else:
            entry["f"] = new_fmr
            updated += 1

        # Recalculate YoY
        if old_fmr[1] and old_fmr[1] > 0:
            yoy = round(((new_fmr[1] - old_fmr[1]) / old_fmr[1]) * 100, 1)
            yoy = max(-30, min(30, yoy))  # cap at ±30%
            entry["y"] = yoy

        # Update metro name if we have it
        metro = new_data[z]["metro"]
        if metro:
            entry["m"] = metro

    # Add new zips (only FMR + metro, no census/ZORI data)
    for z in new_zips - existing_zips:
        nd = new_data[z]
        # Try to infer state from metro name
        metro = nd["metro"]
        state = ""
        city = ""
        if ", " in metro:
            parts = metro.rsplit(", ", 1)
            if len(parts) == 2:
                # e.g. "Abilene, TX MSA" → state = TX
                state_part = parts[1].split()[0] if parts[1] else ""
                if len(state_part) == 2 and state_part.isalpha():
                    state = state_part

        rd[z] = {
            "c": city,
            "s": state,
            "m": metro,
            "f": nd["fmr"],
            "p": [0, 0, 0, 0, 0],
            "y": 0.0,
            "ps": "f",
        }
        added += 1

    # Remove zips no longer in FY2026
    for z in existing_zips - new_zips:
        del rd[z]
        removed += 1

    print(f"\n  Results:")
    print(f"    Updated FMR: {updated} zips")
    print(f"    Unchanged FMR: {unchanged} zips")
    print(f"    New zips added: {added}")
    print(f"    Removed (not in FY2026): {removed}")
    print(f"    Total zips in output: {len(rd)}")

    # 5. Show samples
    print(f"\n  Sample updates (first 5 changed):")
    count = 0
    for z in sorted(existing_zips & new_zips):
        if rd[z].get("f") != rd[z].get("p") and count < 5:
            print(f"    {z}: 1BR=${rd[z]['f'][1]} (was ${rd[z]['p'][1]}), YoY={rd[z].get('y', 0)}%")
            count += 1

    if added > 0:
        print(f"\n  Sample new zips (first 5):")
        for z in sorted(new_zips - existing_zips)[:5]:
            print(f"    {z}: 1BR=${rd[z]['f'][1]} ({rd[z].get('m', '?')})")

    if removed > 0:
        print(f"\n  Sample removed zips (first 5):")
        for z in sorted(existing_zips - new_zips)[:5]:
            print(f"    {z}")

    # 6. Confirm and write
    confirm = input(f"\n  Write updated rentData.json? (y/N): ").strip().lower()
    if confirm != "y":
        print("  Aborted.")
        return

    with open(RENT_DATA_PATH, "w") as f:
        json.dump(rd, f, separators=(",", ":"))

    size_mb = os.path.getsize(RENT_DATA_PATH) / 1024 / 1024
    print(f"  Wrote rentData.json ({size_mb:.1f} MB) with {len(rd)} zips. Done!")


if __name__ == "__main__":
    main()
