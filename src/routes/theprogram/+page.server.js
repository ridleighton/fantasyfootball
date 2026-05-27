import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { createClient } from '$lib/server/db.js';
import { parseRollEvents } from '$lib/server/theprogram/parse-roll-events.js';

export async function load() {
  try {
    const db = await createClient();
    try {
      const weeksRes = await db.query(
        `SELECT id, week_number FROM program_weeks ORDER BY week_number ASC`
      );
      return { weeks: weeksRes.rows };
    } finally {
      await db.end();
    }
  } catch (e) {
    // Dev-only DB fallback so the entry page still renders for design review
    // when DATABASE_URL isn't wired up locally.
    if (dev) return { weeks: [] };
    throw e;
  }
}

async function setActiveWeek(db, weekId) {
  await db.query(
    `INSERT INTO program_active_week (id, week_id, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET week_id = EXCLUDED.week_id, updated_at = NOW()`,
    [weekId]
  );
}

export const actions = {
  startWeek: async ({ request }) => {
    const form = await request.formData();
    const weekNumberRaw = form.get('week_number');
    const weekNumber = Number.parseInt(weekNumberRaw, 10);
    const pasted = (form.get('pasted_data') ?? '').toString();
    const file = form.get('csv_file');

    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 15) {
      return fail(400, { message: 'Week number must be an integer between 1 and 15.' });
    }

    let rawText = pasted.trim();
    if (!rawText && file && typeof file === 'object' && 'arrayBuffer' in file && file.size > 0) {
      const buf = await file.arrayBuffer();
      rawText = new TextDecoder('utf-8').decode(buf).trim();
    }

    if (!rawText) {
      return fail(400, { message: 'Provide a CSV file or paste the data into the textarea.' });
    }

    let records;
    try {
      records = parseRollEvents(rawText);
    } catch (e) {
      return fail(400, { message: `Could not parse input: ${e.message}` });
    }
    if (records.length === 0) {
      return fail(400, { message: 'No data rows found after parsing.' });
    }

    const db = await createClient();
    let createdWeekId;
    try {
      await db.query('BEGIN');

      const existing = await db.query(
        `SELECT id FROM program_weeks WHERE week_number = $1`,
        [weekNumber]
      );
      if (existing.rows.length > 0) {
        await db.query('ROLLBACK');
        return fail(400, { message: `Week ${weekNumber} already exists. Load it instead.` });
      }

      const weekInsert = await db.query(
        `INSERT INTO program_weeks (week_number) VALUES ($1) RETURNING id`,
        [weekNumber]
      );
      createdWeekId = weekInsert.rows[0].id;

      const insertSql = `
        INSERT INTO program_roll_events
          (week_id, conference, type, player, school, locked, in_original_roll, odds, committed_school)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      for (const r of records) {
        await db.query(insertSql, [
          createdWeekId,
          r.conference,
          r.type,
          r.player,
          r.school,
          r.locked,
          r.in_original_roll,
          r.odds,
          r.committed_school
        ]);
      }

      await setActiveWeek(db, createdWeekId);
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK').catch(() => {});
      return fail(500, { message: `Failed to create week: ${e.message}` });
    } finally {
      await db.end();
    }

    throw redirect(303, '/theprogram/commish');
  },

  loadWeek: async ({ request }) => {
    const form = await request.formData();
    const weekIdRaw = form.get('week_id');
    const weekId = Number.parseInt(weekIdRaw, 10);
    if (!Number.isInteger(weekId)) {
      return fail(400, { message: 'Select a week to load.' });
    }

    const db = await createClient();
    try {
      const exists = await db.query(`SELECT id FROM program_weeks WHERE id = $1`, [weekId]);
      if (exists.rows.length === 0) {
        return fail(400, { message: 'That week no longer exists.' });
      }
      await setActiveWeek(db, weekId);
    } catch (e) {
      return fail(500, { message: `Failed to set active week: ${e.message}` });
    } finally {
      await db.end();
    }

    throw redirect(303, '/theprogram/commish');
  }
};
