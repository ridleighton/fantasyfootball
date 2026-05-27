<script>
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let rows = $state(structuredClone(data.rows));
  let saving = $state(false);
  let lastSavedAt = $state(null);
  let tempIdCounter = -1;

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
</style>
