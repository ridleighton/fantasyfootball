-- One-shot backfill for program_schools.
--
-- Most of the existing show data references schools that live only in
-- program_photos and program_roll_events — program_schools itself was
-- empty. This script collects every distinct school name from those
-- sources and inserts it into program_schools, picking the most-common
-- conference seen for each school as the default.
--
-- Safe to re-run: rows whose name already exists in program_schools
-- (case-insensitive) are skipped.

INSERT INTO program_schools (name, conference)
SELECT
  s.school,
  COALESCE(s.conference, 'Unknown') AS conference
FROM (
  SELECT
    school,
    -- Most-common conference for this school across all roll events.
    -- MODE() WITHIN GROUP gives us the conference that appears most
    -- often; tied schools resolve to whichever the ordering picks.
    MODE() WITHIN GROUP (ORDER BY conference) AS conference
  FROM (
    SELECT school, conference FROM program_roll_events
      WHERE school IS NOT NULL AND TRIM(school) <> ''
        AND conference IS NOT NULL AND TRIM(conference) <> ''
    UNION ALL
    SELECT committed_school AS school, conference FROM program_roll_events
      WHERE committed_school IS NOT NULL AND TRIM(committed_school) <> ''
        AND conference IS NOT NULL AND TRIM(conference) <> ''
    UNION ALL
    -- program_photos has no conference column, so it contributes the
    -- name only — the MODE() above ignores its NULL conferences when
    -- a roll_events row exists for the same school.
    SELECT school, NULL::text AS conference FROM program_photos
      WHERE school IS NOT NULL AND TRIM(school) <> ''
  ) raw
  GROUP BY school
) s
WHERE NOT EXISTS (
  SELECT 1 FROM program_schools ex
   WHERE LOWER(ex.name) = LOWER(s.school)
);

-- Sanity check after run:
--   SELECT conference, COUNT(*) FROM program_schools GROUP BY conference;
