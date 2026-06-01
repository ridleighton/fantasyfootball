import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import {
  computePrioritySuggestions,
  getShowOrder,
  lockedConferences
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
    const [currentOrder, suggestions, locked] = await Promise.all([
      getShowOrder(db, weekId),
      computePrioritySuggestions(db, weekId),
      lockedConferences(db, weekId)
    ]);

    const confs = new Set([...Object.keys(currentOrder), ...Object.keys(suggestions)]);
    const blocks = [];

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

        // Emit rows in the actual show-run order. If no saved order exists
        // yet, fall back to the suggested ordering.
        const base = current.length
          ? [...current].sort((a, b) => a.position - b.position)
          : suggested.map((s, i) => ({ player: s.player, position: i + 1, orderSource: 'suggested' }));

        const rows = base.map(row => {
          const s = byPlayer.get(row.player.toLowerCase());
          return {
            player: row.player,
            orderSource: row.orderSource,
            suggestedPosition: s?.suggestedPosition ?? null,
            coachPriority: s?.coachPriority ?? null,
            schoolPriority: s?.schoolPriority ?? null,
            reason: s?.reason ?? null
          };
        });

        if (rows.length) {
          blocks.push({ conference: conf, rollType, locked: locked.has(conf), rows });
        }
      }
    }

    return json({ blocks });
  } catch (e) {
    throw error(500, `Failed to compute suggested order: ${e.message}`);
  } finally {
    await db.end();
  }
}
