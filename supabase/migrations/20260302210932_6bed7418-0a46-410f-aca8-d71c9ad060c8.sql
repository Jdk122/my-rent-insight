
-- Create a temporary storage bucket for data processing
INSERT INTO storage.buckets (id, name, public) VALUES ('temp-data', 'temp-data', true);

-- Allow public read access
CREATE POLICY "Public read access for temp-data"
ON storage.objects FOR SELECT
USING (bucket_id = 'temp-data');

-- Allow service role to upload (edge functions use service role)
CREATE POLICY "Service role can upload to temp-data"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'temp-data');

CREATE POLICY "Service role can update temp-data"
ON storage.objects FOR UPDATE
USING (bucket_id = 'temp-data');
