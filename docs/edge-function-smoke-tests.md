# Edge Function Hardening — Smoke Test Checklist

> **Status**: NOT published. Run these against the preview/staging environment.
> **Base URL**: `https://piwahxgtsxpcrgoyuedy.supabase.co/functions/v1`
> **Anon key**: Use `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`

Set these in your shell first:

```bash
BASE="https://piwahxgtsxpcrgoyuedy.supabase.co/functions/v1"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpd2FoeGd0c3hwY3Jnb3l1ZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzEwOTUsImV4cCI6MjA4NzcwNzA5NX0.0G0eeaQ5Zbi6alPOTEvIz__sqh2yDihC6f5yWxdfeFE"
```

---

## 1. send-confirmation

### 1a. Normal send (renewal)

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/send-confirmation" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test@example.com","zip":"10001","city":"New York","state":"NY","tool_type":"renewal","fairness_score":72,"verdict_label":"Moderate"}'
```

**Expected**: HTTP 200, `{"sent":true}`. Check inbox for email with subject "Your rent analysis for New York, NY". Unsubscribe link present with valid lead ID (not empty `id=`).

### 1b. Normal send (wsip)

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/send-confirmation" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test@example.com","zip":"90210","city":"Beverly Hills","state":"CA","tool_type":"wsip"}'
```

**Expected**: HTTP 200, `{"sent":true}`. Subject: "Your market report for Beverly Hills, CA". Contains cross-sell link to renewal tool.

### 1c. Missing email

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/send-confirmation" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"zip":"10001"}'
```

**Expected**: HTTP 400, `{"error":"email is required"}`.

### 1d. Unsubscribed email suppression

Use an email that has `unsubscribed = true` in the leads table.

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/send-confirmation" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"unsubscribed-user@example.com","zip":"10001","tool_type":"renewal"}'
```

**Expected**: HTTP 200, `{"sent":false,"reason":"unsubscribed"}`. No email actually sent.

---

## 2. Unsubscribe flow

### 2a. Trigger unsubscribe via Outcome page

1. Find a test lead ID from the leads table
2. Visit: `https://renewalreply.com/outcome?result=unsubscribe&id=<LEAD_ID>` (or preview URL equivalent)

**Expected**: Page shows unsubscribe confirmation. In the database, ALL lead rows matching that email have `unsubscribed = true`, not just the one referenced by `id`.

### 2b. Verify global suppression

After 2a, run test 1d above with the same email.

**Expected**: `{"sent":false,"reason":"unsubscribed"}`.

### 2c. Verify update_lead_outcome function directly

```sql
-- Run in SQL editor / query tool
SELECT public.update_lead_outcome('<LEAD_ID>'::uuid, 'unsubscribe');

-- Then check:
SELECT id, email, unsubscribed FROM leads WHERE email = '<EMAIL>';
```

**Expected**: Every row for that email has `unsubscribed = true`.

---

## 3. notify-submission

### 3a. With direct email

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/notify-submission" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"zip":"10001","city":"New York","state":"NY","bedrooms":2,"current_rent":2500,"proposed_rent":2800,"increase_pct":12,"fairness_score":65,"verdict_label":"Moderate","email":"test@example.com"}'
```

**Expected**: HTTP 200, `{"ok":true}`. Admin notification email received with `✉️ EMAIL CAPTURED` badge and the email shown.

### 3b. With analysis_id only (no email)

Use a real analysis_id that has a linked lead.

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/notify-submission" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"zip":"10001","fairness_score":55,"verdict_label":"Unfair","analysis_id":"<REAL_ANALYSIS_ID>"}'
```

**Expected**: HTTP 200. Admin email received. If lead exists for that analysis_id, email badge shows the resolved email. Otherwise shows "No — anonymous submission".

### 3c. ZIP-only (no email, no analysis_id) — privacy check

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/notify-submission" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"zip":"10001","fairness_score":55,"verdict_label":"Unfair"}'
```

**Expected**: HTTP 200. Admin email shows "No — anonymous submission". Must NOT resolve any email from ZIP lookup. This is the key privacy fix.

---

## 4. admin-query

### 4a. Normal authenticated query

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/admin-query" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"password":"<ADMIN_PASSWORD>","query":"dashboard_stats"}'
```

**Expected**: HTTP 200, JSON with `total_submissions`, `submissions_30d`, etc.

### 4b. Wrong password

```bash
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/admin-query" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong","query":"dashboard_stats"}'
```

**Expected**: HTTP 401 or 403, `{"error":"Unauthorized"}` or similar.

---

## 5. Throttle behavior

### 5a. send-confirmation (limit: 10 per 5 min)

```bash
for i in $(seq 1 12); do
  echo "Request $i:"
  curl -s -w " HTTP %{http_code}\n" -X POST "$BASE/send-confirmation" \
    -H "apikey: $ANON" \
    -H "Content-Type: application/json" \
    -d '{"email":"throttle-test@example.com","zip":"99999","tool_type":"renewal"}'
  sleep 0.3
done
```

**Expected**: Requests 1–10 return HTTP 200. Requests 11–12 return HTTP 429 `{"error":"Too many requests"}`.

> ⚠️ This will send real emails for the first 10 if the email is valid. Use a non-existent domain or check unsubscribed status first.

### 5b. notify-submission (limit: 20 per 5 min)

Same pattern, 22 iterations, against `/notify-submission`.

**Expected**: Requests 1–20 return 200. Requests 21–22 return 429.

### 5c. admin-query (limit: 20 per 5 min)

Same pattern, 22 iterations, against `/admin-query` with correct password.

**Expected**: Requests 1–20 return 200. Requests 21–22 return 429.

---

## 6. function_request_log verification

After running any of the tests above:

```sql
SELECT function_name, ip_address, success, response_status, created_at
FROM function_request_log
ORDER BY created_at DESC
LIMIT 20;
```

**Expected**:
- Every request has a row
- `function_name` matches the endpoint called
- `success` is `true` for 200 responses, `false` for 4xx/5xx
- `response_status` matches the HTTP status returned
- `ip_address` is populated (not null or empty)
- Throttled (429) requests also have log rows with `success = false, response_status = 429`

### 6b. Cleanup cron exists

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'cleanup-function-request-log';
```

**Expected**: One row with a schedule that prunes old entries (e.g., hourly, deleting rows > 1 hour old).

---

## 7. send-followup-email unsubscribe check

This runs on a cron schedule, not on demand. To verify:

```sql
-- Ensure a test lead has unsubscribed = true and no followup_sent_at
-- Then check the function code handles it
```

**Expected**: In `send-followup-email/index.ts`, the query filters out unsubscribed leads before sending. Verify the WHERE clause includes `unsubscribed` filtering OR the loop checks each lead's unsubscribe status before sending.

---

## Pass/Fail Summary Template

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1a | send-confirmation renewal | ⬜ | |
| 1b | send-confirmation wsip | ⬜ | |
| 1c | send-confirmation missing email | ⬜ | |
| 1d | send-confirmation unsub suppression | ⬜ | |
| 2a | Unsubscribe via Outcome page | ⬜ | |
| 2b | Global suppression after unsub | ⬜ | |
| 3a | notify-submission with email | ⬜ | |
| 3b | notify-submission with analysis_id | ⬜ | |
| 3c | notify-submission ZIP-only (no email leak) | ⬜ | |
| 4a | admin-query authenticated | ⬜ | |
| 4b | admin-query wrong password | ⬜ | |
| 5a | send-confirmation throttle at 10 | ⬜ | |
| 5b | notify-submission throttle at 20 | ⬜ | |
| 5c | admin-query throttle at 20 | ⬜ | |
| 6a | function_request_log rows correct | ⬜ | |
| 6b | Cleanup cron exists | ⬜ | |
| 7 | send-followup-email unsub filter | ⬜ | |
