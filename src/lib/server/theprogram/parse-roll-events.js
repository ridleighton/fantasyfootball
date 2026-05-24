const COLUMNS = [
  'conference',
  'type',
  'player',
  'school',
  'locked',
  'in_original_roll',
  'odds',
  'committed_school'
];

const HEADER_ALIASES = {
  'conference': 'conference',
  'type': 'type',
  'player': 'player',
  'school': 'school',
  'locked': 'locked',
  'in_original_roll': 'in_original_roll',
  'in original roll': 'in_original_roll',
  'odds': 'odds',
  'committed_school': 'committed_school',
  'committed school': 'committed_school'
};

function splitLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { out.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

function parseLine(line, delimiter) {
  if (delimiter === '\t') return line.split('\t');
  return parseCsvLine(line);
}

function parseBool(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === '') return null;
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return false;
  return null;
}

function blankToNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function parseRollEvents(rawText) {
  const text = (rawText ?? '').trim();
  if (!text) return [];

  const lines = splitLines(text).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  // Detect header row: if the first row's first cell, normalized, matches a known alias, treat as header.
  const firstCells = parseLine(firstLine, delimiter).map(c => c.trim().toLowerCase());
  let columnOrder = COLUMNS;
  let dataStart = 0;
  if (firstCells.length > 0 && HEADER_ALIASES[firstCells[0]]) {
    columnOrder = firstCells.map(c => HEADER_ALIASES[c] ?? null);
    dataStart = 1;
  }

  const records = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cells = parseLine(lines[i], delimiter);
    const rec = {
      conference: null,
      type: null,
      player: null,
      school: null,
      locked: null,
      in_original_roll: null,
      odds: null,
      committed_school: null
    };
    for (let j = 0; j < cells.length && j < columnOrder.length; j++) {
      const col = columnOrder[j];
      if (!col) continue;
      const raw = cells[j];
      if (col === 'locked' || col === 'in_original_roll') {
        rec[col] = parseBool(raw);
      } else if (col === 'odds') {
        rec[col] = blankToNull(raw);
      } else {
        rec[col] = blankToNull(raw);
      }
    }
    // Skip entirely blank lines / rows missing required identity fields.
    if (!rec.conference && !rec.type && !rec.player) continue;
    records.push(rec);
  }
  return records;
}
