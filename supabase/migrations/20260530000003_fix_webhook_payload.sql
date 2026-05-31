-- Fix: trigger was sending to_jsonb(NEW) (flat storage row) but Edge Function
-- expects the Supabase Database Webhook envelope {type, table, schema, record}.
-- The check `payload.type !== 'INSERT'` evaluated to `undefined !== 'INSERT'` = true,
-- causing every upload to be skipped silently.
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
    body := jsonb_build_object(
      'type',       TG_OP,
      'table',      TG_TABLE_NAME,
      'schema',     TG_TABLE_SCHEMA,
      'record',     to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    )
  );
  RETURN NEW;
END;
$$;

-- Reset photos stuck in 'pending' so they show the actual image instead of the spinner.
-- These were never processed because the trigger payload was malformed.
UPDATE photos SET tagging_status = 'failed' WHERE tagging_status = 'pending';
