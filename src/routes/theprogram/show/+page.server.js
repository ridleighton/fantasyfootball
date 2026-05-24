import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import {
  groupEvents,
  computeCommit,
  computeSteal,
  computeAutoCommit,
  resolvePhotos,
  helmetForSchool
} from '$lib/server/theprogram/show.js';

const CONFERENCES = ['C1', 'C2', 'C3', 'C4', 'C5'];

export async function load() {
  const { weekId, weekNumber } = await requireActiveWeek();
  const db = await createClient();
  try {
    const [rowsRes, orderRes] = await Promise.all([
      db.query(
        `SELECT id, conference, type, player, school, locked, in_original_roll,
                odds, result, committed_school
           FROM program_roll_events
          WHERE week_id = $1
          ORDER BY id ASC`,
        [weekId]
      ),
      db.query(
        `SELECT conference, position FROM program_conference_order
          WHERE week_id = $1 ORDER BY position ASC`,
        [weekId]
      )
    ]);

    const conferenceOrder = orderRes.rows.map(r => r.conference);
    const hasOrder = conferenceOrder.length > 0;

    if (!hasOrder) {
      return {
        weekId,
        weekNumber,
        hasOrder: false,
        conferences: CONFERENCES,
        events: [],
        conferenceList: []
      };
    }

    const events = groupEvents(rowsRes.rows, conferenceOrder);

    const allSchools = new Set();
    const decorated = events.map((ev, i) => {
      let display, kind;
      if (ev.type === 'Commit') { display = computeCommit(ev); kind = 'commit'; }
      else if (ev.type === 'Steal') { display = computeSteal(ev); kind = 'steal'; }
      else if (ev.type === 'Auto-Commit') { display = computeAutoCommit(ev); kind = 'auto'; }
      else { display = { schools: [] }; kind = 'unknown'; }

      for (const s of display.schools ?? []) allSchools.add(s.school);
      if (display.committedSchool) allSchools.add(display.committedSchool);

      const savedResult = ev.rows.find(r => r.result)?.result ?? null;

      return {
        globalIndex: i,
        conference: ev.conference,
        player: ev.player,
        type: ev.type,
        kind,
        display,
        savedResult,
        rowIds: ev.rows.map(r => r.id)
      };
    });

    const photos = await resolvePhotos(db, [...allSchools]);
    for (const ev of decorated) {
      ev.display.schools = (ev.display.schools ?? []).map(s => ({
        ...s,
        helmet: helmetForSchool(photos, s.school)
      }));
      // Attach a helmet URL for the committed school for steal events (in case
      // it isn't already in display.schools).
      if (ev.display.committedSchool) {
        ev.display.committedSchoolHelmet = helmetForSchool(photos, ev.display.committedSchool);
      }
    }

    const byConf = new Map();
    for (const ev of decorated) {
      if (!byConf.has(ev.conference)) byConf.set(ev.conference, []);
      byConf.get(ev.conference).push(ev);
    }
    for (const [, list] of byConf) {
      list.forEach((ev, i) => { ev.confIndex = i; });
    }

    const conferenceList = conferenceOrder
      .filter(c => byConf.has(c))
      .map(name => {
        const events = byConf.get(name) ?? [];
        return {
          name,
          events,
          total: events.length,
          rolledCount: events.filter(e => e.savedResult).length
        };
      });

    return {
      weekId,
      weekNumber,
      hasOrder: true,
      events: decorated,
      conferenceList,
      placeholderHelmet: photos.placeholder,
      lockedImage: photos.locked,
      barsImage: photos.bars
    };
  } finally {
    await db.end();
  }
}
