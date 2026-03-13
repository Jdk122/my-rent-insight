-- Step 1: Reassign leads to latest analysis in each duplicate group
WITH ranked AS (
  SELECT id,
    FIRST_VALUE(id) OVER (
      PARTITION BY LOWER(COALESCE(address, zip)), zip, bedrooms, current_rent, tool_type, date_trunc('day', created_at)
      ORDER BY created_at DESC
    ) as latest_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(COALESCE(address, zip)), zip, bedrooms, current_rent, tool_type, date_trunc('day', created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM analyses
)
UPDATE leads SET analysis_id = ranked.latest_id
FROM ranked
WHERE leads.analysis_id = ranked.id AND ranked.rn > 1;

-- Step 2: Reassign lead_events
WITH ranked AS (
  SELECT id,
    FIRST_VALUE(id) OVER (
      PARTITION BY LOWER(COALESCE(address, zip)), zip, bedrooms, current_rent, tool_type, date_trunc('day', created_at)
      ORDER BY created_at DESC
    ) as latest_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(COALESCE(address, zip)), zip, bedrooms, current_rent, tool_type, date_trunc('day', created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM analyses
)
UPDATE lead_events SET analysis_id = ranked.latest_id
FROM ranked
WHERE lead_events.analysis_id = ranked.id AND ranked.rn > 1;

-- Step 3: Reassign shared_reports
WITH ranked AS (
  SELECT id,
    FIRST_VALUE(id) OVER (
      PARTITION BY LOWER(COALESCE(address, zip)), zip, bedrooms, current_rent, tool_type, date_trunc('day', created_at)
      ORDER BY created_at DESC
    ) as latest_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(COALESCE(address, zip)), zip, bedrooms, current_rent, tool_type, date_trunc('day', created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM analyses
)
UPDATE shared_reports SET analysis_id = ranked.latest_id
FROM ranked
WHERE shared_reports.analysis_id = ranked.id AND ranked.rn > 1;

-- Step 4: Delete the duplicate analyses (keep latest per group)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(COALESCE(address, zip)), zip, bedrooms, current_rent, tool_type, date_trunc('day', created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM analyses
)
DELETE FROM analyses WHERE id IN (SELECT id FROM ranked WHERE rn > 1);