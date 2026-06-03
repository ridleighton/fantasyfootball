import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { addPlayerToRoster, RosterError } from '$lib/server/theprogram/roster.js';

// Parse the wide roster grid pasted from a spreadsheet:
//   row 1: school names, one per Player+Pos column pair
//   row 2: repeated "Player  Pos" header (skipped)
//   rows : player name + position aligned under each school
//   tail : "Total / QB / RB / ..." summary rows (skipped)
// Position isn't stored in program_roster, so only (school, player) is used.
function parseRosterGrid(text) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  const schoolCols = [];
  for (let c = 0; c < header.length; c += 2) {
    const name = (header[c] ?? '').trim();
    if (name) schoolCols.push({ school: name, col: c });
  }
  if (schoolCols.length === 0) return [];

  const out = [];
  const summaryWords = /^(total|qb|rb|wr|te|ath|ol|dl|db|lb|cb|s|k|p)$/i;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const first = (cells[0] ?? '').trim();
    if (/^total$/i.test(first)) break;
    if (/^player$/i.test(first)) continue;
    if (summaryWords.test(first) && (cells[1] ?? '').trim() !== '' && !Number.isNaN(Number(cells[1]))) continue;
    for (const sc of schoolCols) {
      const player = (cells[sc.col] ?? '').trim();
      if (player && !/^player$/i.test(player)) out.push({ school: sc.school, player });
    }
  }
  return out;
}

// POST { paste } — bulk-add manual players from the spreadsheet grid.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (typeof body?.paste !== 'string') throw error(400, 'Body must be { paste: string }.');

  const parsed = parseRosterGrid(body.paste);
  if (parsed.length === 0) throw error(400, 'No players found in the pasted grid.');

  const db = await createClient();
  try {
    const sc = await db.query(`SELECT name, conference FROM program_schools`).catch(() => ({ rows: [] }));
    const confMap = new Map(sc.rows.map(r => [r.name.toLowerCase(), r.conference]));

    let added = 0, skippedDup = 0, atCapacity = 0;
    const unknownSchools = new Set();

    for (const r of parsed) {
      const conference = confMap.get(r.school.toLowerCase());
      if (!conference) { unknownSchools.add(r.school); continue; }
      try {
        const row = await addPlayerToRoster(db, {
          schoolName: r.school, playerName: r.player, conference,
          source: 'manual', silentDuplicate: true
        });
        if (row) added++; else skippedDup++;
      } catch (e) {
        if (e instanceof RosterError && e.code === 'CAPACITY_FULL') atCapacity++;
        else throw e;
      }
    }

    return json({
      ok: true, added, skippedDup, atCapacity,
      unknownSchools: [...unknownSchools]
    });
  } catch (e) {
    if (e.status) throw e;
    throw error(500, `Import failed: ${e.message}`);
  } finally {
    await db.end();
  }
}
