-- School Rosters for The Program
-- Paste into the Neon SQL editor (or run via `psql`) once. All statements
-- are idempotent — safe to re-run.
--
-- A standing roster of players for each school (not per-week). Each entry
-- carries a status; an active player may additionally be locked, and an
-- inactive player carries a reason.

-- ================================================================
-- program_rosters
-- One row per (school, player). conference is denormalized from the
-- school so the Rosters page can group by conference without a join.
-- ================================================================
CREATE TABLE IF NOT EXISTS program_rosters (
  id              serial PRIMARY KEY,
  school_name     text NOT NULL,
  conference      text NOT NULL,
  player_name     text NOT NULL,
  -- 'active' | 'inactive'
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),
  -- only meaningful when status = 'active'
  locked          boolean NOT NULL DEFAULT false,
  -- only meaningful when status = 'inactive'
  inactive_reason text,
  -- program week number the player was added to the roster (set once, at
  -- creation, from the active week). Null if no active week at the time.
  week_added      integer,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Backfill for an existing table created before week_added was added:
ALTER TABLE program_rosters ADD COLUMN IF NOT EXISTS week_added integer;

-- A school can't list the same player twice (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS program_rosters_school_player_uq
  ON program_rosters (LOWER(school_name), LOWER(player_name));

-- Conference grouping for the Rosters page subtabs.
CREATE INDEX IF NOT EXISTS program_rosters_conference_ix
  ON program_rosters (conference);
