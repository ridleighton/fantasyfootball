-- Priority Ordering System for The Program
-- Paste into the Neon SQL editor (or run via `psql`) once. All statements
-- are idempotent — safe to re-run.
--
-- Creates four new tables that together drive how players are ordered
-- within each conference + roll-type block:
--   program_player_rankings   — master tier/rank list (per league, not per week)
--   program_school_priority   — standing school priority order (not per week)
--   program_coach_priority_lists — per-week, per-school player rankings
--   program_show_order        — resolved sequence (import + overrides) read
--                               by the launcher and theater

-- ----------------------------------------------------------------
-- program_player_rankings
-- Master list of players with their tier and rank. Players are unique
-- across the whole league here; conference scoping does not apply.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_player_rankings (
  id          serial PRIMARY KEY,
  player_name text NOT NULL,
  tier        integer NOT NULL,
  rank        integer NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique constraint on player_name via a unique
-- expression index.
CREATE UNIQUE INDEX IF NOT EXISTS program_player_rankings_player_lower_uq
  ON program_player_rankings (LOWER(player_name));

CREATE INDEX IF NOT EXISTS program_player_rankings_tier_rank_ix
  ON program_player_rankings (tier, rank);


-- ----------------------------------------------------------------
-- program_school_priority
-- Standing school priority order. Lower priority value = higher priority.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_school_priority (
  id          serial PRIMARY KEY,
  school_name text NOT NULL UNIQUE,
  priority    integer NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- A unique on (priority) keeps two schools from ever colliding on the
-- same rank. The replace-the-whole-order endpoint rewrites these atomically.
CREATE UNIQUE INDEX IF NOT EXISTS program_school_priority_priority_uq
  ON program_school_priority (priority);


-- ----------------------------------------------------------------
-- program_coach_priority_lists
-- Per-week, per-school, per-player submissions.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_coach_priority_lists (
  id           serial PRIMARY KEY,
  week_id      integer NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  school_name  text NOT NULL,
  player_name  text NOT NULL,
  conference   text NOT NULL,
  priority     integer NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- A school cannot rank the same player twice in the same week +
-- conference. This is the upsert key.
CREATE UNIQUE INDEX IF NOT EXISTS program_coach_priority_lists_uq
  ON program_coach_priority_lists (week_id, school_name, player_name, conference);

CREATE INDEX IF NOT EXISTS program_coach_priority_lists_week_player_ix
  ON program_coach_priority_lists (week_id, player_name);


-- ----------------------------------------------------------------
-- program_show_order
-- Resolved order for each (week, conference, roll_type) block. Written
-- at week-import time with order_source = 'import'; commissioner
-- drag-drop overrides update order_source = 'override'.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_show_order (
  id           serial PRIMARY KEY,
  week_id      integer NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  conference   text NOT NULL,
  roll_type    text NOT NULL,
  player_name  text NOT NULL,
  position     integer NOT NULL,
  order_source text NOT NULL DEFAULT 'import',
  CHECK (roll_type IN ('commit', 'steal', 'auto-commit')),
  CHECK (order_source IN ('import', 'coach', 'school', 'tier_rank', 'override'))
);

-- One player per (week, conference, roll_type) at a given position.
CREATE UNIQUE INDEX IF NOT EXISTS program_show_order_pos_uq
  ON program_show_order (week_id, conference, roll_type, position);

-- And one row per (week, conference, roll_type, player) — a player
-- cannot appear twice in the same block.
CREATE UNIQUE INDEX IF NOT EXISTS program_show_order_player_uq
  ON program_show_order (week_id, conference, roll_type, player_name);

CREATE INDEX IF NOT EXISTS program_show_order_week_conf_ix
  ON program_show_order (week_id, conference, roll_type, position);
