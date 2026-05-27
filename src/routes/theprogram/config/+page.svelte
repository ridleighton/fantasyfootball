<script>
  import { enhance } from '$app/forms';
  import { extractColors } from '$lib/client/theprogram/extract-colors.js';

  let { data, form } = $props();

  let conferences = $state(structuredClone(data.conferences));
  let schools = $state(structuredClone(data.schools));
  let photos = $state(structuredClone(
    data.photos.map(p => ({ ...p, _detecting: false, _detectError: '' }))
  ));

  let saving = $state(false);
  let lastSavedAt = $state(null);
  let tempId = -1;

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

  const payload = $derived(JSON.stringify({
    conferences,
    schools,
    photos: photos.map(({ _detecting, _detectError, ...rest }) => rest)
  }));

  function trackSave() {
    saving = true;
    return async ({ result, update }) => {
      await update({ reset: false });
      saving = false;
      if (result.type === 'success') lastSavedAt = new Date().toLocaleTimeString();
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
                <td><input type="text" bind:value={c.name} placeholder="e.g. C1" aria-label="Conference name" /></td>
                <td><button type="button" class="cf-del" aria-label="Remove conference {c.name || `row ${i + 1}`}" onclick={() => conferences.splice(i, 1)}>×</button></td>
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

    <div class="cf-toolbar">
      <button type="submit" class="tp-pill tp-pill-navy" disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  </form>
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
  .cf-saved {
    margin-left: 10px;
    font-family: var(--tp-display-condensed);
    font-style: normal;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--tp-gold-2);
  }
  .cv-rule {
    height: 2px;
    background: var(--tp-gold);
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
  .cf-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-top: 28px;
  }
</style>
