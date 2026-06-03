// Roster System — all DB logic for program_roster.
//
// Capacity rule: a school may have at most ACTIVE_LIMIT active players.
// Every capacity check reads program_roster_counts (the single source of
// truth). Player uniqueness is scoped to (player_name, conference),
// case-insensitive.

export const ACTIVE_LIMIT = 15;

// Typed errors so callers/endpoints can branch on .code.
export class RosterError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const lower = (s) => (s ?? '').trim().toLowerCase();

// Active count for one school (0 if none), read from the counts view.
async function activeCount(db, schoolName) {
  const res = await db.query(
    `SELECT active_count FROM program_roster_counts
      WHERE LOWER(school_name) = LOWER($1)`,
    [schoolName]
  );
  return Number(res.rows[0]?.active_count ?? 0);
}

// Map<school_name, active_count> for every school with roster rows.
export async function getRosterCounts(db) {
  const res = await db.query(
    `SELECT school_name, active_count FROM program_roster_counts`
  ).catch(() => ({ rows: [] }));
  const m = new Map();
  for (const r of res.rows) m.set(r.school_name, Number(r.active_count));
  return m;
}

// { active: [...], inactive: [...] } for one school, newest activity first.
export async function getRosterForSchool(db, schoolName) {
  const res = await db.query(
    `SELECT id, school_name, player_name, conference, status, source,
            week_id, roll_event_id, added_at, revoked_at, revoke_reason
       FROM program_roster
      WHERE LOWER(school_name) = LOWER($1)
      ORDER BY player_name ASC`,
    [schoolName]
  ).catch(() => ({ rows: [] }));
  return {
    active: res.rows.filter(r => r.status === 'active'),
    inactive: res.rows.filter(r => r.status === 'inactive')
  };
}

// True if an active entry already exists for this (school, player, conference).
async function activeDuplicateExists(db, { schoolName, playerName, conference }) {
  const res = await db.query(
    `SELECT 1 FROM program_roster
      WHERE status = 'active'
        AND LOWER(school_name) = LOWER($1)
        AND LOWER(player_name) = LOWER($2)
        AND LOWER(conference) = LOWER($3)
      LIMIT 1`,
    [schoolName, playerName, conference]
  );
  return res.rows.length > 0;
}

// Insert an active roster row after validating capacity + duplicate.
// Caller controls the transaction. Throws RosterError CAPACITY_FULL /
// DUPLICATE_PLAYER. `silentDuplicate` skips (returns null) instead of
// throwing on a duplicate — used by auto-population from show outcomes.
export async function addPlayerToRoster(db, opts) {
  const {
    schoolName, playerName, conference,
    source = 'manual', weekId = null, rollEventId = null,
    silentDuplicate = false
  } = opts;

  if (await activeCount(db, schoolName) >= ACTIVE_LIMIT) {
    throw new RosterError('CAPACITY_FULL', `${schoolName} is at capacity (${ACTIVE_LIMIT}/${ACTIVE_LIMIT}).`);
  }
  if (await activeDuplicateExists(db, { schoolName, playerName, conference })) {
    if (silentDuplicate) return null;
    throw new RosterError('DUPLICATE_PLAYER', `${playerName} is already on ${schoolName}'s active roster for ${conference}.`);
  }

  const res = await db.query(
    `INSERT INTO program_roster
       (school_name, player_name, conference, status, source, week_id, roll_event_id)
     VALUES ($1, $2, $3, 'active', $4, $5, $6)
     RETURNING id, school_name, player_name, conference, status, source,
               week_id, roll_event_id, added_at, revoked_at`,
    [schoolName, playerName, conference, source, weekId, rollEventId]
  );
  return res.rows[0];
}

// Move an active player to inactive, recording an optional reason. Caller
// controls the transaction.
export async function revokeScholarship(db, rosterId, reason = null) {
  const cleanReason = reason ? String(reason).trim() || null : null;
  const res = await db.query(
    `UPDATE program_roster
        SET status = 'inactive', revoked_at = now(), revoke_reason = $2
      WHERE id = $1
      RETURNING id, school_name, player_name, conference, status, source,
                week_id, roll_event_id, added_at, revoked_at, revoke_reason`,
    [rosterId, cleanReason]
  );
  if (res.rows.length === 0) throw new RosterError('NOT_FOUND', 'Roster entry not found.');
  return res.rows[0];
}

// Steal transfer: revoke the player's active entry at fromSchool and add a
// new active entry at toSchool, atomically. Caller controls the transaction.
// Throws CAPACITY_FULL if toSchool is at the limit at transfer time.
export async function transferPlayer(db, opts) {
  const { playerName, conference, fromSchool, toSchool, weekId = null, rollEventId = null } = opts;

  if (await activeCount(db, toSchool) >= ACTIVE_LIMIT) {
    throw new RosterError('CAPACITY_FULL', `${toSchool} is at capacity (${ACTIVE_LIMIT}/${ACTIVE_LIMIT}).`);
  }

  // Revoke the active entry at the committed school (if present).
  await db.query(
    `UPDATE program_roster
        SET status = 'inactive', revoked_at = now()
      WHERE status = 'active'
        AND LOWER(school_name) = LOWER($1)
        AND LOWER(player_name) = LOWER($2)
        AND LOWER(conference) = LOWER($3)`,
    [fromSchool, playerName, conference]
  );

  // Insert the active entry at the stealing school (skip if somehow dup).
  if (await activeDuplicateExists(db, { schoolName: toSchool, playerName, conference })) {
    return null;
  }
  const res = await db.query(
    `INSERT INTO program_roster
       (school_name, player_name, conference, status, source, week_id, roll_event_id)
     VALUES ($1, $2, $3, 'active', 'show', $4, $5)
     RETURNING id, school_name, player_name, conference, status, source,
               week_id, roll_event_id, added_at, revoked_at`,
    [toSchool, playerName, conference, weekId, rollEventId]
  );
  return res.rows[0];
}
