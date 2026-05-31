import { dev } from '$app/environment';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import {
  loadEventsForWeek,
  computeCommit,
  computeSteal,
  computeAutoCommit,
  resolvePhotos,
  helmetForSchool,
  colorsForSchool
} from '$lib/server/theprogram/show.js';
import {
  getShowOrder,
  normalizeRollType,
  lockedConferences,
  computePrioritySuggestions
} from '$lib/server/theprogram/priority.js';

const CONFERENCES = ['C1', 'C2', 'C3', 'C4', 'C5'];

// Dev-only mock so the show page renders all four backdrop surfaces
// (launcher + theater + finish) when DATABASE_URL isn't wired up locally.
function mockShowData() {
  const mkSchool = (school, raw) => ({
    school, raw, eligible: true, normalized: raw, helmet: null, colors: null
  });
  const sampleEvent = {
    globalIndex: 0,
    conference: 'C1',
    player: 'Sample Recruit',
    type: 'Commit',
    kind: 'commit',
    display: {
      schools: [
        mkSchool('Texas', 40),
        mkSchool('USC', 32),
        mkSchool('Oklahoma', 28)
      ],
      threshold: 15,
      solo: false
    },
    savedResult: null,
    rowIds: [],
    confIndex: 0
  };
  return {
    weekId: 0,
    weekNumber: 1,
    hasOrder: true,
    events: [sampleEvent],
    conferenceList: [
      { name: 'C1', events: [sampleEvent], total: 1, rolledCount: 0 },
      { name: 'C2', events: [], total: 0, rolledCount: 0 }
    ],
    placeholderHelmet: null,
    lockedImage: null,
    barsImage: null
  };
}

async function loadFromDb() {
  const { weekId, weekNumber } = await requireActiveWeek();
  const db = await createClient();
  try {
    const { events, conferenceOrder } = await loadEventsForWeek(db, weekId);
    const hasOrder = conferenceOrder.length > 0;

    if (!hasOrder) {
      // Still load the show-order + priority suggestions so the
      // Conference Order screen can render the per-conference Order
      // Review Grid below the picker. The new tables come from
      // db/program-priority.sql — tolerate their absence so the
      // screen still loads if that script hasn't been run yet.
      const [showOrder, suggestions, locked] = await Promise.all([
        getShowOrder(db, weekId).catch(() => ({})),
        computePrioritySuggestions(db, weekId).catch(() => ({})),
        lockedConferences(db, weekId).catch(() => new Set())
      ]);
      return {
        weekId,
        weekNumber,
        hasOrder: false,
        conferences: CONFERENCES,
        events: [],
        conferenceList: [],
        showOrder,
        prioritySuggestions: suggestions,
        lockedConferences: [...locked]
      };
    }

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
        helmet: helmetForSchool(photos, s.school),
        colors: colorsForSchool(photos, s.school)
      }));
      if (ev.display.committedSchool) {
        ev.display.committedSchoolHelmet = helmetForSchool(photos, ev.display.committedSchool);
      }
    }

    const byConf = new Map();
    for (const ev of decorated) {
      if (!byConf.has(ev.conference)) byConf.set(ev.conference, []);
      byConf.get(ev.conference).push(ev);
    }
    // Sort each conference by type (Steal → Auto-Commit → Commit) and
    // within type by the position recorded in program_show_order. The
    // position table is written at week-import time (import order) and
    // updated by the commissioner via the Order Review Grid (overrides).
    const TYPE_ORDER = { 'Steal': 0, 'Auto-Commit': 1, 'Commit': 2 };
    const showOrder = await getShowOrder(db, weekId).catch(() => ({}));
    function positionFor(ev) {
      const rt = normalizeRollType(ev.type);
      const block = showOrder?.[ev.conference]?.[rt];
      if (!block) return Number.MAX_SAFE_INTEGER;
      const hit = block.find(b => (b.player ?? '').toLowerCase() === (ev.player ?? '').toLowerCase());
      return hit ? hit.position : Number.MAX_SAFE_INTEGER;
    }
    for (const [, list] of byConf) {
      list.sort((a, b) => {
        const ta = TYPE_ORDER[a.type] ?? 99;
        const tb = TYPE_ORDER[b.type] ?? 99;
        if (ta !== tb) return ta - tb;
        const pa = positionFor(a);
        const pb = positionFor(b);
        if (pa !== pb) return pa - pb;
        return (a.player ?? '').localeCompare(b.player ?? '', undefined, { sensitivity: 'base' });
      });
      list.forEach((ev, i) => { ev.confIndex = i; });
    }
    const lockedConfs = await lockedConferences(db, weekId).catch(() => new Set());
    const prioritySuggestions = await computePrioritySuggestions(db, weekId).catch(() => ({}));

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
      barsImage: photos.bars,
      showOrder,
      prioritySuggestions,
      lockedConferences: [...lockedConfs]
    };
  } finally {
    await db.end();
  }
}

export async function load() {
  try {
    return await loadFromDb();
  } catch (e) {
    if (dev) return mockShowData();
    throw e;
  }
}
