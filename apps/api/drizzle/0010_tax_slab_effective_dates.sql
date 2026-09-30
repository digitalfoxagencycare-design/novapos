-- GST: the 28% luxury slab was abolished, while 5%, 12%, and 18% remain active.
-- Tenant rule sets hold a *copy* of the preset, so fixing the preset alone would leave existing stores
-- with retired slabs that never expire and current slabs that look brand new. Patch the stored copies too.
UPDATE tax_rule_sets
SET definition = jsonb_set(
  definition, '{slabs}',
  (SELECT jsonb_agg(
     CASE
       WHEN s->>'id' = 'gst-28' AND NOT (s ? 'validTo') THEN s || '{"validTo":"2025-09-22"}'::jsonb
       WHEN s->>'id' IN ('gst-5', 'gst-18') AND s->>'validFrom' = '2025-09-22' THEN s || '{"validFrom":"2017-07-01"}'::jsonb
       ELSE s
     END ORDER BY ord)
   FROM jsonb_array_elements(definition->'slabs') WITH ORDINALITY AS t(s, ord))
)
WHERE jsonb_typeof(definition->'slabs') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(definition->'slabs') x
    WHERE (x->>'id' = 'gst-28' AND NOT (x ? 'validTo'))
       OR (x->>'id' IN ('gst-5', 'gst-18') AND x->>'validFrom' = '2025-09-22')
  );
