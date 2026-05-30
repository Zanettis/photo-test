-- Habilitar pg_net para chamadas HTTP a partir de triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Função trigger: dispara Edge Function on-upload após upload de foto
CREATE OR REPLACE FUNCTION public.trigger_on_photo_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://erhbhrbqvdceurbrxdus.supabase.co/functions/v1/on-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaGJocmJxdmRjZXVyYnJ4ZHVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTcwMzksImV4cCI6MjA5NTQzMzAzOX0.S2T7isnSBkrtBnTkBgeWima8EspLyjmnOLRT-fXjaXc'
    ),
    body := to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

-- Trigger em storage.objects: dispara após cada INSERT (novo upload)
CREATE OR REPLACE TRIGGER "on-photo-upload"
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_on_photo_upload();
