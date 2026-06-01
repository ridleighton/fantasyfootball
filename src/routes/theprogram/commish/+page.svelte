<script>
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { data, form } = $props();

  let rows = $state(structuredClone(data.rows));
  let saving = $state(false);
  let lastSavedAt = $state(null);
  let tempIdCounter = -1;

  // ---- Top-level subtabs ----
  // Add new entries here to grow the commish view later.
  const TABS = [
    { key: 'players', label: 'Player Priority' },
    { key: 'schools', label: 'School Priority' },
    { key: 'show', label: 'Show Run' }
  ];
  let activeTab = $state('players');

  // The "original list" of recruits = every roll event EXCEPT flagged
  // late-joiners (in_original_roll === false). A null/unset flag means the
  // recruit was in the original roll by default — matching the show's
  // late-joiner logic in show.js. Reads from the live (possibly unsaved)
  // rows state so the view reflects edits on the Player Priority tab.
  const originalRecruits = $derived(rows.filter(r => r.in_original_roll !== false));

  // ---- Coach Priority Lists ----
  let coachPriorities = $state(structuredClone(data.coachPriorities ?? []));
  let cpCsv = $state('');
  let cpUploading = $state(false);
  let cpMessage = $state('');

  // Conference subtabs for the School Priority view. Each school's entries
  // all carry that school's conference, so we can both list the available
  // conferences and group schools beneath them.
  let schoolConf = $state('All');
  const schoolConferences = $derived(
    [...new Set(coachPriorities.map(r => r.conference).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  );

  const grouped = $derived(() => {
    const m = new Map();
    for (const r of coachPriorities) {
      if (schoolConf !== 'All' && r.conference !== schoolConf) continue;
      const k = r.school_name;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });
  const submittedSchools = $derived(new Set(coachPriorities.map(r => r.school_name.toLowerCase())));
  const missingSchools = $derived(
    (data.schools ?? []).filter(s => !submittedSchools.has(s.toLowerCase())).sort()
  );

  async function uploadCoachPriorities() {
    if (!cpCsv.trim()) { cpMessage = 'Paste a CSV first.'; return; }
    cpUploading = true; cpMessage = '';
    try {
      const r = await fetch('/theprogram/commish/coach-priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: cpCsv })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message ?? `HTTP ${r.status}`);
      cpMessage = `Saved ${body.inserted} row${body.inserted === 1 ? '' : 's'}` + (body.skipped ? ` (${body.skipped} skipped)` : '') + '.';
      cpCsv = '';
      await invalidateAll();
      coachPriorities = structuredClone(data.coachPriorities ?? []);
    } catch (e) {
      cpMessage = `Upload failed: ${e.message}`;
    } finally {
      cpUploading = false;
    }
  }

  async function deleteCoachRow(id) {
    if (!confirm('Delete this row?')) return;
    const r = await fetch('/theprogram/commish/coach-priorities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!r.ok) { cpMessage = `Delete failed (HTTP ${r.status}).`; return; }
    await invalidateAll();
    coachPriorities = structuredClone(data.coachPriorities ?? []);
  }

  async function clearCoachSchool(school) {
    if (!confirm(`Clear all entries for ${school}?`)) return;
    const r = await fetch('/theprogram/commish/coach-priorities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school })
    });
    if (!r.ok) { cpMessage = `Delete failed (HTTP ${r.status}).`; return; }
    await invalidateAll();
    coachPriorities = structuredClone(data.coachPriorities ?? []);
  }

  function addRow() {
    rows.push({
      id: tempIdCounter--,
      conference: '',
      type: '',
      player: '',
      school: '',
      locked: null,
      in_original_roll: null,
      odds: '',
      result: '',
      committed_school: ''
    });
  }

  function deleteRow(i) { rows.splice(i, 1); }

  function boolToSelect(v) {
    if (v === true) return 'true';
    if (v === false) return 'false';
    return '';
  }
  function selectToBool(v) {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  }

  function trackSave() {
    saving = true;
    return async ({ result, update }) => {
      await update({ reset: false });
      saving = false;
      if (result.type === 'success') {
        lastSavedAt = new Date().toLocaleTimeString();
      }
    };
  }
</script>

<svelte:head><title>Commish · Week {data.weekNumber}</title></svelte:head>

<div class="cv">
  <header class="cv-head">
    <div class="cv-head-l">
      <div class="cv-eyebrow">Recruiting Show — Editorial</div>
      <h1 class="cv-title tp-stack-head">
        <span class="tp-stack-small">The</span>
        <span class="tp-stack-big">Commish View</span>
      </h1>
      <div class="cv-meta">
        <span class="tp-stamp">Week {data.weekNumber}</span>
        <span class="cv-count">{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</span>
        {#if lastSavedAt}<span class="cv-saved">Saved at {lastSavedAt}</span>{/if}
      </div>
    </div>
    <div class="cv-head-r">
      <a href="/theprogram/" class="tp-pill tp-pill-small">Switch Weeks</a>
      <a href="/theprogram/commish/export" class="tp-pill tp-pill-small tp-pill-navy">CSV Export</a>
    </div>
  </header>

  <div class="cv-rule" aria-hidden="true"></div>

  <nav class="cv-tabs" role="tablist" aria-label="Commish sections">
    {#each TABS as tab}
      <button
        type="button"
        role="tab"
        class="cv-tab"
        class:active={activeTab === tab.key}
        aria-selected={activeTab === tab.key}
        onclick={() => activeTab = tab.key}
      >{tab.label}</button>
    {/each}
  </nav>

  {#if activeTab === 'players'}
  {#if form?.message}
    <div class="tp-alert tp-alert-error">{form.message}</div>
  {/if}

  <form method="POST" use:enhance={trackSave}>
    <input type="hidden" name="rows" value={JSON.stringify(rows)} />

    <div class="cv-table-wrap">
      <table class="cv-table">
        <thead>
          <tr>
            <th>Conference</th>
            <th>Type</th>
            <th>Player</th>
            <th>School</th>
            <th>Locked</th>
            <th>In Orig.</th>
            <th>Odds</th>
            <th>Result</th>
            <th>Committed School</th>
            <th aria-label="row actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i (row.id)}
            <tr>
              <td>
                <select bind:value={row.conference}>
                  <option value=""></option>
                  {#each data.conferences as c}
                    <option value={c}>{c}</option>
                  {/each}
                </select>
              </td>
              <td>
                <select bind:value={row.type}>
                  <option value=""></option>
                  {#each data.types as t}
                    <option value={t}>{t}</option>
                  {/each}
                </select>
              </td>
              <td><input type="text" bind:value={row.player} /></td>
              <td><input type="text" bind:value={row.school} /></td>
              <td>
                <select
                  value={boolToSelect(row.locked)}
                  onchange={(e) => row.locked = selectToBool(e.currentTarget.value)}
                >
                  <option value="">—</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </td>
              <td>
                <select
                  value={boolToSelect(row.in_original_roll)}
                  onchange={(e) => row.in_original_roll = selectToBool(e.currentTarget.value)}
                >
                  <option value="">—</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </td>
              <td><input type="text" bind:value={row.odds} class="cv-wide" /></td>
              <td><input type="text" bind:value={row.result} /></td>
              <td><input type="text" bind:value={row.committed_school} /></td>
              <td>
                <button type="button" class="cv-del" onclick={() => deleteRow(i)} aria-label="Delete row">×</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="cv-toolbar">
      <button type="button" class="tp-pill tp-pill-small" onclick={addRow}>+ Add Row</button>
      <button type="submit" class="tp-pill tp-pill-navy" disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  </form>
  {/if}

  {#if activeTab === 'schools'}
  <section class="cp-section">
    <header class="cp-head">
      <h2>Coach Priority Lists</h2>
      <p>Per-week priorities submitted by each coach. Columns: <code>School, Player, Conference, Priority</code>. Lower priority = higher preference.</p>
    </header>

    <nav class="cv-subtabs" role="tablist" aria-label="Filter schools by conference">
      <button
        type="button"
        role="tab"
        class="cv-subtab"
        class:active={schoolConf === 'All'}
        aria-selected={schoolConf === 'All'}
        onclick={() => schoolConf = 'All'}
      >All</button>
      {#each schoolConferences as conf}
        <button
          type="button"
          role="tab"
          class="cv-subtab"
          class:active={schoolConf === conf}
          aria-selected={schoolConf === conf}
          onclick={() => schoolConf = conf}
        >{conf}</button>
      {/each}
    </nav>

    <div class="cp-upload">
      <label class="tp-label" for="cp-csv">Paste CSV / TSV</label>
      <textarea id="cp-csv" rows="5" class="tp-field" bind:value={cpCsv}
        placeholder="School,Player,Conference,Priority&#10;Texas,John Doe,SEC,1&#10;Texas,Jane Roe,SEC,2"></textarea>
      <div class="cp-upload-row">
        <button type="button" class="tp-pill tp-pill-gold" onclick={uploadCoachPriorities} disabled={cpUploading}>
          {cpUploading ? 'Uploading…' : 'Upload'}
        </button>
        {#if cpMessage}<span class="cp-msg">{cpMessage}</span>{/if}
      </div>
    </div>

    {#if grouped().length === 0}
      <p class="cp-empty">
        {coachPriorities.length === 0
          ? 'No coach lists submitted for this week.'
          : `No lists in ${schoolConf}.`}
      </p>
    {:else}
      {#each grouped() as [school, entries] (school)}
        <div class="cp-school">
          <header class="cp-school-head">
            <h3>{school}</h3>
            <button type="button" class="tp-pill tp-pill-small" onclick={() => clearCoachSchool(school)}>Clear school</button>
          </header>
          <table class="cp-table">
            <thead>
              <tr><th>Priority</th><th>Player</th><th>Conference</th><th></th></tr>
            </thead>
            <tbody>
              {#each entries as e (e.id)}
                <tr>
                  <td>{e.priority}</td>
                  <td>{e.player_name}</td>
                  <td>{e.conference}</td>
                  <td><button type="button" class="cp-del" onclick={() => deleteCoachRow(e.id)} aria-label="Delete">×</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    {/if}

    {#if schoolConf === 'All' && missingSchools.length > 0}
      <div class="cp-missing">
        <h3>No list submitted</h3>
        <ul>
          {#each missingSchools as s}<li>{s}</li>{/each}
        </ul>
      </div>
    {/if}
  </section>
  {/if}

  {#if activeTab === 'show'}
  <section class="cv-show">
    <header class="cp-head">
      <h2>Show Run</h2>
      <p>Set the conference order, then roll each event live for the broadcast.</p>
    </header>
    <div class="cv-show-actions">
      <a href="/theprogram/show" class="tp-pill tp-pill-navy">Launch Show Run →</a>
      <a href="/theprogram/show/export" class="tp-pill tp-pill-small">Download Show CSV</a>
    </div>

    <div class="cv-orig">
      <h3>Original Recruit List</h3>
      {#if originalRecruits.length === 0}
        <p class="cp-empty">No recruits yet. Add rows on the Player Priority tab (recruits not flagged <strong>In Orig. = No</strong> appear here).</p>
      {:else}
        <table class="cp-table cv-orig-table">
          <thead>
            <tr>
              <th>Conference</th>
              <th>Recruit</th>
              <th>School</th>
              <th>Odds</th>
              <th>Result</th>
              <th>Committed School</th>
            </tr>
          </thead>
          <tbody>
            {#each originalRecruits as r (r.id)}
              <tr>
                <td>{r.conference ?? ''}</td>
                <td>{r.player ?? ''}</td>
                <td>{r.school ?? ''}</td>
                <td>{r.odds ?? ''}</td>
                <td>{r.result ?? ''}</td>
                <td>{r.committed_school ?? ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </section>
  {/if}
</div>

<style>
  .cv {
    max-width: 1500px;
    margin: 0 auto;
    padding: 36px 28px 60px;
  }
  .cv-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .cv-head-l { display: flex; flex-direction: column; gap: 6px; }
  .cv-head-r { display: flex; gap: 8px; }
  .cv-eyebrow {
    font-family: var(--tp-display);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .cv-title {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1;
    margin: 0;
  }
  .cv-meta {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 6px;
    font-size: 13px;
    color: var(--tp-muted);
  }
  .cv-count { font-style: italic; }
  .cv-saved {
    font-family: var(--tp-display);
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--tp-gold-2);
  }

  /* Gold underline rule beneath header (per styling brief) */
  .cv-rule {
    height: 2px;
    background: var(--tp-gold);
    margin: 14px 0 28px;
  }

  /* ---- Subtabs ---- */
  .cv-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 28px;
  }
  .cv-tab {
    padding: 9px 18px;
    background: var(--tp-cream);
    border: 1px solid var(--tp-navy);
    border-radius: 999px;
    color: var(--tp-navy);
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .cv-tab:hover { background: rgba(217, 164, 65, 0.18); }
  .cv-tab.active {
    background: var(--tp-navy);
    color: var(--tp-cream);
    border-color: var(--tp-gold);
  }

  /* Conference filter subtabs — lighter, square-ish chips */
  .cv-subtabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 22px;
  }
  .cv-subtab {
    padding: 5px 12px;
    background: transparent;
    border: 1px solid var(--tp-pewter);
    border-radius: 4px;
    color: var(--tp-navy-dark);
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .cv-subtab:hover { border-color: var(--tp-navy); }
  .cv-subtab.active {
    background: var(--tp-gold);
    border-color: var(--tp-gold);
    color: var(--tp-navy-dark);
  }

  /* Show Run tab */
  .cv-show { margin-top: 8px; }
  .cv-show-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
  }
  .cv-orig { margin-top: 36px; }
  .cv-orig h3 {
    font-family: var(--tp-display-condensed);
    font-size: 16px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--tp-navy-dark);
    margin: 0 0 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--tp-navy);
    box-shadow: 0 4px 0 -2px var(--tp-gold);
  }
  .cv-orig-table td { padding: 6px 10px; }
  .cv-orig-table th { padding: 8px 10px; }

  /* Spec: table sits directly on the cream page, no wrapper card. */
  .cv-table-wrap {
    background: transparent;
    border: none;
    overflow-x: auto;
  }
  .cv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    font-family: var(--tp-body);
    color: var(--tp-navy-dark);
  }
  /* Header row: crimson-ink text in display caps; 2px crimson bottom
     border, 1px gold rule 2px below it (via thead's box-shadow). */
  .cv-table thead {
    background: transparent;
  }
  .cv-table th {
    padding: 12px 10px;
    text-align: left;
    color: var(--tp-navy-dark);
    font-family: var(--tp-display-condensed);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    white-space: nowrap;
    border-bottom: 2px solid var(--tp-navy);
    box-shadow: 0 4px 0 -2px var(--tp-gold);
  }
  /* Body cells: hairline pewter column dividers, no row borders. */
  .cv-table td {
    padding: 6px 8px;
    border-right: 1px solid var(--tp-pewter);
    vertical-align: middle;
  }
  .cv-table td:last-child { border-right: none; }
  /* Alternating row backgrounds per spec — cream / cream-sunk. */
  .cv-table tbody tr:nth-child(odd)  { background: var(--tp-cream); }
  .cv-table tbody tr:nth-child(even) { background: var(--tp-cream-2); }
  .cv-table tbody tr:hover { background: rgba(217, 164, 65, 0.12); }

  /* Inline-edit inputs — quiet by default, on focus get the 1px
     crimson border + 1px gold hairline 2px below (notebook underline). */
  .cv-table input[type="text"],
  .cv-table select {
    width: 100%;
    padding: 7px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 2px;
    color: var(--tp-navy-dark);
    font-family: var(--tp-body);
    font-size: 14px;
    box-sizing: border-box;
  }
  .cv-table input[type="text"]:hover,
  .cv-table select:hover {
    background: var(--tp-cream);
  }
  .cv-table input[type="text"]:focus,
  .cv-table select:focus {
    outline: none;
    background: var(--tp-cream);
    border-color: var(--tp-navy);
    box-shadow: 0 4px 0 -2px var(--tp-gold);
  }
  .cv-wide { min-width: 240px; }
  .cv-del {
    background: transparent;
    border: 1px solid transparent;
    color: var(--tp-oxblood);
    border-radius: 3px;
    width: 28px;
    height: 28px;
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
  }
  .cv-del:hover {
    background: rgba(122, 31, 43, 0.1);
    border-color: var(--tp-oxblood);
  }

  .cv-toolbar {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  /* ---- Coach Priority Lists section ---- */
  .cp-section { margin-top: 8px; }
  .cp-head h2 {
    font-family: var(--tp-display-condensed);
    font-size: 22px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tp-navy-dark);
    margin: 0 0 6px;
  }
  .cp-head p { margin: 0 0 18px; color: var(--tp-navy-dark); }
  .cp-head code { font-family: ui-monospace, monospace; background: var(--tp-cream-2); padding: 1px 5px; border-radius: 2px; }
  .cp-upload { margin-bottom: 28px; }
  .cp-upload-row { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
  .cp-msg { font-size: 13px; color: var(--tp-navy-dark); font-style: italic; }
  .cp-empty { color: var(--tp-navy-dark); font-style: italic; }
  .cp-school { margin-bottom: 22px; }
  .cp-school-head {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--tp-pewter);
    margin-bottom: 8px;
  }
  .cp-school-head h3 {
    font-family: var(--tp-display-condensed);
    font-size: 15px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-navy-dark);
    margin: 0;
  }
  .cp-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--tp-body);
    color: var(--tp-navy-dark);
    font-size: 14px;
  }
  .cp-table th, .cp-table td { padding: 4px 8px; text-align: left; }
  .cp-table th { font-family: var(--tp-display-condensed); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--tp-navy-dark); }
  .cp-table tbody tr:nth-child(odd) { background: var(--tp-cream); }
  .cp-table tbody tr:nth-child(even) { background: var(--tp-cream-2); }
  .cp-del {
    background: none; border: none; cursor: pointer;
    color: var(--tp-navy-dark); font-size: 16px; line-height: 1;
    padding: 2px 6px;
  }
  .cp-del:hover { color: var(--tp-navy); }
  .cp-missing { margin-top: 22px; }
  .cp-missing h3 {
    font-family: var(--tp-display-condensed);
    font-size: 13px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-pewter-deep);
    margin: 0 0 8px;
  }
  .cp-missing ul { margin: 0; padding-left: 18px; color: var(--tp-pewter-deep); }
</style>
