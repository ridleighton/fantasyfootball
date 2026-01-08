-- Fix week_type values that are numeric instead of text
-- This happens when season_type was accidentally stored in week_type column

-- Update numeric week_types to proper text values
-- Regular season games have week_type of '2' (should be 'regular')
UPDATE games
SET week_type = 'regular'
WHERE week_type = '2' OR week_type = '1';

-- Verify the fix
SELECT DISTINCT week_type, COUNT(*) as count
FROM games
GROUP BY week_type
ORDER BY week_type;
