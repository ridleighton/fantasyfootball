<script>
  import { invalidateAll } from '$app/navigation';
  import { dndzone } from 'svelte-dnd-action';
  import { extractColors } from '$lib/client/theprogram/extract-colors.js';

  let { data } = $props();

  const TABS = [
    { key: 'conferences', label: 'Conferences' },
    { key: 'schools', label: 'Schools' },
    { key: 'photos', label: 'Photo Table' },
    { key: 'rankings', label: 'Player Rankings' },
    { key: 'schoolrank', label: 'School Rankings' }
  ];
  let activeTab = $state('conferences');

  let conferences = $state(structuredClone(data.conferences));
  let schools = $state(structuredClone(data.schools));
  let photos = $state(structuredClone(
    data.photos.map(p => ({ ...p, _detecting: false, _detectError: '' }))
  ));

  let tempId = -1;

  // ---- Per-section save (each section saves independently) ----
  let savingConf = $state(false), confMsg = $state('');
  let savingSchools = $state(false), schoolMsg = $state('');
  let savingPhotos = $state(false), photoMsg = $state('');

  async function saveSection(url, payload) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.message ?? `HTTP ${r.status}`);
    return body;
  }

  async function saveConferences() {
    savingConf = true; confMsg = '';
    try {
      await saveSection('/theprogram/config/conferences', { conferences });
      await invalidateAll();
      conferences = structuredClone(data.conferences);
      confMsg = 'Saved.';
    } catch (e) { confMsg = `Save failed: ${e.message}`; }
    finally { savingConf = false; }
  }

  async function saveSchools() {
    savingSchools = true; schoolMsg = '';
    try {
      await saveSection('/theprogram/config/schools', { schools });
      await invalidateAll();
      schools = structuredClone(data.schools);
      schoolMsg = 'Saved.';
    } catch (e) { schoolMsg = `Save failed: ${e.message}`; }
    finally { savingSchools = false; }
  }

  async function savePhotos() {
    savingPhotos = true; photoMsg = '';
    try {
      await saveSection('/theprogram/config/photos', {
        photos: photos.map(({ _detecting, _detectError, ...rest }) => rest)
      });
      await invalidateAll();
      photos = structuredClone(data.photos.map(p => ({ ...p, _detecting: false, _detectError: '' })));
      photoMsg = 'Saved.';
    } catch (e) { photoMsg = `Save failed: ${e.message}`; }
    finally { savingPhotos = false; }
  }

  // ---- Player Rankings ----
  let playerRankings = $state(structuredClone(data.playerRankings ?? []));
  let prCsv = $state('');
  let prUploading = $state(false);
  let prMessage = $state('');

  async function uploadPlayerRankings() {
    if (!prCsv.trim()) { prMessage = 'Paste a CSV first.'; return; }
    prUploading = true; prMessage = '';
    try {
      const r = await fetch('/theprogram/config/player-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: prCsv })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message ?? `HTTP ${r.status}`);
      prMessage = `Saved ${body.inserted} row${body.inserted === 1 ? '' : 's'}.`;
      prCsv = '';
      await invalidateAll();
      playerRankings = structuredClone(data.playerRankings ?? []);
    } catch (e) {
      prMessage = `Upload failed: ${e.message}`;
    } finally {
      prUploading = false;
    }
  }

  async function updatePlayerRanking(r) {
    const tier = Number.parseInt(r.tier, 10);
    const rank = Number.parseInt(r.rank, 10);
    if (!Number.isInteger(tier) || !Number.isInteger(rank)) return;
    await fetch('/theprogram/config/player-rankings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, tier, rank })
    });
  }

  async function deletePlayerRanking(id) {
    if (!confirm('Delete this player ranking?')) return;
    await fetch('/theprogram/config/player-rankings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await invalidateAll();
    playerRankings = structuredClone(data.playerRankings ?? []);
  }

  // ---- School Priority (drag list) ----
  // Initial order: program_school_priority (existing ranks) followed by
  // every other known school name (program_schools UNION program_photos
  // UNION program_roll_events.school + committed_school). Position in
  // the list = priority value on save.
  function buildSpInitial() {
    const known = new Map((data.schoolPriority ?? []).map(r => [r.school_name.toLowerCase(), r.school_name]));
    const ordered = (data.schoolPriority ?? []).map(r => r.school_name);
    for (const name of data.schoolsForPriority ?? []) {
      if (!known.has((name ?? '').toLowerCase())) ordered.push(name);
    }
    return ordered.map((name, i) => ({ id: `s-${i}-${name}`, name, position: i + 1 }));
  }
  let spItems = $state(buildSpInitial());
  let spMessage = $state('');
  let spSaveTimer = null;

  // Keep the drag list in sync with the school list. Sources, in order of
  // trust: saved priority order, the union of known schools, and the live
  // Schools-tab editor (so a school added there shows up immediately).
  // New schools are appended; removed ones drop; existing order is kept.
  $effect(() => {
    const namesByLower = new Map();
    for (const r of (data.schoolPriority ?? [])) namesByLower.set(r.school_name.toLowerCase(), r.school_name);
    for (const n of (data.schoolsForPriority ?? [])) {
      const t = (n ?? '').trim();
      if (t) namesByLower.set(t.toLowerCase(), t);
    }
    for (const s of schools) {
      const t = (s.name ?? '').trim();
      if (t) namesByLower.set(t.toLowerCase(), t);
    }

    const wanted = new Set(namesByLower.keys());
    const present = new Set(spItems.map(i => i.name.toLowerCase()));
    const kept = spItems.filter(i => wanted.has(i.name.toLowerCase()));
    const additions = [];
    for (const [lower, name] of namesByLower) {
      if (!present.has(lower)) additions.push(name);
    }
    if (kept.length !== spItems.length || additions.length > 0) {
      const merged = [...kept.map(i => i.name), ...additions];
      spItems = merged.map((name, i) => ({ id: `s-${i}-${name}`, name, position: i + 1 }));
    }
  });

  function handleSpConsider(e) {
    spItems = e.detail.items.map((it, i) => ({ ...it, position: i + 1 }));
  }
  function handleSpFinalize(e) {
    spItems = e.detail.items.map((it, i) => ({ ...it, position: i + 1 }));
    // Debounce-save 300ms after the drop settles.
    if (spSaveTimer) clearTimeout(spSaveTimer);
    spSaveTimer = setTimeout(saveSchoolPriority, 300);
  }
  async function saveSchoolPriority() {
    spMessage = 'Saving…';
    try {
      const r = await fetch('/theprogram/config/school-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_schools: spItems.map(i => i.name) })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message ?? `HTTP ${r.status}`);
      spMessage = `Saved ${body.count} school${body.count === 1 ? '' : 's'}.`;
    } catch (e) {
      spMessage = `Save failed: ${e.message}`;
    }
  }

  // Mirror the server-side Imgur resolver for the preview thumbnail.
  function previewUrl(url) {
    if (!url) return null;
    const s = String(url).trim();
    if (!s) return null;
    if (/^https?:\/\/i\.imgur\.com\/[\w-]+\.(png|jpe?g|gif|webp)/i.test(s)) return s;
    const m = s.match(/^https?:\/\/(?:www\.)?imgur\.com\/(?:a\/|gallery\/)?([\w-]+)/i);
    if (m) return `https://i.imgur.com/${m[1]}.png`;
    return s;
  }

  function addConference() { conferences.push({ id: tempId--, name: '' }); }
  function addSchool() { schools.push({ id: tempId--, name: '', conference: '' }); }
  function addPhoto() {
    photos.push({
      id: tempId--,
      type: 'School Helmet',
      school: '',
      image_url: '',
      primary_color: null,
      secondary_color: null,
      _detecting: false,
      _detectError: ''
    });
  }

  async function detectColors(i) {
    const row = photos[i];
    const url = previewUrl(row.image_url);
    if (!url) {
      row._detectError = 'Add an Imgur URL first.';
      return;
    }
    row._detecting = true;
    row._detectError = '';
    try {
      const { primary, secondary } = await extractColors(url);
      row.primary_color = primary;
      row.secondary_color = secondary;
    } catch (e) {
      row._detectError = e.message;
    } finally {
      row._detecting = false;
    }
  }

  // Auto-detect when a URL is added and no colors yet
  async function onUrlBlur(i) {
    const row = photos[i];
    if (row.image_url && !row.primary_color && !row.secondary_color) {
      await detectColors(i);
    }
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
    <p class="cf-sub">Conferences, schools, and photo assets — kept in good order.</p>
  </header>

  <div class="cv-rule" aria-hidden="true"></div>

  <nav class="cf-tabs" role="tablist" aria-label="Config sections">
    {#each TABS as tab}
      <button
        type="button"
        role="tab"
        class="cf-tab"
        class:active={activeTab === tab.key}
        aria-selected={activeTab === tab.key}
        onclick={() => activeTab = tab.key}
      >{tab.label}</button>
    {/each}
  </nav>

  {#if activeTab === 'conferences'}
    <!-- Conferences -->
    <section class="cf-section tp-card">
      <div class="cf-section-head">
        <div class="cf-section-title">
          <span class="cf-section-num">§ I</span>
          <h2>Conferences</h2>
        </div>
        <div class="cf-section-actions">
          <button type="button" class="tp-pill tp-pill-small" onclick={addConference}>+ Add</button>
          <button type="button" class="tp-pill tp-pill-small tp-pill-navy" onclick={saveConferences} disabled={savingConf}>
            {savingConf ? 'Saving…' : 'Save'}
          </button>
          {#if confMsg}<span class="cf-msg">{confMsg}</span>{/if}
        </div>
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead><tr><th>Name</th><th aria-label="actions"></th></tr></thead>
          <tbody>
            {#each conferences as c, i (c.id)}
              <tr>
                <td><input type="text" bind:value={c.name} placeholder="e.g. C1" aria-label="Conference name" /></td>
                <td><button type="button" class="cf-del" aria-label="Remove conference {c.name || `row ${i + 1}`}" onclick={() => conferences.splice(i, 1)}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

  {/if}

  {#if activeTab === 'schools'}
    <!-- Schools -->
    <section class="cf-section tp-card">
      <div class="cf-section-head">
        <div class="cf-section-title">
          <span class="cf-section-num">§ II</span>
          <h2>Schools</h2>
        </div>
        <div class="cf-section-actions">
          <button type="button" class="tp-pill tp-pill-small" onclick={addSchool}>+ Add</button>
          <button type="button" class="tp-pill tp-pill-small tp-pill-navy" onclick={saveSchools} disabled={savingSchools}>
            {savingSchools ? 'Saving…' : 'Save'}
          </button>
          {#if schoolMsg}<span class="cf-msg">{schoolMsg}</span>{/if}
        </div>
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead><tr><th>Name</th><th>Conference</th><th aria-label="actions"></th></tr></thead>
          <tbody>
            {#each schools as s, i (s.id)}
              <tr>
                <td><input type="text" bind:value={s.name} placeholder="School name" aria-label="School name" /></td>
                <td>
                  <select bind:value={s.conference} aria-label="Conference for {s.name || `row ${i + 1}`}">
                    <option value=""></option>
                    {#each conferences as c}
                      {#if c.name}<option value={c.name}>{c.name}</option>{/if}
                    {/each}
                  </select>
                </td>
                <td><button type="button" class="cf-del" aria-label="Remove school {s.name || `row ${i + 1}`}" onclick={() => schools.splice(i, 1)}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

  {/if}

  {#if activeTab === 'photos'}
    <!-- Photos -->
    <section class="cf-section tp-card">
      <div class="cf-section-head">
        <div class="cf-section-title">
          <span class="cf-section-num">§ III</span>
          <h2>Photo Table</h2>
        </div>
        <div class="cf-section-actions">
          <button type="button" class="tp-pill tp-pill-small" onclick={addPhoto}>+ Add</button>
          <button type="button" class="tp-pill tp-pill-small tp-pill-navy" onclick={savePhotos} disabled={savingPhotos}>
            {savingPhotos ? 'Saving…' : 'Save'}
          </button>
          {#if photoMsg}<span class="cf-msg">{photoMsg}</span>{/if}
        </div>
      </div>
      <div class="cf-table-wrap">
        <table class="cf-table cf-photos">
          <thead>
            <tr>
              <th>Type</th>
              <th>School</th>
              <th>Imgur URL</th>
              <th>Preview</th>
              <th>Primary</th>
              <th>Secondary</th>
              <th aria-label="actions"></th>
            </tr>
          </thead>
          <tbody>
            {#each photos as p, i (p.id)}
              {@const rowLabel = [p.type, p.school].filter(Boolean).join(' · ') || `row ${i + 1}`}
              <tr>
                <td>
                  <select bind:value={p.type} aria-label="Photo type for {rowLabel}">
                    {#each data.photoTypes as t}
                      <option value={t}>{t}</option>
                    {/each}
                  </select>
                </td>
                <td><input type="text" bind:value={p.school} placeholder="(optional)" aria-label="School for {rowLabel}" /></td>
                <td class="cf-url-cell">
                  <input
                    type="text"
                    bind:value={p.image_url}
                    placeholder="https://imgur.com/Poarb0q"
                    onblur={() => onUrlBlur(i)}
                    aria-label="Image URL for {rowLabel}"
                  />
                  <button
                    type="button"
                    class="cf-detect"
                    onclick={() => detectColors(i)}
                    disabled={p._detecting || !p.image_url}
                    title="Re-detect colors from the image"
                    aria-label="Detect colors for {rowLabel}"
                  >
                    {p._detecting ? '…' : 'Detect'}
                  </button>
                  {#if p._detectError}
                    <div class="cf-detect-err">{p._detectError}</div>
                  {/if}
                </td>
                <td>
                  {#if p.image_url}
                    <a href={previewUrl(p.image_url)} target="_blank" rel="noopener" class="cf-thumb-link" aria-label="Preview image for {rowLabel}">
                      <img src={previewUrl(p.image_url)} alt="" class="cf-thumb" referrerpolicy="no-referrer" />
                    </a>
                  {:else}
                    <span class="cf-muted">—</span>
                  {/if}
                </td>
                <td>
                  <div class="cf-color">
                    <span class="cf-swatch" style="background:{p.primary_color ?? 'transparent'}" aria-hidden="true"></span>
                    <input
                      type="text"
                      bind:value={p.primary_color}
                      placeholder="#ffffff"
                      class="cf-hex"
                      aria-label="Primary color hex for {rowLabel}"
                    />
                  </div>
                </td>
                <td>
                  <div class="cf-color">
                    <span class="cf-swatch" style="background:{p.secondary_color ?? 'transparent'}" aria-hidden="true"></span>
                    <input
                      type="text"
                      bind:value={p.secondary_color}
                      placeholder="#000000"
                      class="cf-hex"
                      aria-label="Secondary color hex for {rowLabel}"
                    />
                  </div>
                </td>
                <td><button type="button" class="cf-del" aria-label="Remove photo {rowLabel}" onclick={() => photos.splice(i, 1)}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

  {/if}

  {#if activeTab === 'rankings'}
  <!-- Player Rankings — master tier/rank list (not week-scoped) -->
  <section class="pr-section">
    <header class="pr-head">
      <h2>Player Rankings</h2>
      <p>Master list of players with tier and rank. Lower numbers = better. Carries forward week to week.</p>
    </header>
    <div class="pr-upload">
      <label class="tp-label" for="pr-csv">Paste CSV / TSV</label>
      <textarea id="pr-csv" rows="5" class="tp-field" bind:value={prCsv}
        placeholder="Player,Tier,Rank&#10;John Doe,1,1&#10;Jane Roe,1,2"></textarea>
      <div class="pr-upload-row">
        <button type="button" class="tp-pill tp-pill-gold" onclick={uploadPlayerRankings} disabled={prUploading}>
          {prUploading ? 'Uploading…' : 'Upload'}
        </button>
        {#if prMessage}<span class="pr-msg">{prMessage}</span>{/if}
      </div>
    </div>
    {#if playerRankings.length === 0}
      <p class="pr-empty">No rankings on file.</p>
    {:else}
      <table class="pr-table">
        <thead>
          <tr><th>Tier</th><th>Rank</th><th>Player</th><th></th></tr>
        </thead>
        <tbody>
          {#each playerRankings as r (r.id)}
            <tr>
              <td><input type="number" min="1" bind:value={r.tier} onchange={() => updatePlayerRanking(r)} aria-label="Tier" /></td>
              <td><input type="number" min="1" bind:value={r.rank} onchange={() => updatePlayerRanking(r)} aria-label="Rank" /></td>
              <td>{r.player_name}</td>
              <td><button type="button" class="pr-del" onclick={() => deletePlayerRanking(r.id)} aria-label="Delete">×</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  {/if}

  {#if activeTab === 'schoolrank'}
  <!-- School Priority — drag list. Position = priority. -->
  <section class="sp-section">
    <header class="sp-head">
      <h2>School Rankings</h2>
      <p>Drag schools into the order that decides ties when coach lists conflict. Top of the list = priority 1.</p>
    </header>
    <ul
      class="sp-list"
      use:dndzone={{ items: spItems, flipDurationMs: 150 }}
      onconsider={handleSpConsider}
      onfinalize={handleSpFinalize}
    >
      {#each spItems as item (item.id)}
        <li class="sp-item">
          <span class="sp-pri">{item.position}</span>
          <span class="sp-name">{item.name}</span>
          <span class="sp-grip" aria-hidden="true">⋮⋮</span>
        </li>
      {/each}
    </ul>
    {#if spMessage}<span class="sp-msg">{spMessage}</span>{/if}
  </section>
  {/if}
</div>

<style>
  .cf { max-width: 1200px; margin: 0 auto; padding: 36px 28px 60px; }
  .cf-head { text-align: left; }
  .cf-eyebrow {
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .cf-title {
    font-family: var(--tp-display);
    font-size: 38px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1;
    margin: 4px 0 6px;
  }
  .cf-sub { margin: 0; color: var(--tp-muted); font-style: italic; }
  .cv-rule {
    height: 2px;
    background: var(--tp-gold);
    margin: 14px 0 24px;
  }

  .cf-tabs {
    display: flex; flex-wrap: wrap; gap: 2px;
    border-bottom: 1px solid var(--tp-pewter);
    margin-bottom: 24px;
  }
  .cf-tab {
    padding: 10px 16px;
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
  .cf-tab:hover { color: var(--tp-navy-dark); }
  .cf-tab.active { color: var(--tp-navy); border-bottom-color: var(--tp-gold); }

  .cf-msg {
    font-size: 12px;
    font-style: italic;
    color: var(--tp-cream);
    opacity: 0.9;
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
  .cf-section-actions { display: flex; align-items: center; gap: 8px; }
  .cf-section-num {
    font-family: var(--tp-display-condensed);
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
    background: rgba(184, 37, 44, 0.05);
    font-family: var(--tp-display-condensed);
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
    box-shadow: 0 0 0 2px rgba(217, 164, 65, 0.25);
  }
  .cf-thumb-link {
    display: inline-block;
    padding: 4px;
    background: var(--tp-cream);
    border: 1px solid var(--tp-navy);
    border-radius: 2px;
  }
  .cf-thumb { display: block; height: 36px; width: auto; }
  .cf-muted { color: var(--tp-muted); font-style: italic; }

  /* URL cell: input + detect button */
  .cf-url-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .cf-url-cell input { min-width: 200px; flex: 1; }
  .cf-detect {
    padding: 6px 10px;
    background: var(--tp-navy);
    color: var(--tp-cream);
    border: 1px solid var(--tp-navy-dark);
    border-radius: 3px;
    font-family: var(--tp-display-condensed);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
    white-space: nowrap;
  }
  .cf-detect:hover:not(:disabled) { background: var(--tp-navy-2); }
  .cf-detect:disabled { opacity: 0.5; cursor: not-allowed; }
  .cf-detect-err {
    width: 100%;
    color: var(--tp-oxblood);
    font-size: 12px;
    font-style: italic;
    margin-top: 4px;
  }

  /* Color cells: swatch + hex input */
  .cf-color {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .cf-swatch {
    display: inline-block;
    width: 22px;
    height: 22px;
    border-radius: 3px;
    border: 1px solid var(--tp-rule);
    background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px;
  }
  .cf-hex {
    width: 80px;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace !important;
    font-size: 12px !important;
  }

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
  /* ---- Player Rankings + School Priority ---- */
  .pr-section, .sp-section { margin-top: 8px; }
  .pr-head h2, .sp-head h2 {
    font-family: var(--tp-display-condensed);
    font-size: 22px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tp-navy-dark);
    margin: 0 0 6px;
  }
  .pr-head p, .sp-head p { margin: 0 0 18px; color: var(--tp-navy-dark); }
  .pr-upload { margin-bottom: 22px; }
  .pr-upload-row { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
  .pr-msg, .sp-msg { font-size: 13px; color: var(--tp-navy-dark); font-style: italic; }
  .pr-empty { color: var(--tp-navy-dark); font-style: italic; }
  .pr-table { width: 100%; border-collapse: collapse; font-family: var(--tp-body); color: var(--tp-navy-dark); }
  .pr-table th, .pr-table td { padding: 6px 8px; text-align: left; }
  .pr-table th { font-family: var(--tp-display-condensed); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; }
  .pr-table tbody tr:nth-child(odd) { background: var(--tp-cream); }
  .pr-table tbody tr:nth-child(even) { background: var(--tp-cream-2); }
  .pr-table input[type=number] {
    width: 70px;
    background: var(--tp-cream-2);
    border: 1px solid var(--tp-pewter);
    border-radius: 3px;
    padding: 4px 6px;
    color: var(--tp-navy-dark);
  }
  .pr-table input[type=number]:focus {
    outline: none;
    border-color: var(--tp-navy);
    box-shadow: 0 4px 0 -2px var(--tp-gold);
  }
  .pr-del { background: none; border: none; cursor: pointer; color: var(--tp-navy-dark); font-size: 16px; padding: 2px 6px; }
  .pr-del:hover { color: var(--tp-navy); }

  .sp-list { list-style: none; margin: 0; padding: 0; max-width: 480px; }
  .sp-item {
    display: grid;
    grid-template-columns: 40px 1fr 24px;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--tp-cream);
    border: 1px solid var(--tp-pewter);
    border-radius: 3px;
    margin-bottom: 6px;
    font-family: var(--tp-body);
    color: var(--tp-navy-dark);
    cursor: grab;
  }
  .sp-item:active { cursor: grabbing; }
  .sp-pri {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 14px;
    color: var(--tp-navy);
    letter-spacing: 0.06em;
  }
  .sp-name { font-size: 14px; }
  .sp-grip { color: var(--tp-pewter-deep); font-weight: 700; user-select: none; }
</style>
