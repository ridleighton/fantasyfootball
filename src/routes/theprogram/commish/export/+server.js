import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { toCsv } from '$lib/server/theprogram/csv.js';

function boolToYesNo(v) {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return '';
}

export async function GET() {
  const { weekId, weekNumber } = await requireActiveWeek();
  const db = await createClient();
  let rows;
  try {
    const res = await db.query(
      `SELECT conference, type, player, school, locked, in_original_roll,
              odds, result, committed_school
         FROM program_roll_events
        WHERE week_id = $1
        ORDER BY id ASC`,
      [weekId]
    );
    rows = res.rows;
  } finally {
    await db.end();
  }

  const headers = [
    'Conference', 'Type', 'Player', 'School',
    'Locked', 'In_Original_Roll', 'Odds', 'Result', 'Committed School'
  ];
  const data = rows.map(r => [
    r.conference, r.type, r.player, r.school,
    boolToYesNo(r.locked), boolToYesNo(r.in_original_roll),
    r.odds, r.result, r.committed_school
  ]);

  const body = toCsv(headers, data);
  const filename = `Week ${weekNumber} Recruiting Results.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
