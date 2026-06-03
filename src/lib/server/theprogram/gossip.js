// "Gossip Girl" over-subscription check for commit rolls.
//
// When a commit roll is loaded, evaluate every school in on it. If a school
// is in the danger zone (13 or 14 active recruits) and is over-subscribed —
// in on more un-rolled commit rolls than it has open seats — and the roll
// currently loaded isn't that school's highest-priority remaining recruit,
// raise an advisory flag suggesting which recruit to roll next.
//
// Seats: 13 active -> 2 open, 14 active -> 1 open. Trigger when the number
// of un-rolled rolls the school is in on (X) exceeds its open seats.

import { loadEventsForWeek, parseOddsPairs } from './show.js';
import { getRosterCounts, ACTIVE_LIMIT } from './roster.js';

const lower = (s) => (s ?? '').trim().toLowerCase();

// Schools in on a commit event, parsed from the odds string(s).
function schoolsInCommit(ev) {
  const m = new Map(); // lower -> original casing
  for (const r of ev.rows ?? []) {
    for (const p of parseOddsPairs(r.odds)) {
      const s = (p.school ?? '').trim();
      if (s) m.set(s.toLowerCase(), s);
    }
  }
  return m;
}

const isUnrolled = (ev) => !(ev.rows ?? []).some(r => r.result);

export async function computeGossipFlags(db, weekId, eventIndex) {
  const { events } = await loadEventsForWeek(db, weekId);
  const current = events[eventIndex];
  if (!current || (current.type ?? '') !== 'Commit') return { schools: [] };

  const rcRaw = await getRosterCounts(db).catch(() => new Map());
  const counts = new Map([...rcRaw].map(([k, v]) => [lower(k), Number(v)]));

  const [coachRes, rankRes] = await Promise.all([
    db.query(
      `SELECT school_name, player_name, conference, priority
         FROM program_coach_priority_lists WHERE week_id = $1`,
      [weekId]
    ).catch(() => ({ rows: [] })),
    db.query(`SELECT player_name, tier, rank FROM program_player_rankings`)
      .catch(() => ({ rows: [] }))
  ]);

  const ranking = new Map(
    rankRes.rows.map(r => [lower(r.player_name), { tier: Number(r.tier), rank: Number(r.rank) }])
  );
  // school|player|conference -> priority
  const coachPri = new Map();
  for (const c of coachRes.rows) {
    coachPri.set(`${lower(c.school_name)}|${lower(c.player_name)}|${lower(c.conference)}`, Number(c.priority));
  }

  // All un-rolled commit events, with their global index (matches the
  // client's currentEvent.globalIndex).
  const unrolledCommits = events
    .map((ev, i) => ({ ev, globalIndex: i }))
    .filter(x => (x.ev.type ?? '') === 'Commit' && isUnrolled(x.ev));

  const cards = [];

  for (const [sLower, sName] of schoolsInCommit(current)) {
    const active = counts.get(sLower) ?? 0;
    if (active !== 13 && active !== 14) continue;          // danger zone only
    const seats = ACTIVE_LIMIT - active;                    // 2 or 1

    const inOn = unrolledCommits.filter(x => schoolsInCommit(x.ev).has(sLower));
    const x = inOn.length;
    if (x <= seats) continue;                               // not over-subscribed

    // Recommended order: priority-list tier (by priority), then ranking tier
    // (by tier, then rank). Players with neither sort last.
    const decorated = inOn.map(({ ev, globalIndex }) => {
      const pri = coachPri.get(`${sLower}|${lower(ev.player)}|${lower(ev.conference)}`);
      const rk = ranking.get(lower(ev.player)) ?? null;
      return {
        player: ev.player,
        conference: ev.conference,
        globalIndex,
        onPriority: pri != null,
        priority: pri ?? Infinity,
        tier: rk ? rk.tier : Infinity,
        rank: rk ? rk.rank : Infinity
      };
    });
    const tier1 = decorated.filter(d => d.onPriority).sort((a, b) => a.priority - b.priority);
    const tier2 = decorated.filter(d => !d.onPriority)
      .sort((a, b) => (a.tier - b.tier) || (a.rank - b.rank) || (a.globalIndex - b.globalIndex));
    const recommended = [...tier1, ...tier2];
    const top = recommended[0];
    if (!top) continue;

    // No flag if the roll already loaded IS the school's top remaining pick.
    if (lower(top.player) === lower(current.player) && lower(top.conference) === lower(current.conference)) {
      continue;
    }

    cards.push({
      school: sName,
      seats,
      x,
      player: top.player,
      reason: top.onPriority
        ? `they sit atop ${sName}'s priority list`
        : `they're the highest-ranked player ${sName} is still in on`,
      targetPlayer: top.player,
      targetConference: top.conference,
      gap: x - seats
    });
  }

  // Tightest squeeze first: fewest seats, then largest (X − seats) gap.
  cards.sort((a, b) => (a.seats - b.seats) || (b.gap - a.gap));
  return { schools: cards };
}
