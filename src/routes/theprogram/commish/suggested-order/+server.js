import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import {
  computePrioritySuggestions,
  getShowOrder,
  lockedConferences,
  diagnoseCoachMatching
} from '$lib/server/theprogram/priority.js';

// Returns each (conference, roll type) block in its current show-run order,
// annotated with the priority-based suggestion for every recruit, plus the
// set of locked conferences (a roll already executed → no reordering). The
// commish view renders this as a drag-to-reorder list with a live
// "move up/down because…" recommendation column. Read-only: ordering is
// committed via /theprogram/show/save-order, not here.
export async function GET() {
  const { weekId } = await requireActiveWeek();
  const db = await createClient();
  try {
    const [currentOrder, suggestions, locked, coachCntRes, rankCntRes, matchDiag] = await Promise.all([
      getShowOrder(db, weekId),
      computePrioritySuggestions(db, weekId),
      lockedConferences(db, weekId),
      db.query(`SELECT count(*)::int AS n FROM program_coach_priority_lists WHERE week_id = $1`, [weekId]).catch(() => ({ rows: [{ n: 0 }] })),
      db.query(`SELECT count(*)::int AS n FROM program_player_rankings`).catch(() => ({ rows: [{ n: 0 }] })),
      diagnoseCoachMatching(db, weekId).catch(() => null)
    ]);

    const confs = new Set([...Object.keys(currentOrder), ...Object.keys(suggestions)]);
    const blocks = [];

    // Diagnostics: how many commit recruits drew on each signal. If coach
    // lists exist but every recruit resolves to tier_rank, the lists aren't
    // matching the events (school-name mismatch).
    const sourceCounts = { coach: 0, slots: 0, school: 0, tier_rank: 0 };
    for (const conf of Object.keys(suggestions)) {
      for (const s of suggestions[conf]?.commit ?? []) {
        sourceCounts[s.orderSource] = (sourceCounts[s.orderSource] ?? 0) + 1;
      }
    }
    const meta = {
      coachEntries: coachCntRes.rows[0]?.n ?? 0,
      rankedPlayers: rankCntRes.rows[0]?.n ?? 0,
      sourceCounts,
      match: matchDiag
    };

    for (const conf of [...confs].sort((a, b) => a.localeCompare(b))) {
      const rollTypes = new Set([
        ...Object.keys(currentOrder[conf] ?? {}),
        ...Object.keys(suggestions[conf] ?? {})
      ]);

      for (const rollType of rollTypes) {
        const current = currentOrder[conf]?.[rollType] ?? [];
        const suggested = suggestions[conf]?.[rollType] ?? [];
        const byPlayer = new Map();
        for (const s of suggested) byPlayer.set(s.player.toLowerCase(), s);

        // Priority suggestions only apply to Commit blocks. Steals and
        // Auto-Commits are still reorderable, but carry no suggestion.
        const hasSuggestions = rollType === 'commit';

        // Emit rows in the actual show-run order. If no saved order exists
        // yet, fall back to the suggested ordering.
        const base = current.length
          ? [...current].sort((a, b) => a.position - b.position)
          : suggested.map((s, i) => ({ player: s.player, position: i + 1, orderSource: 'suggested' }));

        const rows = base.map(row => {
          const s = hasSuggestions ? byPlayer.get(row.player.toLowerCase()) : null;
          return {
            player: row.player,
            orderSource: row.orderSource,
            suggestedPosition: s?.suggestedPosition ?? null,
            coachPriority: s?.coachPriority ?? null,
            schoolPriority: s?.schoolPriority ?? null,
            reason: s?.reason ?? null,
            coachLists: s?.coachLists ?? []
          };
        });

        if (rows.length) {
          blocks.push({ conference: conf, rollType, locked: locked.has(conf), hasSuggestions, rows });
        }
      }
    }

    return json({ blocks, meta });
  } catch (e) {
    throw error(500, `Failed to compute suggested order: ${e.message}`);
  } finally {
    await db.end();
  }
}
