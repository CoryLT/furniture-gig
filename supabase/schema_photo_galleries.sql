-- Create worker_photo_galleries table
CREATE TABLE IF NOT EXISTS worker_photo_galleries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flipper_photo_galleries table
CREATE TABLE IF NOT EXISTS flipper_photo_galleries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flipper_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_worker_photo_galleries_worker_user_id ON worker_photo_galleries(worker_user_id);
CREATE INDEX idx_flipper_photo_galleries_flipper_user_id ON flipper_photo_galleries(flipper_user_id);

-- Enable RLS for worker galleries
ALTER TABLE worker_photo_galleries ENABLE ROW LEVEL SECURITY;

-- Worker gallery policies
CREATE POLICY "Public photos are viewable by everyone"
  ON worker_photo_galleries
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own photos"
  ON worker_photo_galleries
  FOR INSERT
  WITH CHECK (auth.uid() = worker_user_id);

CREATE POLICY "Users can update their own photos"
  ON worker_photo_galleries
  FOR UPDATE
  USING (auth.uid() = worker_user_id)
  WITH CHECK (auth.uid() = worker_user_id);

CREATE POLICY "Users can delete their own photos"
  ON worker_photo_galleries
  FOR DELETE
  USING (auth.uid() = worker_user_id);

-- Enable RLS for flipper galleries
ALTER TABLE flipper_photo_galleries ENABLE ROW LEVEL SECURITY;

-- Flipper gallery policies
CREATE POLICY "Public photos are viewable by everyone"
  ON flipper_photo_galleries
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own photos"
  ON flipper_photo_galleries
  FOR INSERT
  WITH CHECK (auth.uid() = flipper_user_id);

CREATE POLICY "Users can update their own photos"
  ON flipper_photo_galleries
  FOR UPDATE
  USING (auth.uid() = flipper_user_id)
  WITH CHECK (auth.uid() = flipper_user_id);

CREATE POLICY "Users can delete their own photos"
  ON flipper_photo_galleries
  FOR DELETE
  USING (auth.uid() = flipper_user_id);

-- Create storage bucket for photo galleries (if not exists)
-- Note: Run this in Supabase console if needed:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('photo-galleries', 'photo-galleries', true);

-- Storage RLS policies for photo-galleries bucket
CREATE POLICY "Public Access"
  ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'photo-galleries' );

CREATE POLICY "Authenticated users can upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'photo-galleries'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'photo-galleries'
    AND owner = auth.uid()::text
  );
