-- Substitui a função trigger que tinha o anon key hardcoded.
-- O token é lido via current_setting('app.anon_key') — valor configurado
-- uma única vez no banco após rotacionar o key no dashboard Supabase:
--
--   ALTER DATABASE postgres SET app.anon_key   = '<novo-anon-key>';
--   ALTER DATABASE postgres SET app.webhook_url = 'https://<ref>.supabase.co/functions/v1/on-upload';
--
-- Enquanto essas variáveis não estiverem definidas, o trigger é silencioso
-- (sem chamada HTTP) — o AI tagging não dispara, mas uploads funcionam normalmente.
CREATE OR REPLACE FUNCTION public.trigger_on_photo_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_anon_key    text;
  v_webhook_url text;
BEGIN
  v_anon_key    := current_setting('app.anon_key',    true);
  v_webhook_url := current_setting('app.webhook_url', true);

  IF v_anon_key IS NOT NULL AND v_webhook_url IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_webhook_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'type',       TG_OP,
        'table',      TG_TABLE_NAME,
        'schema',     TG_TABLE_SCHEMA,
        'record',     to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
