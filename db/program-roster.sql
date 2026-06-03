-- Roster System for The Program
-- Paste into the Neon SQL editor (or run via `psql`) once. All statements
-- are idempotent — safe to re-run.
--
-- Each school keeps a persistent roster that carries across all weeks
-- (not scoped to an import). Active players count against a 15-player
-- limit; inactive players (scholarship revoked) are an unlimited
-- historical record. Player uniqueness is scoped to (player_name,
-- conference) — the same name in two conferences is two distinct players.

-- ================================================================
-- program_roster
-- ================================================================
CREATE TABLE IF NOT EXISTS program_roster (
  id            serial PRIMARY KEY,
  school_name   text NOT NULL,            -- must match a program_schools.name
  player_name   text NOT NULL,
  conference    text NOT NULL,            -- conference the player was recruited in
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  source        text NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('show', 'manual')),
  week_id       integer REFERENCES program_weeks(id) ON DELETE SET NULL,
  roll_event_id integer REFERENCES program_roll_events(id) ON DELETE SET NULL,
  added_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  -- why the scholarship was revoked (set when status -> inactive); optional.
  revoke_reason text
);

-- Backfill for an existing table created before revoke_reason was added:
ALTER TABLE program_roster ADD COLUMN IF NOT EXISTS revoke_reason text;

-- Roster page queries by school + status.
CREATE INDEX IF NOT EXISTS program_roster_school_status_ix
  ON program_roster (school_name, status);

-- Roster history is append-only: each show population inserts a NEW row and
-- a revocation keeps the prior (inactive) row as a trace, so multiple rows
-- can share one roll_event_id across re-processings. The index is therefore
-- NOT unique. (Drops the old unique index if it was already created.)
DROP INDEX IF EXISTS program_roster_roll_event_uq;
CREATE INDEX IF NOT EXISTS program_roster_roll_event_ix
  ON program_roster (roll_event_id) WHERE roll_event_id IS NOT NULL;

-- Fast active-duplicate checks, case-insensitive, scoped to conference.
CREATE INDEX IF NOT EXISTS program_roster_dup_ix
  ON program_roster (LOWER(player_name), LOWER(conference), status);

-- ================================================================
-- program_roster_counts — the single source of truth for capacity.
-- Every capacity check reads from this view.
-- ================================================================
CREATE OR REPLACE VIEW program_roster_counts AS
  SELECT school_name,
         COUNT(*) FILTER (WHERE status = 'active')   AS active_count,
         COUNT(*) FILTER (WHERE status = 'inactive') AS inactive_count,
         COUNT(*)                                     AS total_count
    FROM program_roster
   GROUP BY school_name;

-- ----------------------------------------------------------------
-- The interim program_rosters (plural) table is superseded by this one.
-- It is left in place (unused) to avoid data loss; drop it manually once
-- you've confirmed nothing depends on it:
--   DROP TABLE IF EXISTS program_rosters;
-- ----------------------------------------------------------------
