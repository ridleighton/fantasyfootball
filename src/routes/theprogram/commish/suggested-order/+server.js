import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { computePrioritySuggestions } from '$lib/server/theprogram/priority.js';

// Computes the priority-based suggested show order for the active week and
// returns it grouped by conference -> roll type. Read-only: this does not
// write to program_show_order. The show view's drag-drop is where an order
// gets committed; this endpoint just surfaces the recommendation.
export async function GET() {
  const { weekId } = await requireActiveWeek();
  const db = await createClient();
  try {
    const suggestions = await computePrioritySuggestions(db, weekId);
    return json({ suggestions });
  } catch (e) {
    throw error(500, `Failed to compute suggestions: ${e.message}`);
  } finally {
    await db.end();
  }
}
