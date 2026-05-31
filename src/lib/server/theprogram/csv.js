function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return lines.join('\r\n');
}

// ---------- CSV / TSV parser ----------
// Header row required. Returns rows as objects keyed by normalized
// header names (lower-cased, spaces -> underscores).

function splitLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function detectDelimiter(line) {
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

function parseLine(line, delim) {
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
      else if (ch === delim) { out.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function parseCsv(text) {
  const lines = splitLines(text).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delim).map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], delim);
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cells[j] ?? '';
    rows.push(row);
  }
  return { headers, rows };
}
