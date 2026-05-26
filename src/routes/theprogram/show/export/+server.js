import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { toCsv } from '$lib/server/theprogram/csv.js';
import {
  loadEventsForWeek,
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
  const committedSchool =
    group.rows.find(r => (r.committed_school ?? '').trim())?.committed_school?.trim() ?? null;
  const isLocked = group.rows.some(r => r.locked === true);
  const schoolsSet = new Set(group.rows.map(r => (r.school ?? '').trim()).filter(Boolean));
  const schoolCount = schoolsSet.size;

  if (!winner) return '';

  if (group.type === 'Commit') {
    return `Committed to ${winner}`;
  }
  if (group.type === 'Steal') {
    if (isLocked) return 'Steal failed — locked';
    if (committedSchool && winner.toLowerCase() === committedSchool.toLowerCase()) {
      return 'Steal failed — stayed loyal';
    }
    return `Steal succeeded — moved to ${winner}`;
  }
  if (group.type === 'Auto-Commit') {
    // schoolCount here counts rows in the group = number of bidders.
    if (schoolCount === 1) {
      return `Auto-commit awarded to ${winner} — sole bidder`;
    }
    return `Auto-commit awarded to ${winner} — won contested roll`;
  }
  return '';
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
