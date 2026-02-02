-- Criar bucket vinyl-tracks (público) para músicas de exemplo do VinylPlayer
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vinyl-tracks',
  'vinyl-tracks',
  true,
  52428800, -- 50MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket suno-tracks (público) para músicas geradas pelo Suno
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'suno-tracks',
  'suno-tracks',
  true,
  52428800, -- 50MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para acesso público aos arquivos no bucket vinyl-tracks
CREATE POLICY "Public Access for vinyl-tracks"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vinyl-tracks');

CREATE POLICY "Public Access for vinyl-tracks upload"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'vinyl-tracks');

-- Políticas RLS para acesso público aos arquivos no bucket suno-tracks
CREATE POLICY "Public Access for suno-tracks"
ON storage.objects
FOR SELECT
USING (bucket_id = 'suno-tracks');

CREATE POLICY "Public Access for suno-tracks upload"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'suno-tracks');




















