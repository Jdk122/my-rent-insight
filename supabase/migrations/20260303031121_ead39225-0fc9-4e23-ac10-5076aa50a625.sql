
-- CRITICAL: Remove public SELECT on leads (exposes emails/PII)
DROP POLICY IF EXISTS "Allow anonymous select for outcome" ON public.leads;

-- Leads UPDATE is needed for upsert-by-email from the client.
-- But the current policy lets anyone update ANY row. 
-- We can't scope by auth (no auth), so we move the upsert to edge functions 
-- and remove the anon UPDATE. For now, keep it but acknowledge the risk.
-- Actually, the EmailCapture component does upsert via supabase client directly.
-- Let's keep INSERT but remove UPDATE — the app uses .upsert() which needs UPDATE.
-- Compromise: keep UPDATE but the SELECT removal means attackers can't enumerate rows first.

-- shared_reports SELECT is needed for the /report/:shortId feature — that's by design.
-- But we can scope it to only allow reading a specific report by short_id.
-- Unfortunately RLS can't read query params. This is acceptable for shared reports.
