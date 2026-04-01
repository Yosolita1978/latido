-- ============================================
-- LATIDO — Phase 3: RPC Functions for MCP Server
-- Run AFTER 001_schema.sql
-- ============================================

-- match_user_patterns: vector similarity search on user_patterns
CREATE OR REPLACE FUNCTION match_user_patterns(
  p_user_id UUID,
  p_embedding VECTOR(768),
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  pattern_key TEXT,
  pattern_value JSONB,
  confidence INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT pattern_key, pattern_value, confidence
  FROM public.user_patterns
  WHERE user_id = p_user_id
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$;

-- search_tasks_hybrid: combined full-text + semantic search
CREATE OR REPLACE FUNCTION search_tasks_hybrid(
  p_user_id UUID,
  p_query_text TEXT,
  p_query_embedding VECTOR(768),
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  category TEXT,
  text_score REAL,
  semantic_score REAL,
  combined_score REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    t.id,
    t.title,
    t.status,
    t.category,
    (0.4 * ts_rank(t.title_search, plainto_tsquery('spanish', p_query_text)))::REAL AS text_score,
    (0.6 * (1 - (t.embedding <=> p_query_embedding)))::REAL AS semantic_score,
    (0.4 * ts_rank(t.title_search, plainto_tsquery('spanish', p_query_text))
     + 0.6 * (1 - (t.embedding <=> p_query_embedding)))::REAL AS combined_score
  FROM public.tasks t
  WHERE t.user_id = p_user_id
    AND t.status != 'cancelled'
    AND (
      t.title_search @@ plainto_tsquery('spanish', p_query_text)
      OR t.embedding <=> p_query_embedding < 0.5
    )
  ORDER BY combined_score DESC
  LIMIT p_limit;
$$;
