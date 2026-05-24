<script>
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let conferences = $state(structuredClone(data.conferences));
  let schools = $state(structuredClone(data.schools));
  let photos = $state(structuredClone(data.photos));

  let saving = $state(false);
  let lastSavedAt = $state(null);
  let tempId = -1;

  function driveUrl(id) {
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : null;
  }

  function addConference() { conferences.push({ id: tempId--, name: '' }); }
  function addSchool() { schools.push({ id: tempId--, name: '', conference: '' }); }
  function addPhoto() { photos.push({ id: tempId--, type: 'School Helmet', school: '', google_file_id: '' }); }

  const payload = $derived(JSON.stringify({ conferences, schools, photos }));

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

<svelte:head><title>Config · The Program</title></svelte:head>

<div class="cf">
  <header class="cf-head">
    <div class="cf-eyebrow">House Records</div>
    <h1 class="cf-title tp-stack-head">
      <span class="tp-stack-small">The</span>
      <span class="tp-stack-big">Config</span>
    </h1>
    <p class="cf-sub">
      Conferences, schools, and photo assets — kept in good order.
      {#if lastSavedAt}<span class="cf-saved">Saved at {lastSavedAt}</span>{/if}
    </p>
  </header>

  <div class="cv-rule" aria-hidden="true"></div>

  {#if form?.message}
    <div class="tp-alert tp-alert-error">{form.message}</div>
  {/if}
  {#if form?.success}
    <div class="tp-alert tp-alert-ok">Saved.</div>
  {/if}

  <form method="POST" use:enhance={trackSave}>
    <input type="hidden" name="payload" value={payload} />

    <!-- Conferences -->
    <section class="cf-section tp-card">
      <div class="cf-section-head">
        <div class="cf-section-title">
          <span class="cf-section-num">§ I</span>
          <h2>Conferences</h2>
        </div>
        <button type="button" class="tp-pill tp-pill-small" onclick={addConference}>+ Add</button>
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead><tr><th>Name</th><th aria-label="actions"></th></tr></thead>
          <tbody>
            {#each conferences as c, i (c.id)}
              <tr>
                <td><input type="text" bind:value={c.name} placeholder="e.g. C1" /></td>
                <td><button type="button" class="cf-del" onclick={() => conferences.splice(i, 1)}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <div class="tp-divider"><span class="tp-divider-ornament">★</span></div>

    <!-- Schools -->
    <section class="cf-section tp-card">
      <div class="cf-section-head">
        <div class="cf-section-title">
          <span class="cf-section-num">§ II</span>
          <h2>Schools</h2>
        </div>
        <button type="button" class="tp-pill tp-pill-small" onclick={addSchool}>+ Add</button>
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead><tr><th>Name</th><th>Conference</th><th aria-label="actions"></th></tr></thead>
          <tbody>
            {#each schools as s, i (s.id)}
              <tr>
                <td><input type="text" bind:value={s.name} placeholder="School name" /></td>
                <td>
                  <select bind:value={s.conference}>
                    <option value=""></option>
                    {#each conferences as c}
                      {#if c.name}<option value={c.name}>{c.name}</option>{/if}
                    {/each}
                  </select>
                </td>
                <td><button type="button" class="cf-del" onclick={() => schools.splice(i, 1)}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <div class="tp-divider"><span class="tp-divider-ornament">★</span></div>

    <!-- Photos -->
    <section class="cf-section tp-card">
      <div class="cf-section-head">
        <div class="cf-section-title">
          <span class="cf-section-num">§ III</span>
          <h2>Photo Table</h2>
        </div>
        <button type="button" class="tp-pill tp-pill-small" onclick={addPhoto}>+ Add</button>
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>School</th>
              <th>Google File ID</th>
              <th>Preview</th>
              <th aria-label="actions"></th>
            </tr>
          </thead>
          <tbody>
            {#each photos as p, i (p.id)}
              <tr>
                <td>
                  <select bind:value={p.type}>
                    {#each data.photoTypes as t}
                      <option value={t}>{t}</option>
                    {/each}
                  </select>
                </td>
                <td><input type="text" bind:value={p.school} placeholder="(optional)" /></td>
                <td><input type="text" bind:value={p.google_file_id} placeholder="File ID" /></td>
                <td>
                  {#if p.google_file_id}
                    <a href={driveUrl(p.google_file_id)} target="_blank" rel="noopener" class="cf-thumb-link">
                      <img src={driveUrl(p.google_file_id)} alt="" class="cf-thumb" />
                    </a>
                  {:else}
                    <span class="cf-muted">—</span>
                  {/if}
                </td>
                <td><button type="button" class="cf-del" onclick={() => photos.splice(i, 1)}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <div class="cf-toolbar">
      <button type="submit" class="tp-pill tp-pill-navy" disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  </form>
</div>

<style>
  .cf {
    max-width: 1100px;
    margin: 0 auto;
    padding: 36px 28px 60px;
  }
  .cf-head { text-align: left; }
  .cf-eyebrow {
    font-family: var(--tp-display);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .cf-title {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1;
    margin: 4px 0 6px;
  }
  .cf-sub {
    margin: 0;
    color: var(--tp-muted);
    font-style: italic;
  }
  .cf-saved {
    margin-left: 10px;
    font-family: var(--tp-display);
    font-style: normal;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--tp-gold-2);
  }
  .cv-rule {
    height: 2px;
    background: linear-gradient(90deg, var(--tp-navy) 0, var(--tp-navy) 60%, var(--tp-gold) 60%, var(--tp-gold) 100%);
    margin: 14px 0 28px;
  }

  .cf-section { overflow: hidden; margin-bottom: 0; }
  .cf-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    background: var(--tp-navy);
    color: var(--tp-cream);
  }
  .cf-section-title { display: flex; align-items: baseline; gap: 12px; }
  .cf-section-num {
    font-family: var(--tp-display);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.24em;
    color: var(--tp-gold);
  }
  .cf-section-head h2 {
    color: var(--tp-cream);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin: 0;
  }
  .cf-section-head .tp-pill {
    background: var(--tp-cream);
    border-color: var(--tp-cream);
    color: var(--tp-navy);
  }

  .cf-table-wrap { overflow-x: auto; }
  .cf-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .cf-table th, .cf-table td {
    padding: 8px 14px;
    border-bottom: 1px solid var(--tp-rule-soft);
    text-align: left;
    vertical-align: middle;
  }
  .cf-table tr:last-child td { border-bottom: none; }
  .cf-table th {
    background: rgba(15, 42, 71, 0.05);
    font-family: var(--tp-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .cf-table input[type="text"],
  .cf-table select {
    width: 100%;
    padding: 7px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--tp-ink);
    font-family: var(--tp-body);
    font-size: 14px;
    box-sizing: border-box;
  }
  .cf-table input:hover, .cf-table select:hover { background: var(--tp-cream-2); }
  .cf-table input:focus, .cf-table select:focus {
    outline: none;
    background: var(--tp-cream);
    border-color: var(--tp-gold-2);
    box-shadow: 0 0 0 2px rgba(200, 162, 74, 0.25);
  }
  .cf-thumb-link {
    display: inline-block;
    padding: 4px;
    background: var(--tp-cream);
    border: 1px solid var(--tp-navy);
    border-radius: 2px;
  }
  .cf-thumb {
    display: block;
    height: 36px;
    width: auto;
  }
  .cf-muted { color: var(--tp-muted); font-style: italic; }
  .cf-del {
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
  .cf-del:hover {
    background: rgba(122, 31, 43, 0.1);
    border-color: var(--tp-oxblood);
  }
  .cf-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-top: 28px;
  }
</style>
