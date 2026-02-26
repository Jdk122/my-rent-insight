#!/usr/bin/env python3
"""
RentReply ZORI Auto-Refresh Script
Run monthly. ~10 seconds. Updates Zillow trend data in rentData.json.

We only use Zillow's YoY/monthly trend — NOT the absolute rent (ZORI blends
all unit types which skews in luxury/resort areas). Trends are reliable.
"""
import csv, json, os
from urllib.request import urlretrieve

ZORI_URL = "https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv"
RENT_DATA_PATH = "./rentData.json"

def main():
    print("Downloading ZORI...")
    urlretrieve(ZORI_URL, "/tmp/zori.csv")
    with open("/tmp/zori.csv") as f:
        headers = next(csv.reader(f))
    li = len(headers) - 1
    print(f"Latest: {headers[li]}")

    zori = {}
    with open("/tmp/zori.csv") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            z = row[2].strip().zfill(5)
            def sf(i):
                try: return float(row[i]) if row[i].strip() else None
                except: return None
            latest = sf(li)
            if not latest: continue
            yr = sf(li-12) if li-12 >= 9 else None
            m1 = sf(li-1) if li-1 >= 9 else None
            m3 = sf(li-3) if li-3 >= 9 else None
            yoy = max(-35, min(35, round(((latest-yr)/yr)*100, 1))) if yr and yr > 0 else None
            mc = round(((latest-m1)/m1)*100, 2) if m1 and m1 > 0 else None
            t3 = round((((1+(latest-m3)/m3)**4)-1)*100, 1) if m3 and m3 > 0 else None
            d = 'rising' if mc and mc > 0.1 else 'falling' if mc and mc < -0.1 else 'flat' if mc is not None else None
            zori[z] = {'zy': yoy, 'zm': mc, 'zt': t3, 'zd': d}

    with open(RENT_DATA_PATH) as f:
        rd = json.load(f)
    for e in rd.values():
        for k in ['zy','zm','zt','zd','zr']: e.pop(k, None)
    merged = sum(1 for z, v in zori.items() if z in rd and rd[z].update(v) is None)
    with open(RENT_DATA_PATH, 'w') as f:
        json.dump(rd, f, separators=(',',':'))
    print(f"Merged {len([z for z in zori if z in rd])} zips. {os.path.getsize(RENT_DATA_PATH)/1024/1024:.1f} MB. Done!")

if __name__ == "__main__":
    main()
