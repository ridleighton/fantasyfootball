// Priority Ordering System — server-side resolution + persistence.
//
// Tables touched:
//   program_show_order            (read + write — the canonical sequence)
//   program_coach_priority_lists  (read)
//   program_school_priority       (read)
//   program_player_rankings       (read)
//   program_roll_events           (read — for the block roster + relevant schools)
//
// The launcher and theater both read from program_show_order. Priority
// resolution is a separate computation surfaced as *suggestions* in the
// commissioner's Order Review Grid — it does NOT auto-apply to
// program_show_order. The commissioner accepts a suggestion by dragging
// the row into position, which writes an 'override' row.

import { parseOddsPairs } from './show.js';

// Map UI/CSV "type" strings to the canonical roll_type slug used in
// program_show_order. The CSV import uses 'Commit' / 'Steal' /
// 'Auto-Commit'; the DB column constraint expects the lowercase form.
export function normalizeRollType(t) {
  const s = (t ?? '').trim().toLowerCase();
  if (s === 'commit') return 'commit';
  if (s === 'steal') return 'steal';
  if (s === 'auto-commit' || s === 'autocommit' || s === 'auto commit') return 'auto-commit';
  return null;
}

// Schools relevant to a player's event. A coach's submission is only
// counted if that school appears here. Sources:
//   - commit / auto-commit: parse the odds string for school names
//   - steal: row.school for every row in the group, plus committed_school
function schoolsInEvent(group) {
  const out = new Set();
  const rollType = normalizeRollType(group.type);

  for (const r of group.rows ?? []) {
    if (rollType === 'steal') {
      const s = (r.school ?? '').trim();
      if (s) out.add(s);
      const c = (r.committed_school ?? '').trim();
      if (c) out.add(c);
    } else {
      // commit or auto-commit — odds string holds the pairs
      const pairs = parseOddsPairs(r.odds);
      for (const p of pairs) {
        const sch = (p.school ?? '').trim();
        if (sch) out.add(sch);
      }
      // also include row.school if set (auto-commit bidders sometimes
      // land in the school column without being in the odds string)
      const direct = (r.school ?? '').trim();
      if (direct) out.add(direct);
    }
  }
  return out;
}

function lower(s) { return (s ?? '').trim().toLowerCase(); }

// Group rows from program_roll_events into per-(conference, rollType) blocks
// preserving import row order within each block. Each block contains a list
// of { player, rows } in the order they were inserted.
function groupRowsForOrder(rows) {
  const blocks = new Map(); // key: `${conf}${rollType}` -> Map<playerKey, {player, rows}>
  for (const r of rows) {
    const rollType = normalizeRollType(r.type);
    if (!rollType) continue;
    const conf = r.conference ?? '';
    const player = r.player ?? '';
    const blockKey = `${conf}${rollType}`;
    if (!blocks.has(blockKey)) blocks.set(blockKey, new Map());
    const block = blocks.get(blockKey);
    const playerKey = lower(player);
    if (!block.has(playerKey)) {
      block.set(playerKey, { player, conference: conf, type: r.type, rows: [] });
    }
    block.get(playerKey).rows.push(r);
  }
  return blocks;
}

// ---------------- Import-order writer ----------------

// Write one row per (week, conference, rollType, player) in the order the
// player's first row appears in the import. Called inside the startWeek
// transaction so the show always has a valid order to read.
export async function writeImportOrder(db, weekId, eventRows) {
  await db.query('DELETE FROM program_show_order WHERE week_id = $1', [weekId]);
  const blocks = groupRowsForOrder(eventRows);

  for (const [blockKey, players] of blocks.entries()) {
    const [conference, rollType] = blockKey.split('');
    let pos = 1;
    for (const { player } of players.values()) {
      await db.query(
        `INSERT INTO program_show_order
           (week_id, conference, roll_type, player_name, position, order_source)
         VALUES ($1, $2, $3, $4, $5, 'import')`,
        [weekId, conference, rollType, player, pos]
      );
      pos += 1;
    }
  }
}

// ---------------- Reads ----------------

export async function getShowOrder(db, weekId) {
  const { rows } = await db.query(
    `SELECT conference, roll_type, player_name, position, order_source
     FROM program_show_order
     WHERE week_id = $1
     ORDER BY conference, roll_type, position`,
    [weekId]
  );
  // Shape: { [conf]: { [rollType]: [{player, position, orderSource}] } }
  const out = {};
  for (const r of rows) {
    if (!out[r.conference]) out[r.conference] = {};
    if (!out[r.conference][r.roll_type]) out[r.conference][r.roll_type] = [];
    out[r.conference][r.roll_type].push({
      player: r.player_name,
      position: r.position,
      orderSource: r.order_source
    });
  }
  return out;
}

// ---------------- Override writer ----------------

// Replace the order for a single (conference, rollType) block with the
// given orderedPlayers list. Each player not previously in the block is
// rejected (we never invent rows). Rows are upserted with
// order_source = 'override'.
export async function saveOverrideOrder(db, weekId, conference, rollType, orderedPlayers) {
  // Verify each player exists in the block already.
  const { rows: existing } = await db.query(
    `SELECT player_name FROM program_show_order
     WHERE week_id = $1 AND conference = $2 AND roll_type = $3`,
    [weekId, conference, rollType]
  );
  const known = new Set(existing.map(r => lower(r.player_name)));
  for (const p of orderedPlayers) {
    if (!known.has(lower(p))) {
      throw new Error(`Player "${p}" is not in this conference / roll-type block`);
    }
  }
  if (orderedPlayers.length !== existing.length) {
    throw new Error(
      `Override must include all ${existing.length} players in this block; got ${orderedPlayers.length}`
    );
  }

  // Rewrite the block. Two-step: clear positions to NULL via a temporary
  // negative value (the position unique-index would otherwise collide
  // during the renumber), then assign the new positions.
  await db.query('BEGIN');
  try {
    // Park existing rows at temporary negative positions so the unique
    // (week, conf, roll_type, position) constraint doesn't fight us.
    let park = -1;
    for (const r of existing) {
      await db.query(
        `UPDATE program_show_order
            SET position = $5
          WHERE week_id = $1 AND conference = $2 AND roll_type = $3
            AND LOWER(player_name) = LOWER($4)`,
        [weekId, conference, rollType, r.player_name, park]
      );
      park -= 1;
    }
    // Reassign in the requested order.
    let pos = 1;
    for (const p of orderedPlayers) {
      await db.query(
        `UPDATE program_show_order
            SET position = $5, order_source = 'override'
          WHERE week_id = $1 AND conference = $2 AND roll_type = $3
            AND LOWER(player_name) = LOWER($4)`,
        [weekId, conference, rollType, p, pos]
      );
      pos += 1;
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

// Restore import order for a single block. Reads the player list,
// preserves their natural import sequence by joining against the
// original program_roll_events insert order (id ASC), and rewrites
// positions with order_source = 'import'.
export async function resetBlockToImport(db, weekId, conference, rollType) {
  // The original import sequence is recoverable by ordering events by
  // their primary key (events were inserted serially in CSV order in the
  // startWeek transaction).
  const { rows } = await db.query(
    `SELECT player, MIN(id) AS first_id
       FROM program_roll_events
      WHERE week_id = $1 AND conference = $2 AND LOWER(type) = LOWER($3)
      GROUP BY player
      ORDER BY first_id`,
    [weekId, conference, rollType]
  );
  const ordered = rows.map(r => r.player);
  // Use saveOverrideOrder but flip order_source back to 'import' after.
  await saveOverrideOrder(db, weekId, conference, rollType, ordered);
  await db.query(
    `UPDATE program_show_order
        SET order_source = 'import'
      WHERE week_id = $1 AND conference = $2 AND roll_type = $3`,
    [weekId, conference, rollType]
  );
}

// ---------------- Lock check ----------------

// A conference is "locked" once any of its events has been rolled — i.e.
// has a non-null `result` (the column the roll endpoint writes the winner
// to; there is no `outcome` column on program_roll_events).
// Returns a Set of conference names that are locked for the week.
export async function lockedConferences(db, weekId) {
  const { rows } = await db.query(
    `SELECT DISTINCT conference
       FROM program_roll_events
      WHERE week_id = $1 AND result IS NOT NULL AND result <> ''`,
    [weekId]
  );
  return new Set(rows.map(r => r.conference));
}

// ---------------- Score helpers ----------------

// Normalize a numeric value to [0, 100] given the min/max bounds.
// Lower raw → 0, higher raw → 100. When all values tie, everyone gets 0.
export function normalizeScore(raw, min, max) {
  if (raw == null) return null;
  if (max === min) return 0;
  return ((raw - min) / (max - min)) * 100;
}

// Weighted blend per spec: 0.5 / 0.3 / 0.2.
// Missing components contribute their weight back to the remaining ones
// proportionally so a player with only a coach score isn't unfairly
// boosted by phantom zeros at the lower levels.
export function blendScores({ coach, school, tierRank }) {
  const parts = [];
  if (coach != null) parts.push({ w: 0.5, v: coach });
  if (school != null) parts.push({ w: 0.3, v: school });
  if (tierRank != null) parts.push({ w: 0.2, v: tierRank });
  if (parts.length === 0) return null;
  const totalW = parts.reduce((a, p) => a + p.w, 0);
  return parts.reduce((a, p) => a + (p.v * p.w / totalW), 0);
}

// ---------------- Priority resolution ----------------

// Produce per-player suggestion records for every block in the week.
// Output shape:
//   { [conf]: { [rollType]: [{
//       player, suggestedPosition, reason, orderSource
//     }] } }
// Sorted ascending by suggestedPosition within each block.
export async function computePrioritySuggestions(db, weekId) {
  const [eventsRes, coachRes, schoolPriRes, rankingsRes] = await Promise.all([
    db.query(
      `SELECT id, conference, type, player, school, committed_school, odds, in_original_roll
         FROM program_roll_events WHERE week_id = $1 ORDER BY id`,
      [weekId]
    ),
    db.query(
      `SELECT school_name, player_name, conference, priority
         FROM program_coach_priority_lists WHERE week_id = $1`,
      [weekId]
    ),
    db.query(`SELECT school_name, priority FROM program_school_priority`),
    db.query(`SELECT player_name, tier, rank FROM program_player_rankings`)
  ]);

  const eventRows = eventsRes.rows;
  const coachRows = coachRes.rows;
  const schoolPri = new Map(schoolPriRes.rows.map(r => [lower(r.school_name), r.priority]));
  const playerRank = new Map(
    rankingsRes.rows.map(r => [lower(r.player_name), { tier: r.tier, rank: r.rank }])
  );

  const blocks = groupRowsForOrder(eventRows);
  const out = {};

  for (const [blockKey, players] of blocks.entries()) {
    const [conference, rollType] = blockKey.split('');

    // Build a per-player resolution record.
    const playerList = [...players.values()];
    const resolutions = playerList.map((g, idx) => {
      const schools = schoolsInEvent(g);
      const playerLower = lower(g.player);
      const confLower = lower(conference);

      // All coach submissions for this player this week — filter to
      // schools that appear in this event AND the same conference.
      const subs = coachRows.filter(c =>
        lower(c.player_name) === playerLower
        && lower(c.conference) === confLower
        && schools.has((c.school_name ?? '').trim())
      );

      // Level 1: coach priority.
      let coachScoreRaw = null;
      let coachConflict = false;
      if (subs.length === 1) {
        coachScoreRaw = subs[0].priority;
      } else if (subs.length > 1) {
        const uniqPri = new Set(subs.map(s => s.priority));
        if (uniqPri.size === 1) {
          coachScoreRaw = subs[0].priority;
        } else {
          coachConflict = true;
        }
      }

      // Level 2: school priority. Only used to resolve Level 1 conflicts
      // OR as a standalone score input when the blend reaches it.
      let schoolScoreRaw = null;
      let schoolResolvedCoach = false;
      if (subs.length > 0) {
        // Determine the "winning" school: lowest (best) school priority
        // among the submitting schools. Schools without an explicit
        // priority sort to last (assigned Infinity).
        const withPri = subs.map(s => ({
          sub: s,
          schoolPri: schoolPri.has(lower(s.school_name))
            ? schoolPri.get(lower(s.school_name))
            : Infinity
        }));
        const minSchoolPri = Math.min(...withPri.map(w => w.schoolPri));
        const winners = withPri.filter(w => w.schoolPri === minSchoolPri);
        schoolScoreRaw = Number.isFinite(minSchoolPri) ? minSchoolPri : null;
        if (coachConflict && winners.length === 1) {
          // Level 2 resolved the Level 1 conflict — adopt the winning
          // school's coach priority as the coach score.
          coachScoreRaw = winners[0].sub.priority;
          coachConflict = false;
          schoolResolvedCoach = true;
        } else if (coachConflict && winners.length > 1) {
          // Tied on school priority too → both Level 1 and Level 2
          // inconclusive. Fall through to Level 3.
          const winnerPriorities = new Set(winners.map(w => w.sub.priority));
          if (winnerPriorities.size === 1) {
            coachScoreRaw = [...winnerPriorities][0];
            coachConflict = false;
            schoolResolvedCoach = true;
          }
        }
      }

      // Level 3: tier/rank — always computed if available.
      const ranking = playerRank.get(playerLower);
      // Lower-is-better composite: tier weighted heavily, rank as tiebreaker.
      const tierRankRaw = ranking ? ranking.tier * 1000 + ranking.rank : null;

      // Decide order_source label.
      let orderSource;
      if (coachScoreRaw != null && !coachConflict && !schoolResolvedCoach && subs.length > 0) {
        orderSource = 'coach';
      } else if (schoolResolvedCoach) {
        orderSource = 'school';
      } else if (subs.length === 0 || (coachConflict && schoolScoreRaw == null)) {
        orderSource = 'tier_rank';
      } else {
        orderSource = 'tier_rank';
      }

      // Players with no coach signal sort to the END within their
      // tier/rank group, so we bin them separately later.
      const hasCoachSignal = subs.length > 0 && coachScoreRaw != null;
      const hasRanking = ranking != null;

      // Build a human-readable reason string.
      let reason;
      if (subs.length === 0 && !hasRanking) {
        reason = 'No coach list or ranking data — suggested position matches import order';
      } else if (subs.length === 0 && hasRanking) {
        reason = `No coach list — tier ${ranking.tier}, rank ${ranking.rank} places this player at #__POS__`;
      } else if (orderSource === 'coach') {
        reason = `Coach lists rank this player #${coachScoreRaw} within this block — clean Level 1 resolution`;
      } else if (orderSource === 'school') {
        const winSchool = subs.find(s => s.priority === coachScoreRaw)?.school_name ?? '?';
        const winPri = schoolPri.get(lower(winSchool));
        reason = `Coach lists conflict — school priority (${winSchool} #${winPri ?? 'unset'}) places this player at #__POS__`;
      } else if (coachConflict) {
        reason = hasRanking
          ? `Coach lists conflict, school priority tied — tier ${ranking.tier}, rank ${ranking.rank} places this player at #__POS__`
          : 'Coach lists conflict and no ranking data — sorted to bottom';
      } else {
        reason = hasRanking
          ? `Blended — tier ${ranking.tier}, rank ${ranking.rank} contributes Level 3`
          : 'Blended — partial signal';
      }

      return {
        player: g.player,
        importIndex: idx,
        coachScoreRaw,
        schoolScoreRaw,
        tierRankRaw,
        hasCoachSignal,
        hasRanking,
        orderSource,
        reason
      };
    });

    // Normalize component scores across this block.
    const coachBounds = bounds(resolutions, r => r.coachScoreRaw);
    const schoolBounds = bounds(resolutions, r => r.schoolScoreRaw);
    const tierRankBounds = bounds(resolutions, r => r.tierRankRaw);

    for (const r of resolutions) {
      r.coachScore = normalizeScore(r.coachScoreRaw, coachBounds.min, coachBounds.max);
      r.schoolScore = normalizeScore(r.schoolScoreRaw, schoolBounds.min, schoolBounds.max);
      r.tierRankScore = normalizeScore(r.tierRankRaw, tierRankBounds.min, tierRankBounds.max);
      r.blended = blendScores({
        coach: r.coachScore,
        school: r.schoolScore,
        tierRank: r.tierRankScore
      });
    }

    // Sort: players with a coach signal first (by blended score),
    // then players with only a ranking (by tier/rank), then players
    // with neither (in import order).
    const bucketCoach = resolutions.filter(r => r.hasCoachSignal).sort(byScore);
    const bucketRank = resolutions
      .filter(r => !r.hasCoachSignal && r.hasRanking)
      .sort(byScore);
    const bucketNone = resolutions
      .filter(r => !r.hasCoachSignal && !r.hasRanking)
      .sort((a, b) => a.importIndex - b.importIndex);

    const ordered = [...bucketCoach, ...bucketRank, ...bucketNone];
    if (!out[conference]) out[conference] = {};
    out[conference][rollType] = ordered.map((r, i) => ({
      player: r.player,
      suggestedPosition: i + 1,
      reason: r.reason.replace('#__POS__', `#${i + 1}`),
      orderSource: r.orderSource,
      // Show-order priority inputs, surfaced so the move can be explained
      // ("coach priority #1, school priority #2"). null when not applicable.
      coachPriority: r.coachScoreRaw,
      schoolPriority: r.schoolScoreRaw
    }));
  }

  return out;
}

function bounds(list, accessor) {
  let min = Infinity, max = -Infinity, any = false;
  for (const r of list) {
    const v = accessor(r);
    if (v == null) continue;
    any = true;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return any ? { min, max } : { min: 0, max: 0 };
}

function byScore(a, b) {
  // Both have blended scores; lower is earlier. NaN/null sorts last.
  const av = a.blended ?? Infinity;
  const bv = b.blended ?? Infinity;
  if (av !== bv) return av - bv;
  return a.importIndex - b.importIndex;
}
