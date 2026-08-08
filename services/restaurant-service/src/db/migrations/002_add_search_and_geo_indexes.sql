-- pg_trgm gives Postgres a trigram (3-character substring) index type.
-- A plain B-tree index is useless for `name ILIKE '%term%'` — B-trees are
-- built for prefix/range lookups (WHERE name > 'M'), and a leading
-- wildcard means there's no prefix to seek on. Trigram indexes instead
-- break every value into overlapping 3-char chunks ('piz','izz','zza'
-- for "pizza") and index those, so a substring search becomes "which rows
-- share this trigram" — a lookup a GIN index can actually answer.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm On restaurants USING GIN(name gin_trgm_ops);

-- Composite B-tree on (latitude, longitude). This is NOT a "geospatial
-- index" in the PostGIS sense — it's a plain two-column B-tree. It works
-- here because the nearby-restaurants query below pre-filters with a
-- bounding box (`latitude BETWEEN x AND y AND longitude BETWEEN a AND b`),
-- which IS a sargable range predicate a B-tree can satisfy. The Haversine
-- distance math still runs per-row afterward, but only on the handful of
-- rows the bounding box already narrowed down — not the whole table.
CREATE INDEX IF NOT EXISTS idx_restaurant_lat_lng on restaurants(latitude, longitude);