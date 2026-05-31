import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { parseCsv } from '$lib/server/theprogram/csv.js';

// POST body — either:
//   { csv: "Player,Tier,Rank\n..." }       // upload / paste
//   { rows: [{player, tier, rank}] }       // explicit
// Upserts on LOWER(player_name). Not week-scoped — this is the master
// list and carries forward until overwritten.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body) throw error(400, 'Body must be JSON with { csv } or { rows }.');

  let rows = [];
  if (typeof body.csv === 'string') {
    const parsed = parseCsv(body.csv);
    rows = parsed.rows.map(r => ({
      player: (r.player ?? r.player_name ?? '').trim(),
      tier: Number.parseInt(r.tier ?? '', 10),
      rank: Number.parseInt(r.rank ?? '', 10)
    }));
  } else if (Array.isArray(body.rows)) {
    rows = body.rows.map(r => ({
      player: String(r.player ?? '').trim(),
      tier: Number.parseInt(r.tier ?? '', 10),
      rank: Number.parseInt(r.rank ?? '', 10)
    }));
  } else {
    throw error(400, 'Provide either `csv` (string) or `rows` (array).');
  }

  const valid = rows.filter(
    r => r.player && Number.isInteger(r.tier) && r.tier > 0 && Number.isInteger(r.rank) && r.rank > 0
  );
  if (valid.length === 0) {
    throw error(400, 'No valid rows. Expected columns: Player, Tier, Rank.');
  }

  const db = await createClient();
  try {
    await db.query('BEGIN');
    for (const r of valid) {
      // The unique index is on LOWER(player_name); ON CONFLICT needs an
      // expression-matching constraint, which Postgres supports via the
      // index name. We use the index name from program-priority.sql.
      await db.query(
        `INSERT INTO program_player_rankings (player_name, tier, rank)
         VALUES ($1, $2, $3)
         ON CONFLICT (LOWER(player_name))
         DO UPDATE SET tier = EXCLUDED.tier,
                       rank = EXCLUDED.rank,
                       player_name = EXCLUDED.player_name,
                       updated_at = NOW()`,
        [r.player, r.tier, r.rank]
      );
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw error(500, `Could not save player rankings: ${e.message}`);
  } finally {
    await db.end();
  }
  return json({ ok: true, inserted: valid.length, skipped: rows.length - valid.length });
}

// PUT body — { id, tier?, rank? } — inline edit a single row.
export async function PUT({ request }) {
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.id)) throw error(400, 'Body must include `id`.');
  const tier = body.tier == null ? null : Number.parseInt(body.tier, 10);
  const rank = body.rank == null ? null : Number.parseInt(body.rank, 10);
  if (tier == null && rank == null) throw error(400, 'Nothing to update.');

  const db = await createClient();
  try {
    await db.query(
      `UPDATE program_player_rankings
          SET tier = COALESCE($2, tier),
              rank = COALESCE($3, rank),
              updated_at = NOW()
        WHERE id = $1`,
      [body.id, tier, rank]
    );
  } catch (e) {
    throw error(500, `Could not update ranking: ${e.message}`);
  } finally {
    await db.end();
  }
  return json({ ok: true });
}

export async function DELETE({ request }) {
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.id)) throw error(400, 'Body must include `id`.');
  const db = await createClient();
  try {
    await db.query(`DELETE FROM program_player_rankings WHERE id = $1`, [body.id]);
  } catch (e) {
    throw error(500, `Could not delete ranking: ${e.message}`);
  } finally {
    await db.end();
  }
  return json({ ok: true });
}
