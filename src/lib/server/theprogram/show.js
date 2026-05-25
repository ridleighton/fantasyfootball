import { imgurDirectUrl } from './imgur.js';

// ---------------- Image URL resolution ----------------
// Prefers the new image_url column (Imgur or any direct image host);
// falls back to a legacy google_file_id for rows not yet migrated.
export function driveImageUrl(id, size = 'w800') {
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${id}&sz=${size}`;
}

export function photoUrl(row, size = 'w800') {
  if (!row) return null;
  const direct = imgurDirectUrl(row.image_url);
  if (direct) return direct;
  if (row.google_file_id) return driveImageUrl(row.google_file_id, size);
  return null;
}

// ---------------- Odds parsing ----------------

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

export function parseOddsPairs(s) {
  if (s == null) return [];
  const str = String(s).trim();
  if (!str) return [];

  const chunks = str.split(/[,|;\n]+/).map(c => c.trim()).filter(Boolean);
  const pairs = [];
  for (const chunk of chunks) {
    const numMatch = chunk.match(/(-?\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (!numMatch) continue;
    const numStart = chunk.lastIndexOf(numMatch[0]);
    let school = chunk.slice(0, numStart).trim();
    school = school.replace(/[:\-–—()[\]\s]+$/, '').trim();
    school = school.replace(/^[([\s]+/, '').trim();
    if (!school) continue;
    const percent = Number.parseFloat(numMatch[1]);
    if (Number.isNaN(percent)) continue;
    pairs.push({ school, percent });
  }
  return pairs;
}

// Build a canonical odds string from a list of {school, percent} pairs.
export function buildOddsString(pairs) {
  return pairs
    .filter(p => p?.school && p.percent != null && !Number.isNaN(Number(p.percent)))
    .map(p => `${p.school.trim()} ${Number(p.percent).toFixed(1)}%`)
    .join(', ');
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

// Commit display: pulls schools from the Odds string. Works for any pair count
// (including 1). Falls back to per-row school + odds if the Odds string yields
// no pairs, which preserves backward compatibility with old data shapes.
export function computeCommit(group) {
  let pairs = [];
  for (const r of group.rows) {
    const found = parseOddsPairs(r.odds);
    if (found.length >= 1) {
      // Prefer the longest pair list we can find across rows
      if (found.length > pairs.length) pairs = found;
    }
  }

  if (pairs.length === 0) {
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
  // Solo: exactly one school in the running → no roll, just award.
  const eligibleCount = list.filter(s => s.eligible).length;
  const solo = list.length === 1 || eligibleCount === 1;
  return { schools: list, threshold, solo };
}

// Steal: equal weights across each row's school AND the committed school
// (if it's not already in the list). Locked is detected from any row.
// Committed school is always sorted first; remaining schools alphabetical.
// Each school carries `inOriginalRoll` from its row so we can tag late-joiners.
export function computeSteal(group) {
  const isLocked = group.rows.some(r => r.locked === true);
  const committedSchool = group.rows.find(r => (r.committed_school ?? '').trim())?.committed_school?.trim() ?? null;

  const inOriginalByLower = new Map();
  for (const r of group.rows) {
    const sch = (r.school ?? '').trim();
    if (!sch) continue;
    const key = sch.toLowerCase();
    if (!inOriginalByLower.has(key)) {
      inOriginalByLower.set(key, r.in_original_roll);
    }
  }

  const schoolsSet = new Set();
  for (const r of group.rows) {
    const sch = (r.school ?? '').trim();
    if (sch) schoolsSet.add(sch);
  }
  if (committedSchool) schoolsSet.add(committedSchool);

  const schools = [...schoolsSet];
  const pct = schools.length > 0 ? 100 / schools.length : 0;
  const committedLower = committedSchool ? committedSchool.toLowerCase() : null;

  const decorated = schools.map(s => ({
    school: s,
    normalized: pct,
    eligible: true,
    raw: pct,
    isCommitted: committedLower && s.toLowerCase() === committedLower,
    inOriginalRoll: inOriginalByLower.get(s.toLowerCase()) ?? null
  }));

  decorated.sort((a, b) => {
    if (a.isCommitted) return -1;
    if (b.isCommitted) return 1;
    return a.school.localeCompare(b.school, undefined, { sensitivity: 'base' });
  });

  // Late-joiners (in_original_roll === false) are disqualified from the
  // draw. If no eligible stealers remain (only late-joiners attempted),
  // the steal can't really happen — no roll at all.
  const eligibleStealerCount = decorated.filter(
    s => !s.isCommitted && s.inOriginalRoll !== false
  ).length;
  const noRealAttempt = !isLocked && eligibleStealerCount === 0;

  return {
    locked: isLocked,
    committedSchool,
    noRealAttempt,
    schools: decorated
  };
}

// Auto-commit (new flow):
//   - `odds` column on each row holds the FULL commit-style odds string for
//     the underlying recruitment, identical across all rows in the group.
//     We parse it to build the Phase 1 school list (with thresholds + the
//     crimson X badge etc — exactly like a commit display).
//   - `school` column on each row identifies which school submitted the
//     auto-commit (the "bidders"). One row per bidder; multiple bidders
//     means multiple rows for the same recruit. We expose this list as
//     `autoCommitSchools` so the client can run the megaphone burst on
//     those cards and drop the others.
//   - Auto-commit eligibility is NOT gated by the threshold — a bidder
//     who's below the commit cut still wins their auto-commit. The
//     threshold treatment is purely visual for Phase 1.
//
// Legacy fallback: if the odds string has no parsable pairs, fall back to
// the per-row schools with equal weights so old data still renders.
export function computeAutoCommit(group) {
  let pairs = [];
  for (const r of group.rows) {
    const found = parseOddsPairs(r.odds);
    if (found.length > pairs.length) pairs = found;
  }

  // Collect auto-commit bidders from row.school columns (unique).
  const acSet = new Set();
  for (const r of group.rows) {
    const sch = (r.school ?? '').trim();
    if (sch) acSet.add(sch);
  }
  const autoCommitSchools = [...acSet];

  if (pairs.length === 0) {
    // Legacy fallback: no odds string → display equal-weight cards from
    // the per-row school columns, no threshold.
    const schools = autoCommitSchools.length > 0
      ? autoCommitSchools
      : [];
    const pct = schools.length > 0 ? 100 / schools.length : 0;
    return {
      schools: schools.map(s => ({
        school: s, normalized: pct, eligible: true, raw: pct
      })),
      threshold: 0,
      autoCommitSchools,
      solo: autoCommitSchools.length === 1,
      legacyShape: true
    };
  }

  // Dedup parsed pairs (last write wins).
  const dedup = new Map();
  for (const p of pairs) dedup.set(p.school, p.percent);
  const pairsList = [...dedup.entries()].map(([school, percent]) => ({ school, percent }));

  // Apply commit-style threshold + renormalize for Phase 1 display.
  const list = pairsList.map(p => ({ school: p.school, raw: p.percent }));
  const threshold = commitThreshold(list.length);
  for (const s of list) s.eligible = s.raw >= threshold;
  const totalEligible = list.reduce((a, s) => a + (s.eligible ? s.raw : 0), 0);
  for (const s of list) {
    s.normalized = (s.eligible && totalEligible > 0) ? (s.raw / totalEligible) * 100 : 0;
  }

  // If a bidder isn't already in the parsed odds list, append them at 0%
  // so the Phase 1 card still renders (auto-commit overrides eligibility,
  // per the spec — they still win even if they were below the cut).
  const listLower = new Set(list.map(s => s.school.toLowerCase()));
  for (const ac of autoCommitSchools) {
    if (!listLower.has(ac.toLowerCase())) {
      list.push({ school: ac, raw: 0, eligible: false, normalized: 0 });
    }
  }

  return {
    schools: list,
    threshold,
    autoCommitSchools,
    solo: autoCommitSchools.length === 1,
    legacyShape: false
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
    const { schools, threshold, solo } = computeCommit(group);
    const eligible = schools.filter(s => s.eligible);
    if (eligible.length === 0) {
      return { outcome: 'commit_no_eligible', winner: null, display: { schools, threshold, solo } };
    }
    if (solo) {
      return { outcome: 'commit_solo', winner: eligible[0].school, display: { schools, threshold, solo } };
    }
    const winner = weightedPick(eligible.map(s => ({ value: s.school, weight: s.normalized })));
    return { outcome: 'commit', winner, display: { schools, threshold, solo } };
  }

  if (type === 'Steal') {
    const data = computeSteal(group);
    if (data.locked) {
      // Save null so the result column gets the 'LOCKED' marker downstream.
      return { outcome: 'steal_failed_locked', winner: null, display: data };
    }
    if (data.schools.length === 0) {
      return { outcome: 'steal_no_schools', winner: null, display: data };
    }
    // Outcome 4: only late-joiners attempted. No roll, player stays.
    if (data.noRealAttempt) {
      return {
        outcome: 'steal_no_real_attempt',
        winner: data.committedSchool,
        display: data
      };
    }
    // Build the roll pool: committed + eligible (non-late) stealers, equal weights.
    const eligible = data.schools.filter(
      s => s.isCommitted || s.inOriginalRoll !== false
    );
    const winner = weightedPick(eligible.map(s => ({ value: s.school, weight: 1 })));
    const isStay = data.committedSchool && winner && winner.toLowerCase() === data.committedSchool.toLowerCase();
    if (isStay) {
      return { outcome: 'steal_failed_stayed', winner, display: data };
    }
    return { outcome: 'steal_succeeded', winner, display: data };
  }

  if (type === 'Auto-Commit') {
    const data = computeAutoCommit(group);
    const ac = data.autoCommitSchools ?? [];
    if (ac.length === 0) {
      return { outcome: 'auto_commit_no_schools', winner: null, display: data };
    }
    if (ac.length === 1) {
      // Sole bidder — wins automatically, no contested roll.
      return { outcome: 'auto_commit_solo_winner', winner: ac[0], display: data };
    }
    // Contested: equal-weight draw among bidders.
    const winner = weightedPick(ac.map(s => ({ value: s, weight: 1 })));
    return { outcome: 'auto_commit_contested', winner, display: data };
  }

  return { outcome: 'unknown_type', winner: null, display: { schools: [] } };
}

// ---------------- Photo resolution ----------------

export async function resolvePhotos(db, schoolNames) {
  const lowered = [...new Set(schoolNames.filter(Boolean).map(s => s.toLowerCase()))];
  const result = {
    schoolHelmets: {},         // lowered school → { url, primary, secondary }
    placeholder: null,
    locked: null,
    bars: null,
    logo: null
  };

  if (lowered.length > 0) {
    const res = await db.query(
      `SELECT school, image_url, google_file_id, primary_color, secondary_color
         FROM program_photos
        WHERE type = 'School Helmet' AND LOWER(school) = ANY($1::text[])`,
      [lowered]
    );
    const grouped = new Map();
    for (const r of res.rows) {
      const k = (r.school ?? '').toLowerCase();
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(r);
    }
    for (const [k, rows] of grouped) {
      const pick = rows[Math.floor(Math.random() * rows.length)];
      result.schoolHelmets[k] = {
        url: photoUrl(pick),
        primary: pick.primary_color ?? null,
        secondary: pick.secondary_color ?? null
      };
    }
  }

  const specials = await db.query(
    `SELECT type, image_url, google_file_id FROM program_photos
      WHERE type IN ('Placeholder Helmet', 'Locked Image', 'Bars', 'Logo')
      ORDER BY id ASC`
  );
  for (const r of specials.rows) {
    if (r.type === 'Placeholder Helmet' && !result.placeholder) {
      result.placeholder = photoUrl(r, 'w600');
    }
    if (r.type === 'Locked Image' && !result.locked) {
      result.locked = photoUrl(r, 'w600');
    }
    if (r.type === 'Bars' && !result.bars) {
      result.bars = photoUrl(r, 'w600');
    }
    if (r.type === 'Logo' && !result.logo) {
      result.logo = photoUrl(r, 'w400');
    }
  }
  return result;
}

export function helmetForSchool(photos, schoolName) {
  if (!schoolName) return null;
  return photos.schoolHelmets[schoolName.toLowerCase()]?.url ?? null;
}

export function colorsForSchool(photos, schoolName) {
  if (!schoolName) return null;
  const h = photos.schoolHelmets[schoolName.toLowerCase()];
  if (!h) return null;
  return { primary: h.primary, secondary: h.secondary };
}
