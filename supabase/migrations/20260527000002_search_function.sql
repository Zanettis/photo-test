-- ============================================================
-- foto.app — Search Function (pgvector cosine similarity)
-- ============================================================

CREATE OR REPLACE FUNCTION search_photos(
  event_id_param  UUID,
  query_embedding VECTOR(1536),
  match_count     INT DEFAULT 20
)
RETURNS TABLE (
  id              UUID,
  storage_path    TEXT,
  tags            TEXT[],
  tagging_status  TEXT,
  similarity      FLOAT,
  uploaded_at     TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    p.id,
    p.storage_path,
    p.tags,
    p.tagging_status,
    1 - (p.embedding <=> query_embedding) AS similarity,
    p.uploaded_at
  FROM photos p
  WHERE p.event_id = event_id_param
    AND p.embedding IS NOT NULL
    AND p.is_flagged = false
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Allow authenticated users to call this function
-- RLS on photos already ensures they can only see their events' photos
GRANT EXECUTE ON FUNCTION search_photos(UUID, VECTOR(1536), INT) TO authenticated;
