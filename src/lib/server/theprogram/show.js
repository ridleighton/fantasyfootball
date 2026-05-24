// ---------------- Drive image URL ----------------
// The classic `uc?export=view&id=…` link now serves an interstitial page in many cases.
// The thumbnail endpoint still returns the raw image and respects size hints.
export function driveImageUrl(id, size = 'w800') {
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${id}&sz=${size}`;
}

// ---------------- Odds parsing ----------------

// Extract a single numeric percentage from a free-form string.
export function parseOddsPercent(s) {
  if (s == null) return null;
  const str = String(s).trim();
  if (!str) return null;
  const pct = str.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (pct) return Number.parseFloat(pct[1]);
  const num = str.match(/(-?\d+(?:\.\d+)?)/);
  if (!num) return null;
  const n = Number.parseFloat(num[1]);
  if (Number.isNaN(n)) return null;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

// Parse a free-form odds string into [{ school, percent }, ...].
// Accepts forms like:
//   "Texas 40%, Oklahoma 35%, USC 25%"
//   "Texas: 40 | Oklahoma: 35 | USC: 25"
//   "Texas (40%); Oklahoma (35%)"
//   "Texas-40, Oklahoma-35"
//   "Texas 40%\nOklahoma 35%"
export function parseOddsPairs(s) {
  if (s == null) return [];
  const str = String(s).trim();
  if (!str) return [];

  const chunks = str.split(/[,|;\n]+/).map(c => c.trim()).filter(Boolean);
  const pairs = [];
  for (const chunk of chunks) {
    // Find the last numeric token in the chunk; everything before is school name.
    const numMatch = chunk.match(/(-?\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (!numMatch) continue;
    const numStart = chunk.lastIndexOf(numMatch[0]);
    let school = chunk.slice(0, numStart).trim();
    // Strip trailing punctuation/separators
    school = school.replace(/[:\-–—()[\]\s]+$/, '').trim();
    school = school.replace(/^[([\s]+/, '').trim();
    if (!school) continue;
    const percent = Number.parseFloat(numMatch[1]);
    if (Number.isNaN(percent)) continue;
    pairs.push({ school, percent });
  }
  return pairs;
}

// ---------------- Grouping ----------------

export function groupEvents(rows, conferenceOrder) {
  const byConference = new Map();
  for (const row of rows) {
    const conf = row.conference ?? '';
    if (!byConference.has(conf)) byConference.set(conf, new Map());
    const groups = byConference.get(conf);
    const key = `${row.player ?? ''}::${conf}`;
    if (!groups.has(key)) {
      groups.set(key, {
        conference: conf,
        player: row.player ?? '',
        type: row.type ?? '',
        rows: []
      });
    }
    groups.get(key).rows.push(row);
  }

  const orderedConfs = [];
  const seen = new Set();
  for (const c of conferenceOrder ?? []) {
    if (byConference.has(c)) { orderedConfs.push(c); seen.add(c); }
  }
  for (const c of [...byConference.keys()].sort()) {
    if (!seen.has(c)) orderedConfs.push(c);
  }

  const out = [];
  for (const c of orderedConfs) {
    const groups = byConference.get(c);
    for (const ev of groups.values()) out.push(ev);
  }
  return out;
}

// ---------------- Commit thresholds ----------------

export function commitThreshold(schoolCount) {
  if (schoolCount >= 6) return 8;
  if (schoolCount === 5) return 10;
  if (schoolCount === 4) return 12;
  return 15;
}

// Build commit-roll display data: parse the odds string for school→percentage pairs.
// Falls back to per-row (school column + odds column) if the odds string doesn't yield
// multiple pairs.
export function computeCommit(group) {
  // Prefer parsing the odds string. Use the first non-empty odds value in the group.
  let pairs = [];
  for (const r of group.rows) {
    const found = parseOddsPairs(r.odds);
    if (found.length >= 2) { pairs = found; break; }
  }

  if (pairs.length === 0) {
    // Fallback: one school per row, school in `school`, percentage in `odds`.
    const buckets = new Map();
    for (const r of group.rows) {
      const sch = (r.school ?? '').trim();
      if (!sch) continue;
      const pct = parseOddsPercent(r.odds);
      if (pct == null) continue;
      buckets.set(sch, (buckets.get(sch) ?? 0) + pct);
    }
    pairs = [...buckets.entries()].map(([school, percent]) => ({ school, percent }));
  } else {
    // De-duplicate school names (last occurrence wins)
    const dedup = new Map();
    for (const p of pairs) dedup.set(p.school, p.percent);
    pairs = [...dedup.entries()].map(([school, percent]) => ({ school, percent }));
  }

  const list = pairs.map(p => ({ school: p.school, raw: p.percent }));
  const threshold = commitThreshold(list.length);
  for (const s of list) s.eligible = s.raw >= threshold;
  const totalEligible = list.reduce((a, s) => a + (s.eligible ? s.raw : 0), 0);
  for (const s of list) {
    s.normalized = (s.eligible && totalEligible > 0) ? (s.raw / totalEligible) * 100 : 0;
  }
  return { schools: list, threshold };
}

// Steal: equal weights, no threshold. `eligible` is always true here so no
// "below cut" / threshold text ever surfaces for steals.
export function computeSteal(group) {
  const isLocked = group.rows.some(r => r.locked === true);
  const schoolsSet = new Set();
  for (const r of group.rows) {
    const sch = (r.school ?? '').trim();
    if (sch) schoolsSet.add(sch);
  }
  const schools = [...schoolsSet];
  const pct = schools.length > 0 ? 100 / schools.length : 0;
  return {
    locked: isLocked,
    schools: schools.map(s => ({ school: s, normalized: pct, eligible: true, raw: pct }))
  };
}

// Auto-commit: equal weights; if only one school, no roll.
export function computeAutoCommit(group) {
  const schoolsSet = new Set();
  for (const r of group.rows) {
    const sch = (r.school ?? '').trim();
    if (sch) schoolsSet.add(sch);
  }
  const schools = [...schoolsSet];
  const solo = schools.length === 1;
  const pct = schools.length > 0 ? 100 / schools.length : 0;
  return {
    solo,
    schools: schools.map(s => ({ school: s, normalized: pct, eligible: true, raw: pct }))
  };
}

// ---------------- Weighted draw ----------------

export function weightedPick(items, rng = Math.random) {
  const total = items.reduce((a, it) => a + Math.max(0, it.weight), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

// ---------------- Roll execution ----------------

export function executeRoll(group) {
  const type = (group.type ?? '').trim();
  if (type === 'Commit') {
    const { schools, threshold } = computeCommit(group);
    const eligible = schools.filter(s => s.eligible);
    if (eligible.length === 0) {
      return { outcome: 'commit_no_eligible', winner: null, display: { schools, threshold } };
    }
    const winner = weightedPick(
      eligible.map(s => ({ value: s.school, weight: s.normalized }))
    );
    return { outcome: 'commit', winner, display: { schools, threshold } };
  }

  if (type === 'Steal') {
    const data = computeSteal(group);
    if (data.locked) {
      return { outcome: 'steal_failed_locked', winner: null, display: data };
    }
    if (data.schools.length === 0) {
      return { outcome: 'steal_no_schools', winner: null, display: data };
    }
    const winner = weightedPick(
      data.schools.map(s => ({ value: s.school, weight: s.normalized }))
    );
    const winningRow = group.rows.find(r => (r.school ?? '').trim() === winner);
    const cameLate = winningRow?.in_original_roll === false;
    return {
      outcome: cameLate ? 'steal_late' : 'steal',
      winner,
      cameLate,
      display: data
    };
  }

  if (type === 'Auto-Commit') {
    const data = computeAutoCommit(group);
    if (data.solo) {
      return { outcome: 'auto_commit_solo', winner: data.schools[0].school, display: data };
    }
    if (data.schools.length === 0) {
      return { outcome: 'auto_commit_no_schools', winner: null, display: data };
    }
    const winner = weightedPick(
      data.schools.map(s => ({ value: s.school, weight: s.normalized }))
    );
    return { outcome: 'auto_commit', winner, display: data };
  }

  return { outcome: 'unknown_type', winner: null, display: { schools: [] } };
}

// ---------------- Photo resolution ----------------

export async function resolvePhotos(db, schoolNames) {
  const lowered = [...new Set(schoolNames.filter(Boolean).map(s => s.toLowerCase()))];
  const result = { schoolHelmets: {}, placeholder: null, locked: null };

  if (lowered.length > 0) {
    const res = await db.query(
      `SELECT school, google_file_id FROM program_photos
        WHERE type = 'School Helmet' AND LOWER(school) = ANY($1::text[])`,
      [lowered]
    );
    const grouped = new Map();
    for (const r of res.rows) {
      const k = (r.school ?? '').toLowerCase();
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(r.google_file_id);
    }
    for (const [k, ids] of grouped) {
      result.schoolHelmets[k] = driveImageUrl(ids[Math.floor(Math.random() * ids.length)]);
    }
  }

  const specials = await db.query(
    `SELECT type, google_file_id FROM program_photos
      WHERE type IN ('Placeholder Helmet', 'Locked Image')
      ORDER BY id ASC`
  );
  for (const r of specials.rows) {
    if (r.type === 'Placeholder Helmet' && !result.placeholder) {
      result.placeholder = driveImageUrl(r.google_file_id, 'w600');
    }
    if (r.type === 'Locked Image' && !result.locked) {
      result.locked = driveImageUrl(r.google_file_id, 'w600');
    }
  }
  return result;
}

export function helmetForSchool(photos, schoolName) {
  if (!schoolName) return null;
  return photos.schoolHelmets[schoolName.toLowerCase()] ?? null;
}
