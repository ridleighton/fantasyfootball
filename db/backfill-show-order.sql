-- One-shot backfill for program_show_order.
--
-- Populates program_show_order from existing program_roll_events for
-- every week that doesn't already have any show-order rows. Run AFTER
-- db/program-priority.sql.
--
-- For each (week, conference, type) block, players are inserted in the
-- order their first row appears in program_roll_events (id ASC).
-- Duplicate player rows within a block (same player listed twice in
-- the import) collapse to one show_order entry.
--
-- Safe to re-run: weeks that already have any show-order rows are
-- skipped entirely, so this won't fight with partially-overridden weeks.

INSERT INTO program_show_order
  (week_id, conference, roll_type, player_name, position, order_source)
SELECT
  g.week_id,
  g.conference,
  g.roll_type,
  g.player_name,
  ROW_NUMBER() OVER (
    PARTITION BY g.week_id, g.conference, g.roll_type
    ORDER BY g.first_id
  ) AS position,
  'import' AS order_source
FROM (
  SELECT
    week_id,
    conference,
    LOWER(type) AS roll_type,
    player        AS player_name,
    MIN(id)       AS first_id
  FROM program_roll_events
  WHERE LOWER(type) IN ('commit', 'steal', 'auto-commit')
    AND player IS NOT NULL
    AND TRIM(player) <> ''
    AND conference IS NOT NULL
  GROUP BY week_id, conference, LOWER(type), player
) g
WHERE NOT EXISTS (
  SELECT 1 FROM program_show_order o WHERE o.week_id = g.week_id
);

-- Report what landed (run separately if you want a sanity check):
--   SELECT week_id, conference, roll_type, COUNT(*) AS players
--     FROM program_show_order
--    GROUP BY week_id, conference, roll_type
--    ORDER BY week_id, conference, roll_type;
