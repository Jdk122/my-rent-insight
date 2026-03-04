

## Problem

The current migration approach has a fundamental flaw: fetching `https://www.huduser.gov/portal/datasets/fmr/fmr2026/fy2026_erap_fmrs.xlsx` directly from the browser will be blocked by CORS (HUD doesn't set `Access-Control-Allow-Origin` headers). Even if it worked, the Coverage tab only shows county data after the migration button is clicked AND the file is uploaded to storage.

## Plan: Edge Function Proxy + Streaming Approach

Since the previous edge function OOM'd trying to parse the full XLSX in memory, we'll use a **hybrid approach**:

1. **Create a lightweight edge function** (`proxy-hud-xlsx`) that simply proxies/streams the HUD XLSX file back to the client, bypassing CORS. No parsing on the server — just a pass-through fetch.

2. **Keep client-side XLSX parsing** — the browser has plenty of memory for a 6MB file. The migration button will:
   - Fetch via the edge function proxy (no CORS issue)
   - Parse with SheetJS in browser
   - Upload result to `temp-data` storage bucket

3. **Auto-refresh Coverage tab** after migration completes by invalidating the county data cache.

### Files to create/edit:
- **Create** `supabase/functions/proxy-hud-xlsx/index.ts` — simple proxy that fetches the HUD URL and returns the binary response
- **Edit** `src/pages/AdminDataQuality.tsx` — change the ERAP fetch URL to use the edge function proxy instead of direct HUD URL

The edge function will be ~15 lines: fetch the HUD URL server-side and pipe the response back with proper CORS headers. No XLSX parsing on the server.

