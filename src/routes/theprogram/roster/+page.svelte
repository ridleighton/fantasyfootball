<script>
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  const LIMIT = data.activeLimit ?? 15;

  let roster = $state(structuredClone(data.roster ?? []));

  // Conference subtabs — one per configured conference.
  const conferences = $derived(data.conferences ?? []);
  let activeConf = $state((data.conferences ?? [])[0] ?? '');

  // Per-school UI state.
  let addOpen = $state({});       // school -> add form open?
  let addName = $state({});       // school -> player name
  let addConf = $state({});       // school -> conference
  let inactiveOpen = $state({});  // school -> inactive section expanded?
  let cardMsg = $state({});       // school -> inline message
  let revokeTarget = $state(null); // roster row pending revoke
  let revokeReason = $state('');   // reason input for the revoke modal
  let busy = $state(false);

  // Schools in the active conference (from Config).
  const confSchools = $derived(
    (data.schools ?? []).filter(s => s.conference === activeConf)
  );

  // Grid import.
  let showImport = $state(false);
  let importText = $state('');
  let importing = $state(false);
  let importMsg = $state('');

  function forSchool(school) {
    const k = school.toLowerCase();
    const rows = roster.filter(r => r.school_name.toLowerCase() === k);
    return {
      active: rows.filter(r => r.status === 'active'),
      inactive: rows.filter(r => r.status === 'inactive')
    };
  }

  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
  }

  function openAdd(school) {
    addOpen[school] = true;
    if (addConf[school] == null) {
      addConf[school] = data.schools.find(s => s.name === school)?.conference ?? (data.conferences[0] ?? '');
    }
  }

  async function submitAdd(school) {
    const player = (addName[school] ?? '').trim();
    const conference = (addConf[school] ?? '').trim();
    cardMsg[school] = '';
    if (!player) { cardMsg[school] = 'Player name is required.'; return; }
    if (!conference) { cardMsg[school] = 'Pick a conference.'; return; }
    busy = true;
    try {
      const res = await fetch('/theprogram/roster/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_name: school, player_name: player, conference })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      roster.push(body.row);
      addName[school] = '';
      addOpen[school] = false;
    } catch (e) {
      cardMsg[school] = e.message;
    } finally {
      busy = false;
    }
  }

  function openRevoke(row) {
    revokeTarget = row;
    revokeReason = '';
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    busy = true;
    const reason = revokeReason.trim();
    try {
      const res = await fetch('/theprogram/roster/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster_id: revokeTarget.id, reason })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      // Mutate the row in place — it drops to the inactive section.
      const row = roster.find(r => r.id === revokeTarget.id);
      if (row) {
        row.status = 'inactive';
        row.revoked_at = body.row?.revoked_at ?? new Date().toISOString();
        row.revoke_reason = body.row?.revoke_reason ?? (reason || null);
      }
      revokeTarget = null;
      revokeReason = '';
    } catch (e) {
      cardMsg[revokeTarget.school_name] = `Revoke failed: ${e.message}`;
      revokeTarget = null;
    } finally {
      busy = false;
    }
  }

  async function importGrid() {
    if (!importText.trim()) return;
    importing = true; importMsg = '';
    try {
      const res = await fetch('/theprogram/roster/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paste: importText })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      importMsg = `Added ${body.added}.`
        + (body.skippedDup ? ` ${body.skippedDup} already on a roster.` : '')
        + (body.atCapacity ? ` ${body.atCapacity} skipped (school full).` : '')
        + (body.unknownSchools?.length ? ` Not in Config: ${body.unknownSchools.join(', ')}.` : '');
      importText = '';
      await invalidateAll();
      roster = structuredClone(data.roster ?? []);
    } catch (e) {
      importMsg = `Import failed: ${e.message}`;
    } finally {
      importing = false;
    }
  }
</script>

<svelte:head><title>Roster · The Program</title></svelte:head>

<div class="rs">
  <header class="rs-head">
    <div class="rs-eyebrow">House Records</div>
    <h1 class="rs-title tp-stack-head">
      <span class="tp-stack-small">School</span>
      <span class="tp-stack-big">Roster</span>
    </h1>
    <p class="rs-sub">Persistent rosters across all weeks. Active players count toward the {LIMIT}-player limit; inactive players are a historical record.</p>
  </header>

  <div class="rs-rule" aria-hidden="true"></div>

  <div class="rs-import">
    <button type="button" class="tp-pill tp-pill-small" onclick={() => showImport = !showImport}>
      {showImport ? 'Hide import' : 'Import roster grid'}
    </button>
    {#if importMsg}<span class="rs-import-msg">{importMsg}</span>{/if}
    {#if showImport}
      <p class="rs-import-help">
        Paste a roster grid from a spreadsheet — one Player + Pos column pair per school, school names in the top row.
        Players are added as manual entries; conference is looked up from Config. Duplicates and full schools are skipped.
      </p>
      <textarea class="tp-field rs-import-box" rows="8" bind:value={importText}
        placeholder={"Texas A&M\t\tOhio State\t\nPlayer\tPos\tPlayer\tPos\nKeisean Henderson\tQB\tJase Mathews\tWR"}></textarea>
      <div>
        <button type="button" class="tp-pill tp-pill-gold" onclick={importGrid} disabled={importing}>
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>
    {/if}
  </div>

  <nav class="cv-subtabs" role="tablist" aria-label="Conference">
    {#each conferences as conf}
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

  {#if data.schools.length === 0}
    <p class="rs-empty">No schools yet. Add schools under Config first.</p>
  {:else if confSchools.length === 0}
    <p class="rs-empty">No schools in {activeConf}. Assign schools to this conference under Config.</p>
  {:else}
    <div class="rs-grid">
      {#each confSchools as s (s.name)}
        {@const g = forSchool(s.name)}
        {@const full = g.active.length >= LIMIT}
        <section class="rs-card" class:full>
          <header class="rs-card-head">
            {#if data.helmets[s.name]}
              <img class="rs-helmet" src={data.helmets[s.name]} alt="" referrerpolicy="no-referrer" />
            {/if}
            <div class="rs-card-title">
              <h2>{s.name}</h2>
              <span class="rs-count" class:full>{g.active.length} / {LIMIT}</span>
            </div>
          </header>

          {#if g.active.length === 0}
            <p class="rs-none">No active players.</p>
          {:else}
            <ul class="rs-list">
              {#each g.active as r (r.id)}
                <li class="rs-row">
                  <span class="rs-player">{r.player_name}</span>
                  <span class="rs-badge">{r.conference}</span>
                  <span class="rs-badge">{r.source === 'show' ? 'SHOW' : 'MANUAL'}</span>
                  {#if r.source === 'show' && r.week_id != null && data.weekMap[r.week_id] != null}
                    <span class="rs-badge rs-wk">WK {data.weekMap[r.week_id]}</span>
                  {/if}
                  <button type="button" class="rs-revoke" onclick={() => openRevoke(r)}>Revoke Scholarship</button>
                </li>
              {/each}
            </ul>
          {/if}

          {#if cardMsg[s.name]}<p class="rs-cardmsg">{cardMsg[s.name]}</p>{/if}

          {#if addOpen[s.name]}
            <div class="rs-add">
              <input type="text" class="tp-field" maxlength="100" placeholder="Player name"
                bind:value={addName[s.name]}
                onkeydown={(ev) => { if (ev.key === 'Enter') submitAdd(s.name); }} />
              <select class="tp-field" bind:value={addConf[s.name]}>
                {#each data.conferences as c}<option value={c}>{c}</option>{/each}
              </select>
              <button type="button" class="tp-pill tp-pill-small tp-pill-gold" onclick={() => submitAdd(s.name)} disabled={busy || full}>Add</button>
              <button type="button" class="tp-pill tp-pill-small" onclick={() => addOpen[s.name] = false}>Cancel</button>
            </div>
          {:else}
            <button type="button" class="tp-pill tp-pill-small rs-addbtn" onclick={() => openAdd(s.name)} disabled={full}>
              + Add Player
            </button>
            {#if full}<span class="rs-fullnote">At capacity — revoke a scholarship to add.</span>{/if}
          {/if}

          {#if g.inactive.length > 0}
            <div class="rs-inactive">
              <button type="button" class="rs-inactive-toggle"
                aria-expanded={!!inactiveOpen[s.name]}
                onclick={() => inactiveOpen[s.name] = !inactiveOpen[s.name]}>
                <span class="rs-caret" class:open={inactiveOpen[s.name]}>▸</span>
                Inactive · {g.inactive.length}
              </button>
              {#if inactiveOpen[s.name]}
                <ul class="rs-list rs-inactive-list">
                  {#each g.inactive as r (r.id)}
                    <li class="rs-row">
                      <span class="rs-player">{r.player_name}</span>
                      <span class="rs-badge">{r.source === 'show' ? 'SHOW' : 'MANUAL'}</span>
                      {#if r.revoked_at}<span class="rs-revoked">Revoked {fmtDate(r.revoked_at)}</span>{/if}
                      {#if r.revoke_reason}<span class="rs-reason">Reason: {r.revoke_reason}</span>{/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

{#if revokeTarget}
  <div class="rs-modal-backdrop" role="presentation" onclick={() => revokeTarget = null}>
    <div class="rs-modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
      <h3>Revoke scholarship for {revokeTarget.player_name}?</h3>
      <p>
        This moves {revokeTarget.player_name} from {revokeTarget.school_name}'s active roster to the inactive list.
        Their slot opens immediately. This cannot be undone from this page.
      </p>
      <label class="rs-reason-label" for="revoke-reason">Reason for removal (optional)</label>
      <input
        id="revoke-reason"
        type="text"
        class="tp-field rs-reason-input"
        maxlength="200"
        placeholder="e.g. transferred, decommitted, off the board"
        bind:value={revokeReason}
        onkeydown={(ev) => { if (ev.key === 'Enter') confirmRevoke(); }}
      />
      <div class="rs-modal-actions">
        <button type="button" class="tp-pill tp-pill-small" onclick={() => revokeTarget = null}>Cancel</button>
        <button type="button" class="tp-pill tp-pill-small rs-revoke" onclick={confirmRevoke} disabled={busy}>
          {busy ? 'Revoking…' : 'Revoke Scholarship'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .rs { max-width: 1300px; margin: 0 auto; padding: 36px 28px 60px; }
  .rs-head { display: flex; flex-direction: column; gap: 6px; }
  .rs-eyebrow {
    font-family: var(--tp-display); font-weight: 600; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--tp-muted);
  }
  .rs-title { font-size: 38px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1; margin: 0; }
  .rs-sub { margin: 4px 0 0; color: var(--tp-muted); font-style: italic; max-width: 760px; }
  .rs-rule { height: 2px; background: var(--tp-gold); margin: 14px 0 22px; }
  .rs-empty, .rs-none { color: var(--tp-pewter-deep); font-style: italic; }
  .rs-none { font-size: 13px; margin: 6px 0; }

  /* Conference subtabs (underline tab style) */
  .cv-subtabs {
    display: flex; flex-wrap: wrap; gap: 2px;
    border-bottom: 1px solid var(--tp-pewter);
    margin-bottom: 24px;
  }
  .cv-subtab {
    padding: 9px 16px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    margin-bottom: -1px;
    color: var(--tp-pewter-deep);
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .cv-subtab:hover { color: var(--tp-navy-dark); }
  .cv-subtab.active { color: var(--tp-navy); border-bottom-color: var(--tp-gold); }

  .rs-import { margin-bottom: 24px; }
  .rs-import-msg { margin-left: 10px; font-size: 12px; font-style: italic; color: var(--tp-navy-dark); }
  .rs-import-help { font-size: 12px; color: var(--tp-pewter-deep); margin: 10px 0; max-width: 720px; line-height: 1.5; }
  .rs-import-box { width: 100%; max-width: 820px; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre; margin-bottom: 10px; }

  .rs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 18px;
  }
  .rs-card {
    background: var(--tp-cream);
    border: 1px solid var(--tp-pewter);
    border-radius: 4px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* At-capacity card treatment. */
  .rs-card.full {
    background: rgba(122, 31, 43, 0.06);
    border: 2.5px solid var(--tp-oxblood);
    box-shadow: inset 0 0 0 1px var(--tp-gold);
  }
  .rs-card-head { display: flex; align-items: center; gap: 12px; }
  .rs-helmet { width: 44px; height: 44px; object-fit: contain; }
  .rs-card-title { display: flex; flex-direction: column; gap: 2px; }
  .rs-card-title h2 {
    font-family: var(--tp-display-condensed); font-size: 18px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--tp-navy-dark); margin: 0;
  }
  .rs-count {
    font-family: var(--tp-display-condensed); font-weight: 700; font-size: 13px;
    letter-spacing: 0.08em; color: var(--tp-pewter-deep);
  }
  .rs-count.full { color: var(--tp-oxblood); }

  .rs-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .rs-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 4px 0; border-bottom: 1px solid var(--tp-cream-2); }
  .rs-player { font-family: var(--tp-display-condensed); font-size: 14px; color: var(--tp-navy-dark); margin-right: 2px; }
  .rs-badge {
    font-family: var(--tp-display-condensed); font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--tp-pewter-deep);
    border: 1px solid var(--tp-pewter); border-radius: 3px; padding: 1px 6px;
  }
  .rs-wk { color: var(--tp-navy-dark); }
  .rs-revoke {
    margin-left: auto; background: transparent; border: 1px solid var(--tp-oxblood);
    color: var(--tp-oxblood); border-radius: 999px; padding: 3px 10px; font-size: 11px;
    font-family: var(--tp-display-condensed); letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
  }
  .rs-revoke:hover { background: rgba(122, 31, 43, 0.1); }

  .rs-addbtn { align-self: flex-start; }
  .rs-fullnote { font-size: 11px; font-style: italic; color: var(--tp-oxblood); margin-left: 8px; }
  .rs-cardmsg { font-size: 12px; color: var(--tp-oxblood); margin: 0; }
  .rs-add { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .rs-add .tp-field { flex: 1; min-width: 120px; }

  .rs-inactive { margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--tp-pewter); }
  .rs-inactive-toggle {
    display: flex; align-items: center; gap: 6px; background: none; border: none; padding: 4px 0; cursor: pointer;
    font-family: var(--tp-display-condensed); font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--tp-pewter-deep);
  }
  .rs-inactive-toggle:hover { color: var(--tp-navy-dark); }
  .rs-caret { display: inline-block; transition: transform 0.15s; font-size: 10px; }
  .rs-caret.open { transform: rotate(90deg); }
  .rs-inactive-list { margin-top: 4px; opacity: 0.55; }
  .rs-inactive-list:hover { opacity: 0.85; }
  .rs-revoked { font-style: italic; font-size: 12px; color: var(--tp-pewter-deep); margin-left: auto; }
  .rs-reason { flex-basis: 100%; font-size: 12px; font-style: italic; color: var(--tp-navy-dark); }

  .rs-modal-backdrop {
    position: fixed; inset: 0; background: rgba(20, 20, 30, 0.55);
    display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px;
  }
  .rs-modal {
    background: var(--tp-cream); border: 2px solid var(--tp-navy); border-radius: 6px;
    padding: 24px; max-width: 440px; box-shadow: 0 12px 40px rgba(0,0,0,0.3);
  }
  .rs-modal h3 {
    font-family: var(--tp-display-condensed); font-size: 18px; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--tp-navy-dark); margin: 0 0 10px;
  }
  .rs-modal p { color: var(--tp-navy-dark); font-size: 14px; line-height: 1.5; margin: 0 0 14px; }
  .rs-reason-label {
    display: block;
    font-family: var(--tp-display-condensed);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tp-pewter-deep);
    margin-bottom: 4px;
  }
  .rs-reason-input { width: 100%; margin-bottom: 18px; }
  .rs-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
