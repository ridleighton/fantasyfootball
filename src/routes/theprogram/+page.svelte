<script>
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let submitting = $state(false);
  let weekNumber = $state('');

  function trackSubmit() {
    submitting = true;
    return async ({ update }) => {
      await update();
      submitting = false;
    };
  }
</script>

<div class="entry">
  <div class="entry-stripes" aria-hidden="true"></div>

  <div class="entry-card">
    <div class="seal" aria-hidden="true">
      <div class="seal-ring"></div>
      <div class="seal-star">★</div>
    </div>

    <div class="entry-eyebrow">Down Bad for Ghost — Recruiting Show</div>
    <h1 class="entry-title">The Program</h1>
    <div class="entry-week-stamp">
      <span class="tp-stamp tp-stamp-gold">Week {weekNumber || '—'}</span>
    </div>

    {#if form?.message}
      <div class="tp-alert tp-alert-error">{form.message}</div>
    {/if}

    <div class="entry-grid">
      <!-- Start New Week -->
      <section class="entry-panel">
        <div class="panel-head">
          <span class="panel-num">I</span>
          <h2>Start a New Week</h2>
        </div>

        <form method="POST" action="?/startWeek" enctype="multipart/form-data" use:enhance={trackSubmit}>
          <div class="field-row">
            <label class="tp-label" for="week_number">Week number</label>
            <input
              id="week_number"
              type="number"
              name="week_number"
              min="1"
              max="15"
              step="1"
              required
              bind:value={weekNumber}
              class="tp-field"
              placeholder="1–15"
            />
          </div>

          <div class="field-row">
            <label class="tp-label" for="csv_file">Upload CSV</label>
            <input id="csv_file" type="file" name="csv_file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
              class="tp-field" />
          </div>

          <div class="field-row">
            <label class="tp-label" for="pasted_data">or paste data</label>
            <textarea
              id="pasted_data"
              name="pasted_data"
              rows="6"
              class="tp-field paste-area"
              placeholder="Conference,Type,Player,School,Locked,In_Original_Roll,Odds,Committed School"
            ></textarea>
          </div>

          <button type="submit" class="tp-pill tp-pill-gold" disabled={submitting}>
            {submitting ? 'Creating…' : 'Start Week'}
          </button>
        </form>
      </section>

      <!-- Load Existing -->
      <section class="entry-panel">
        <div class="panel-head">
          <span class="panel-num">II</span>
          <h2>Load Existing</h2>
        </div>

        {#if data.weeks.length === 0}
          <p class="panel-empty">No weeks on file. Start a new week to begin.</p>
        {:else}
          <form method="POST" action="?/loadWeek" use:enhance={trackSubmit}>
            <div class="field-row">
              <label class="tp-label" for="week_id">Choose a week</label>
              <select id="week_id" name="week_id" class="tp-field" required>
                <option value="">Select…</option>
                {#each data.weeks as w}
                  <option value={w.id}>Week {w.week_number}</option>
                {/each}
              </select>
            </div>
            <button type="submit" class="tp-pill tp-pill-navy" disabled={submitting}>
              {submitting ? 'Loading…' : 'Load Week'}
            </button>
          </form>
        {/if}
      </section>
    </div>

    <div class="tp-divider">
      <span class="tp-divider-ornament">★ ✦ ★</span>
    </div>
    <div class="entry-foot">Established for Saturday mornings.</div>
  </div>
</div>

<style>
  .entry {
    min-height: 100vh;
    background:
      radial-gradient(ellipse at top, var(--tp-navy-2) 0%, var(--tp-navy) 55%, var(--tp-navy-dark) 100%);
    display: grid;
    place-items: center;
    padding: 48px 24px;
    position: relative;
    overflow: hidden;
  }
  /* Subtle varsity stripes at the edges */
  .entry-stripes {
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(
        45deg,
        transparent 0,
        transparent 14px,
        rgba(200, 162, 74, 0.04) 14px,
        rgba(200, 162, 74, 0.04) 16px
      );
    pointer-events: none;
  }
  .entry-card {
    position: relative;
    width: 100%;
    max-width: 720px;
    background: var(--tp-cream);
    border-radius: 4px;
    padding: 56px 56px 40px;
    box-shadow:
      0 0 0 1px var(--tp-rule),
      0 0 0 8px var(--tp-navy),
      0 0 0 9px var(--tp-gold),
      0 30px 60px rgba(0, 0, 0, 0.4);
    text-align: center;
  }
  .seal {
    position: relative;
    width: 64px;
    height: 64px;
    margin: 0 auto 18px;
  }
  .seal-ring {
    position: absolute;
    inset: 0;
    border: 2px solid var(--tp-navy);
    border-radius: 50%;
  }
  .seal-ring::before {
    content: '';
    position: absolute;
    inset: 5px;
    border: 1px solid var(--tp-gold);
    border-radius: 50%;
  }
  .seal-star {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--tp-gold);
    font-size: 22px;
  }
  .entry-eyebrow {
    font-family: var(--tp-display);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--tp-muted);
    margin-bottom: 10px;
  }
  .entry-title {
    font-size: 64px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin: 0 0 14px;
    line-height: 1;
  }
  .entry-week-stamp { margin-bottom: 32px; }

  .entry-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    text-align: left;
    margin-top: 20px;
  }
  @media (max-width: 700px) {
    .entry-grid { grid-template-columns: 1fr; }
    .entry-card { padding: 36px 24px 28px; }
    .entry-title { font-size: 44px; }
  }

  .entry-panel {
    padding-top: 6px;
  }
  .panel-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 18px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--tp-rule);
  }
  .panel-num {
    font-family: var(--tp-display);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.2em;
    color: var(--tp-gold-2);
  }
  .panel-head h2 {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0;
  }
  .panel-empty {
    color: var(--tp-muted);
    font-style: italic;
    margin: 0;
  }
  .field-row { margin-bottom: 14px; }
  .paste-area {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 12px;
  }

  .entry-foot {
    margin-top: 16px;
    font-family: var(--tp-body);
    font-style: italic;
    color: var(--tp-muted);
    font-size: 13px;
  }
</style>
