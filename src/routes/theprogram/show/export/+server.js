import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { toCsv } from '$lib/server/theprogram/csv.js';
import {
  groupEvents,
  computeCommit,
  computeSteal,
  computeAutoCommit
} from '$lib/server/theprogram/show.js';

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

function outcomeFor(group) {
  const winner = group.rows.find(r => r.result)?.result ?? null;
  const isLocked = group.rows.some(r => r.locked === true);
  const schoolsSet = new Set(group.rows.map(r => (r.school ?? '').trim()).filter(Boolean));
  const schoolCount = schoolsSet.size;

  if (!winner) return '';

  if (group.type === 'Commit') {
    return `Committed to ${winner}`;
  }
  if (group.type === 'Steal') {
    if (winner === 'LOCKED' || isLocked) return 'Steal failed — locked';
    const winningRow = group.rows.find(r => (r.school ?? '').trim() === winner);
    if (winningRow?.in_original_roll === false) {
      return `Steal succeeded — moved to ${winner}`;
    }
    // If winner matches the player's original school we'd call it a loss; otherwise success.
    // Spec lists "Steal failed — lost roll" — interpret as a steal where the winner was already
    // in the original roll (not a fresh school).
    if (winningRow?.in_original_roll === true) {
      return 'Steal failed — lost roll';
    }
    return `Steal succeeded — moved to ${winner}`;
  }
  if (group.type === 'Auto-Commit') {
    if (schoolCount === 1) {
      return `Auto-commit awarded to ${winner} — no roll (sole school)`;
    }
    return `Auto-commit awarded to ${winner}`;
  }
  return '';
}

export async function GET() {
  const { weekId, weekNumber } = await requireActiveWeek();
  const db = await createClient();
  let events;
  try {
    const [rowsRes, orderRes] = await Promise.all([
      db.query(
        `SELECT id, conference, type, player, school, locked, in_original_roll,
                odds, result, committed_school
           FROM program_roll_events
          WHERE week_id = $1
          ORDER BY id ASC`,
        [weekId]
      ),
      db.query(
        `SELECT conference FROM program_conference_order
          WHERE week_id = $1 ORDER BY position ASC`,
        [weekId]
      )
    ]);
    events = groupEvents(rowsRes.rows, orderRes.rows.map(r => r.conference));
  } finally {
    await db.end();
  }

  const headers = ['Conference', 'Type', 'Player', 'Schools', 'Calculated Odds', 'Result', 'Outcome'];
  const data = events.map(ev => {
    const schools = [...new Set(ev.rows.map(r => (r.school ?? '').trim()).filter(Boolean))].join(', ');
    const odds = calculatedOddsStr(ev);
    const result = ev.rows.find(r => r.result)?.result ?? '';
    const outcome = outcomeFor(ev);
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
