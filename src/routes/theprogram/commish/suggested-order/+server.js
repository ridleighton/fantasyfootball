import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { computePrioritySuggestions, getShowOrder } from '$lib/server/theprogram/priority.js';

// Returns the current show-run order for each (conference, roll type) block
// merged with the priority-based suggestion for each player, so the commish
// can see — in the order the show will actually run — which recruits should
// move up or down and why. Read-only: does not write program_show_order.
export async function GET() {
  const { weekId } = await requireActiveWeek();
  const db = await createClient();
  try {
    const [currentOrder, suggestions] = await Promise.all([
      getShowOrder(db, weekId),
      computePrioritySuggestions(db, weekId)
    ]);

    // Union of conferences/roll types present in either source.
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

        // Index suggestions by lowercased player for matching.
        const byPlayer = new Map();
        for (const s of suggested) byPlayer.set(s.player.toLowerCase(), s);

        // Iterate in the actual show-run order (current position). If there
        // is no saved order yet, fall back to the suggested ordering.
        const base = current.length
          ? [...current].sort((a, b) => a.position - b.position)
          : suggested.map((s, i) => ({ player: s.player, position: i + 1, orderSource: 'suggested' }));

        const rows = base.map(row => {
          const s = byPlayer.get(row.player.toLowerCase());
          const suggestedPosition = s?.suggestedPosition ?? null;
          const delta = suggestedPosition != null ? row.position - suggestedPosition : null;
          return {
            player: row.player,
            currentPosition: row.position,
            suggestedPosition,
            delta, // > 0 means "move up", < 0 means "move down", 0 holds
            orderSource: row.orderSource,
            coachPriority: s?.coachPriority ?? null,
            schoolPriority: s?.schoolPriority ?? null,
            reason: s?.reason ?? null
          };
        });

        if (rows.length) blocks.push({ conference: conf, rollType, rows });
      }
    }

    return json({ blocks });
  } catch (e) {
    throw error(500, `Failed to compute suggested order: ${e.message}`);
  } finally {
    await db.end();
  }
}
