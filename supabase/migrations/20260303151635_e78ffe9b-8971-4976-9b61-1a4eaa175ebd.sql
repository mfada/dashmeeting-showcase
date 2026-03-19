
-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-uploads', 'meeting-uploads', false);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meeting-uploads');

-- Allow authenticated users to read their uploads
CREATE POLICY "Authenticated users can read uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-uploads');
