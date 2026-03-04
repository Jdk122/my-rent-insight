#!/usr/bin/env python3
"""
RenewalReply — One-Time Migration: Tag Existing ZIPs + Expand to Full National Coverage

This script does TWO things:
  1. Tags all existing 38,601 ZIPs in rentData.json with fs='safmr'
     (they all came from the SAFMR file)
  2. Reads fy2026_erap_fmrs.xlsx and adds any ZCTA not already in
     rentData.json with fs='county' (county-level FMR fallback)

After running this, total ZIP count should go from ~38,601 to ~51,900+.

Usage:
  pip install openpyxl
  cd scripts
  python migrate_add_county_zips.py

Prerequisites:
  - scripts/fy2026_erap_fmrs.xlsx (already downloaded)
  - public/data/rentData.json (existing dataset)
"""

import json, os, sys

try:
    import openpyxl
except ImportError:
    print("Install openpyxl first:  pip install openpyxl")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ERAP_PATH = os.path.join(SCRIPT_DIR, "fy2026_erap_fmrs.xlsx")
RENT_DATA_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "rentData.json")


def main():
    # ── Validate ──
    if not os.path.exists(ERAP_PATH):
        print(f"ERROR: {ERAP_PATH} not found.")
        print("  It should already be in the scripts/ directory.")
        sys.exit(1)

    if not os.path.exists(RENT_DATA_PATH):
        print(f"ERROR: {RENT_DATA_PATH} not found.")
        sys.exit(1)

    # ── Step 1: Load rentData.json and tag existing ZIPs ──
    print(f"Loading {RENT_DATA_PATH}...")
    with open(RENT_DATA_PATH) as f:
        rd = json.load(f)

    before_count = len(rd)
    print(f"  Existing ZIPs: {before_count}")

    tagged = 0
    already_tagged = 0
    for z, entry in rd.items():
        if 'fs' not in entry:
            entry['fs'] = 'safmr'
            tagged += 1
        else:
            already_tagged += 1

    print(f"  Tagged {tagged} ZIPs as 'safmr' (already tagged: {already_tagged})")

    # ── Step 2: Parse ERAP file for county-level gap-fill ──
    print(f"\nParsing ERAP file ({ERAP_PATH})...")
    wb = openpyxl.load_workbook(ERAP_PATH, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    header_lower = [str(h).strip().lower() if h else "" for h in header]

    # Find columns: ZIP Code, area name, erap_fmr_br0..br4
    col_zip = None
    col_metro = None
    col_br = [None, None, None, None, None]

    for i, h in enumerate(header_lower):
        if 'zip' in h:
            col_zip = i
        elif 'area name' in h or 'metro' in h or 'hud' in h:
            col_metro = i

    # BR columns
    for i, h in enumerate(header_lower):
        if 'br0' in h or '_0' in h.replace('br', ''):
            col_br[0] = i
        elif 'br1' in h and col_br[1] is None:
            col_br[1] = i
        elif 'br2' in h and col_br[2] is None:
            col_br[2] = i
        elif 'br3' in h and col_br[3] is None:
            col_br[3] = i
        elif 'br4' in h and col_br[4] is None:
            col_br[4] = i

    # More precise column detection based on actual headers
    for i, h in enumerate(header_lower):
        if h == 'erap_fmr_br0':
            col_br[0] = i
        elif h == 'erap_fmr_br1':
            col_br[1] = i
        elif h == 'erap_fmr_br2':
            col_br[2] = i
        elif h == 'erap_fmr_br3':
            col_br[3] = i
        elif h == 'erap_fmr_br4':
            col_br[4] = i

    if col_zip is None:
        print("  ERROR: Could not find ZIP column. Headers:")
        for i, h in enumerate(header):
            print(f"    [{i}] {repr(h)}")
        sys.exit(1)

    print(f"  ZIP col: {col_zip} ({header[col_zip]})")
    print(f"  Metro col: {col_metro} ({header[col_metro] if col_metro else 'N/A'})")
    print(f"  FMR cols: {[header[c] if c else 'N/A' for c in col_br]}")

    # Parse all rows
    erap_total = 0
    added = 0
    skipped_existing = 0
    skipped_invalid = 0

    for row in rows:
        erap_total += 1
        z = str(row[col_zip] or "").strip().zfill(5)
        if len(z) != 5 or not z.isdigit():
            skipped_invalid += 1
            continue

        # Skip ZIPs already in dataset (they're tagged as safmr)
        if z in rd:
            skipped_existing += 1
            continue

        # Extract FMR values
        fmr = []
        for c in col_br:
            if c is not None and c < len(row):
                try:
                    fmr.append(int(row[c] or 0))
                except (ValueError, TypeError):
                    fmr.append(0)
            else:
                fmr.append(0)

        if all(v == 0 for v in fmr):
            skipped_invalid += 1
            continue

        # Extract metro name
        metro = str(row[col_metro] or "").strip() if col_metro is not None else ""

        # Infer state from metro name
        state = ""
        if ", " in metro:
            parts = metro.rsplit(", ", 1)
            if len(parts) == 2:
                state_part = parts[1].split()[0] if parts[1] else ""
                if len(state_part) == 2 and state_part.isalpha():
                    state = state_part.upper()

        # Add new ZIP with county-level FMR
        rd[z] = {
            "c": "",
            "s": state,
            "m": metro,
            "f": fmr,
            "p": [0, 0, 0, 0, 0],
            "y": 0.0,
            "ps": "f",
            "fs": "county",
        }
        added += 1

    wb.close()

    # ── Report ──
    after_count = len(rd)
    safmr_count = sum(1 for e in rd.values() if e.get('fs') == 'safmr')
    county_count = sum(1 for e in rd.values() if e.get('fs') == 'county')

    print(f"\n  ═══ Results ═══")
    print(f"  ERAP file rows: {erap_total}")
    print(f"  Already in dataset (skipped): {skipped_existing}")
    print(f"  Invalid/empty (skipped): {skipped_invalid}")
    print(f"  New county-level ZIPs added: {added}")
    print(f"")
    print(f"  Before: {before_count} ZIPs")
    print(f"  After:  {after_count} ZIPs")
    print(f"    └─ SAFMR (ZIP-level): {safmr_count}")
    print(f"    └─ County-level FMR:  {county_count}")

    # Show samples of new ZIPs
    if added > 0:
        print(f"\n  Sample new county-level ZIPs (first 10):")
        count = 0
        for z in sorted(rd.keys()):
            if rd[z].get('fs') == 'county' and count < 10:
                e = rd[z]
                print(f"    {z}: 1BR=${e['f'][1]}, metro={e['m'][:50]}")
                count += 1

    # ── Confirm and write ──
    confirm = input(f"\n  Write updated rentData.json with {after_count} ZIPs? (y/N): ").strip().lower()
    if confirm != "y":
        print("  Aborted.")
        return

    with open(RENT_DATA_PATH, "w") as f:
        json.dump(rd, f, separators=(",", ":"))

    size_mb = os.path.getsize(RENT_DATA_PATH) / 1024 / 1024
    print(f"\n  ✓ Wrote rentData.json ({size_mb:.1f} MB) with {after_count} ZIPs.")
    print(f"\n  Next steps:")
    print(f"    1. Refresh the /admin/data-quality page to verify counts")
    print(f"    2. Run refresh_zori.py to add Zillow data to new ZIPs")
    print(f"    3. Run refresh_zhvi.py to add ZHVI data")
    print(f"    4. Run refresh_apartmentlist.py to add Apartment List data")
    print(f"    5. The sitemap edge functions will automatically pick up new ZIPs")
    print(f"    6. Update data_freshness.json dates")


if __name__ == "__main__":
    main()
