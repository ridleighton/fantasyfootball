import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { toCsv } from '$lib/server/theprogram/csv.js';
import {
  loadEventsForWeek,
  computeCommit,
  computeSteal,
  computeAutoCommit,
  formatOutcomeLabel
} from '$lib/server/theprogram/show.js';

// "Calculated Odds" is the live display percentages from the underlying
// computeX helpers. Note: if `odds` is edited between roll time and export,
// these percentages will reflect the *current* odds, not what was on screen
// at roll time. Acceptable for now — would require persisting display_odds
// at roll time to make it truly immutable.
function calculatedOddsStr(group) {
  let schools;
  if (group.type === 'Commit') schools = computeCommit(group).schools;
  else if (group.type === 'Steal') schools = computeSteal(group).schools;
  else if (group.type === 'Auto-Commit') schools = computeAutoCommit(group).schools;
  else schools = [];
  return schools
    .map(s => {
      const n = (s.eligible === false) ? 0 : (s.normalized ?? 0);
      return `${s.school}: ${n.toFixed(1)}%`;
    })
    .join(', ');
}

export async function GET() {
  const { weekId, weekNumber } = await requireActiveWeek();
  const db = await createClient();
  let events;
  try {
    ({ events } = await loadEventsForWeek(db, weekId));
  } finally {
    await db.end();
  }

  const headers = ['Conference', 'Type', 'Player', 'Schools', 'Calculated Odds', 'Result', 'Outcome'];
  const data = events.map(ev => {
    const schools = [...new Set(ev.rows.map(r => (r.school ?? '').trim()).filter(Boolean))].join(', ');
    const odds = calculatedOddsStr(ev);
    const result = ev.rows.find(r => r.result)?.result ?? '';
    const outcome = formatOutcomeLabel(ev);
    // 'LOCKED' is a marker for "no roll happened" — blank in the Result
    // column; the Outcome column carries the "Steal failed — locked" text.
    return [ev.conference, ev.type, ev.player, schools, odds, result === 'LOCKED' ? '' : result, outcome];
  });

  const body = toCsv(headers, data);
  const filename = `Week ${weekNumber} Show Results.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
