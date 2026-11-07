-- Private bucket: no anon/authenticated policies are granted. Server uses service role after authorization.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('foundit-private','foundit-private',false,3145728,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=3145728,allowed_mime_types=EXCLUDED.allowed_mime_types;
