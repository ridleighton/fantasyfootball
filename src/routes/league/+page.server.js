import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const result = await db.query(
      `SELECT id, sport, platform, commissioner_name, league_name, url,
              sort_order, winner,
              to_char(expiration_date, 'YYYY-MM-DD') AS expiration_date
       FROM fantasy_leagues
       ORDER BY sort_order ASC, id ASC`
    );
    return { leagues: result.rows };
  } catch (e) {
    console.error('leagues load error:', e);
    return { leagues: [] };
  } finally {
    await db.end();
  }
}
