<script>
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  let rosters = $state(structuredClone(data.rosters ?? []));
  let activeConf = $state((data.conferences ?? [])[0] ?? 'C1');
  let drafts = $state({}); // school name -> new player input
  let saveMsg = $state('');
  let inactiveOpen = $state({}); // school name -> inactive section expanded?

  // ---- Bulk grid import ----
  let importText = $state('');
  let importing = $state(false);
  let showImport = $state(false);

  async function importRoster() {
    if (!importText.trim()) return;
    importing = true;
    saveMsg = '';
    try {
      const res = await fetch('/theprogram/rosters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paste: importText })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      saveMsg = `Imported ${body.imported} player${body.imported === 1 ? '' : 's'}.`
        + (body.unknownSchools?.length
          ? ` Not in Config (no conference assigned): ${body.unknownSchools.join(', ')}.`
          : '');
      importText = '';
      showImport = false;
      await invalidateAll();
      rosters = structuredClone(data.rosters ?? []);
    } catch (e) {
      saveMsg = `Import failed: ${e.message}`;
    } finally {
      importing = false;
    }
  }

  // Schools shown under the active conference: those mapped to it in
  // program_schools, plus any roster school already filed under it.
  const confSchools = $derived(() => {
    const seen = new Set();
    const list = [];
    for (const s of data.schools ?? []) {
      if (s.conference === activeConf && !seen.has(s.name.toLowerCase())) {
        seen.add(s.name.toLowerCase());
        list.push(s.name);
      }
    }
    for (const r of rosters) {
      if (r.conference === activeConf && !seen.has(r.school_name.toLowerCase())) {
        seen.add(r.school_name.toLowerCase());
        list.push(r.school_name);
      }
    }
    return list.sort((a, b) => a.localeCompare(b));
  });

  function rostersFor(school) {
    const k = school.toLowerCase();
    return rosters
      .filter(r => r.school_name.toLowerCase() === k)
      .sort((a, b) => a.player_name.localeCompare(b.player_name));
  }

  // Active players go in the main table; inactive players drop to a greyed
  // section at the bottom of each school.
  function splitFor(school) {
    const all = rostersFor(school);
    return {
      active: all.filter(e => e.status !== 'inactive'),
      inactive: all.filter(e => e.status === 'inactive')
    };
  }

  async function postEntry(payload) {
    saveMsg = 'Saving…';
    try {
      const res = await fetch('/theprogram/rosters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      saveMsg = 'Saved.';
      return body.row;
    } catch (e) {
      saveMsg = `Save failed: ${e.message}`;
      return null;
    }
  }

  async function addPlayer(school) {
    const name = (drafts[school] ?? '').trim();
    if (!name) return;
    const row = await postEntry({
      school, conference: activeConf, player: name, status: 'active', locked: false
    });
    if (row) {
      rosters.push(row);
      drafts[school] = '';
    }
  }

  async function saveEntry(entry) {
    const row = await postEntry({
      school: entry.school_name,
      conference: entry.conference,
      player: entry.player_name,
      position: entry.position,
      status: entry.status,
      locked: entry.locked,
      inactive_reason: entry.inactive_reason
    });
    if (row) {
      // Sync server-normalized fields back (locked/reason cleared by status).
      entry.locked = row.locked;
      entry.inactive_reason = row.inactive_reason;
      entry.week_added = row.week_added;
      entry.position = row.position;
    }
  }

  async function removeEntry(entry) {
    if (!confirm(`Remove ${entry.player_name} from ${entry.school_name}?`)) return;
    const res = await fetch('/theprogram/rosters', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id })
    });
    if (res.ok) {
      const i = rosters.indexOf(entry);
      if (i >= 0) rosters.splice(i, 1);
    } else {
      saveMsg = 'Delete failed.';
    }
  }
</script>

<svelte:head><title>Rosters · The Program</title></svelte:head>

<div class="rs">
  <header class="rs-head">
    <div class="rs-eyebrow">Recruiting Show — Editorial</div>
    <h1 class="rs-title tp-stack-head">
      <span class="tp-stack-small">School</span>
      <span class="tp-stack-big">Rosters</span>
    </h1>
  </header>

  <div class="rs-rule" aria-hidden="true"></div>

  <div class="rs-import">
    <button type="button" class="tp-pill tp-pill-small" onclick={() => showImport = !showImport}>
      {showImport ? 'Hide import' : 'Import roster grid'}
    </button>
    {#if showImport}
      <p class="rs-import-help">
        Paste a roster grid copied from a spreadsheet — one Player + Pos column pair per school,
        school names in the top row. Players upsert by school + name; conference is looked up from Config.
        Total/position-count summary rows are ignored.
      </p>
      <textarea
        class="tp-field rs-import-box"
        rows="8"
        bind:value={importText}
        placeholder={"Texas A&M\t\tOhio State\t\nPlayer\tPos\tPlayer\tPos\nKeisean Henderson\tQB\tJase Mathews\tWR"}
      ></textarea>
      <div class="rs-import-actions">
        <button type="button" class="tp-pill tp-pill-gold" onclick={importRoster} disabled={importing}>
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>
    {/if}
  </div>

  <nav class="cv-subtabs" role="tablist" aria-label="Conference">
    {#each data.conferences as conf}
      <button
        type="button"
        role="tab"
        class="cv-subtab"
        class:active={activeConf === conf}
        aria-selected={activeConf === conf}
        onclick={() => activeConf = conf}
      >{conf}</button>
    {/each}
  </nav>

  {#if saveMsg}<p class="rs-msg">{saveMsg}</p>{/if}

  {#if confSchools().length === 0}
    <p class="rs-empty">No schools in {activeConf}. Add schools under Config first.</p>
  {:else}
    {#each confSchools() as school (school)}
      {@const groups = splitFor(school)}
      <section class="rs-school">
        <header class="rs-school-head"><h2>{school}</h2></header>
        <table class="rs-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Status</th>
              <th>Locked</th>
              <th>Reason</th>
              <th>Week added</th>
              <th aria-label="actions"></th>
            </tr>
          </thead>
          <tbody>
            {#each groups.active as e (e.id)}
              {@render rosterRow(e)}
            {/each}
            {#if groups.active.length === 0}
              <tr><td colspan="7" class="rs-none">No active players.</td></tr>
            {/if}
          </tbody>
        </table>
        <div class="rs-add">
          <input
            type="text"
            class="tp-field"
            placeholder="Add player…"
            bind:value={drafts[school]}
            onkeydown={(ev) => { if (ev.key === 'Enter') addPlayer(school); }}
          />
          <button type="button" class="tp-pill tp-pill-small tp-pill-gold" onclick={() => addPlayer(school)}>+ Add</button>
        </div>

        {#if groups.inactive.length > 0}
          <div class="rs-inactive">
            <button
              type="button"
              class="rs-inactive-toggle"
              aria-expanded={!!inactiveOpen[school]}
              onclick={() => inactiveOpen[school] = !inactiveOpen[school]}
            >
              <span class="rs-caret" class:open={inactiveOpen[school]}>▸</span>
              Inactive · {groups.inactive.length}
            </button>
            {#if inactiveOpen[school]}
              <table class="rs-table rs-inactive-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pos</th>
                    <th>Status</th>
                    <th>Locked</th>
                    <th>Reason</th>
                    <th>Week added</th>
                    <th aria-label="actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each groups.inactive as e (e.id)}
                    {@render rosterRow(e)}
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</div>

{#snippet rosterRow(e)}
  <tr>
    <td>{e.player_name}</td>
    <td>
      <input type="text" class="rs-pos" bind:value={e.position} onblur={() => saveEntry(e)} />
    </td>
    <td>
      <select bind:value={e.status} onchange={() => saveEntry(e)}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </td>
    <td>
      {#if e.status === 'active'}
        <input type="checkbox" bind:checked={e.locked} onchange={() => saveEntry(e)} />
      {:else}
        <span class="rs-na">—</span>
      {/if}
    </td>
    <td>
      {#if e.status === 'inactive'}
        <input
          type="text"
          class="rs-reason"
          placeholder="Reason"
          bind:value={e.inactive_reason}
          onblur={() => saveEntry(e)}
        />
      {:else}
        <span class="rs-na">—</span>
      {/if}
    </td>
    <td class="rs-wk">{e.week_added != null ? `Wk ${e.week_added}` : '—'}</td>
    <td>
      <button type="button" class="rs-del" onclick={() => removeEntry(e)} aria-label="Remove">×</button>
    </td>
  </tr>
{/snippet}

<style>
  .rs { max-width: 1100px; margin: 0 auto; padding: 36px 28px 60px; }
  .rs-head { display: flex; flex-direction: column; gap: 6px; }
  .rs-eyebrow {
    font-family: var(--tp-display);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .rs-title {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1;
    margin: 0;
  }
  .rs-rule { height: 2px; background: var(--tp-gold); margin: 14px 0 24px; }

  .rs-import { margin-bottom: 24px; }
  .rs-import-help { font-size: 12px; color: var(--tp-pewter-deep); margin: 10px 0; max-width: 720px; line-height: 1.5; }
  .rs-import-box { width: 100%; max-width: 820px; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre; }
  .rs-import-actions { margin-top: 10px; }
  .rs-pos { width: 60px; padding: 4px 6px; border: 1px solid var(--tp-pewter); border-radius: 3px; background: var(--tp-cream); font-family: var(--tp-body); font-size: 13px; color: var(--tp-navy-dark); text-transform: uppercase; }
  .rs-msg { font-size: 13px; font-style: italic; color: var(--tp-gold-2, #b8860b); margin: 0 0 14px; }
  .rs-empty, .rs-none { color: var(--tp-pewter-deep); font-style: italic; }
  .rs-none { text-align: center; padding: 10px; }

  .cv-subtabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
  .cv-subtab {
    padding: 6px 16px;
    background: transparent;
    border: 1px solid var(--tp-pewter);
    border-radius: 4px;
    color: var(--tp-navy-dark);
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .cv-subtab:hover { border-color: var(--tp-navy); }
  .cv-subtab.active { background: var(--tp-gold); border-color: var(--tp-gold); color: var(--tp-navy-dark); }

  .rs-school { margin-bottom: 30px; }
  .rs-school-head h2 {
    font-family: var(--tp-display-condensed);
    font-size: 18px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--tp-navy-dark);
    margin: 0 0 8px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--tp-navy);
    box-shadow: 0 4px 0 -2px var(--tp-gold);
  }
  .rs-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--tp-body);
    color: var(--tp-navy-dark);
    font-size: 14px;
  }
  .rs-table th {
    text-align: left;
    padding: 8px 10px;
    font-family: var(--tp-display-condensed);
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--tp-pewter);
  }
  .rs-table td { padding: 6px 10px; border-bottom: 1px solid var(--tp-cream-2); vertical-align: middle; }
  .rs-table select, .rs-reason {
    padding: 5px 8px;
    border: 1px solid var(--tp-pewter);
    border-radius: 3px;
    background: var(--tp-cream);
    font-family: var(--tp-body);
    font-size: 13px;
    color: var(--tp-navy-dark);
  }
  .rs-reason { width: 100%; min-width: 160px; }
  .rs-na { color: var(--tp-pewter-deep); }
  .rs-wk { white-space: nowrap; font-family: var(--tp-display-condensed); letter-spacing: 0.04em; }
  .rs-del {
    background: transparent;
    border: 1px solid transparent;
    color: var(--tp-oxblood);
    border-radius: 3px;
    width: 26px; height: 26px;
    font-size: 16px; line-height: 1; cursor: pointer;
  }
  .rs-del:hover { background: rgba(122, 31, 43, 0.1); border-color: var(--tp-oxblood); }
  .rs-add { display: flex; gap: 8px; margin-top: 10px; max-width: 420px; }
  .rs-add .tp-field { flex: 1; }

  /* Inactive players — collapsible, greyed section at the bottom. */
  .rs-inactive {
    margin-top: 18px;
    padding-top: 6px;
    border-top: 1px dashed var(--tp-pewter);
  }
  .rs-inactive-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 4px 0;
    cursor: pointer;
    font-family: var(--tp-display-condensed);
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-pewter-deep);
  }
  .rs-inactive-toggle:hover { color: var(--tp-navy-dark); }
  .rs-caret { display: inline-block; transition: transform 0.15s; font-size: 10px; }
  .rs-caret.open { transform: rotate(90deg); }
  /* Only the table content is greyed — the count stays readable. */
  .rs-inactive-table { margin-top: 6px; opacity: 0.55; filter: grayscale(0.6); }
  .rs-inactive-table:hover { opacity: 0.85; }
</style>
