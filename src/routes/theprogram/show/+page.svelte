<script>
  import { page } from '$app/stores';
  import { goto, invalidateAll } from '$app/navigation';

  let { data } = $props();

  // ---------- Conference Order screen ----------
  let orderAssignments = $state(
    Object.fromEntries((data.conferences ?? []).map(c => [c, '']))
  );
  let savingOrder = $state(false);
  let orderError = $state('');

  async function saveOrder() {
    orderError = '';
    const entries = Object.entries(orderAssignments);
    const positions = entries.map(([_, p]) => Number.parseInt(p, 10));
    if (positions.some(p => !Number.isInteger(p) || p < 1 || p > 5)) {
      orderError = 'Assign each conference a position 1–5.';
      return;
    }
    if (new Set(positions).size !== positions.length) {
      orderError = 'Each position must be unique.';
      return;
    }
    const order = entries
      .slice()
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map(([c]) => c);

    savingOrder = true;
    try {
      const res = await fetch('/theprogram/show/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Could not save order');
      }
      await invalidateAll();
      await goto('/theprogram/show?event=0', { invalidateAll: true });
    } catch (e) {
      orderError = e.message;
    } finally {
      savingOrder = false;
    }
  }

  // ---------- Event display + rolling ----------
  const currentIndex = $derived(
    Math.max(0, Number.parseInt($page.url.searchParams.get('event') ?? '0', 10) || 0)
  );
  const events = $derived(data.events ?? []);
  const currentEvent = $derived(events[currentIndex] ?? null);
  const isLastEvent = $derived(currentIndex >= events.length - 1);
  const isFinished = $derived(events.length > 0 && currentIndex >= events.length);

  let rollState = $state('idle');
  let rollWinner = $state(null);
  let rollOutcome = $state(null);
  let rollCameLate = $state(false);
  let rollError = $state('');

  $effect(() => {
    void currentIndex;
    rollState = 'idle';
    rollWinner = null;
    rollOutcome = null;
    rollCameLate = false;
    rollError = '';
  });

  async function performRoll() {
    if (!currentEvent || rollState !== 'idle') return;
    rollError = '';

    const skipSpinner =
      (currentEvent.kind === 'steal' && currentEvent.display.locked) ||
      (currentEvent.kind === 'auto' && currentEvent.display.solo);

    if (!skipSpinner) rollState = 'spinning';
    const startedAt = Date.now();

    let serverResult;
    try {
      const res = await fetch('/theprogram/show/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIndex: currentIndex })
      });
      if (!res.ok) throw new Error(await res.text());
      serverResult = await res.json();
    } catch (e) {
      rollError = e.message;
      rollState = 'idle';
      return;
    }

    const wantedSpin = skipSpinner ? 0 : (3000 + Math.random() * 2000);
    const remaining = Math.max(0, wantedSpin - (Date.now() - startedAt));
    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));

    rollWinner = serverResult.winner;
    rollOutcome = serverResult.outcome;
    rollCameLate = !!serverResult.cameLate;
    rollState = 'revealed';
  }

  function nextEvent() {
    const next = currentIndex < events.length - 1 ? currentIndex + 1 : events.length;
    goto(`/theprogram/show?event=${next}`, { invalidateAll: true });
  }

  const previouslyRolled = $derived(currentEvent?.savedResult ?? null);
</script>

<svelte:head><title>The Show · Week {data.weekNumber}</title></svelte:head>

{#if !data.hasOrder}
  <!-- ============================ Conference Order ============================ -->
  <div class="stage">
    <div class="stage-card">
      <div class="seal" aria-hidden="true">
        <div class="seal-ring"></div>
        <div class="seal-star">★</div>
      </div>
      <div class="stage-eyebrow">Pre-Show — Set the Order</div>
      <h1 class="stage-title">Conference Order</h1>
      <div class="stage-stamp"><span class="tp-stamp tp-stamp-gold">Week {data.weekNumber}</span></div>
      <p class="stage-sub">Assign each conference a position from 1 to 5.</p>

      {#if orderError}
        <div class="tp-alert tp-alert-error">{orderError}</div>
      {/if}

      <div class="order-grid">
        {#each data.conferences as conf}
          <div class="order-row">
            <div class="order-label">{conf}</div>
            <select bind:value={orderAssignments[conf]} class="tp-field order-select">
              <option value="">—</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
        {/each}
      </div>

      <div class="tp-divider"><span class="tp-divider-ornament">★ ✦ ★</span></div>

      <button class="tp-pill tp-pill-gold tp-pill-big" onclick={saveOrder} disabled={savingOrder}>
        {savingOrder ? 'Saving…' : 'Start the Show →'}
      </button>
    </div>
  </div>
{:else if events.length === 0}
  <div class="stage">
    <div class="stage-card">
      <h1 class="stage-title">No Events to Show</h1>
      <p class="stage-sub">Week {data.weekNumber} has no roll events on file.</p>
      <a href="/theprogram/commish" class="tp-pill tp-pill-navy">Back to Commish</a>
    </div>
  </div>
{:else if isFinished}
  <!-- ============================ Finish ============================ -->
  <div class="stage">
    <div class="stage-card">
      <div class="seal" aria-hidden="true">
        <div class="seal-ring"></div>
        <div class="seal-star">✦</div>
      </div>
      <div class="stage-eyebrow">Curtain</div>
      <h1 class="stage-title">Show Complete</h1>
      <div class="stage-stamp"><span class="tp-stamp tp-stamp-gold">Week {data.weekNumber}</span></div>
      <p class="stage-sub">{events.length} event{events.length === 1 ? '' : 's'} rolled.</p>
      <div class="tp-divider"><span class="tp-divider-ornament">★ ✦ ★</span></div>
      <div class="finish-actions">
        <a href="/theprogram/show/export" class="tp-pill tp-pill-gold tp-pill-big">Download Results CSV</a>
        <a href="/theprogram/commish" class="tp-pill tp-pill-small">Back to Commish</a>
      </div>
    </div>
  </div>
{:else if currentEvent}
  <!-- ============================ Event ============================ -->
  <div class="theater">
    <div class="theater-stripes" aria-hidden="true"></div>

    <header class="event-head">
      <div class="event-chips">
        <span class="tp-stamp">{currentEvent.conference}</span>
        <span class="tp-stamp tp-stamp-gold">{currentEvent.type}</span>
        <span class="event-prog">{currentIndex + 1} <span class="of">of</span> {events.length}</span>
      </div>
      <h1 class="event-player">{currentEvent.player}</h1>
    </header>

    {#if rollError}
      <div class="tp-alert tp-alert-error event-alert">{rollError}</div>
    {/if}

    <!-- Schools display -->
    {#if rollState !== 'spinning' && rollState !== 'revealed'}
      <div class="schools">
        {#each currentEvent.display.schools as s}
          <div class="school-card" class:ineligible={s.eligible === false}>
            <div class="helmet-frame">
              {#if s.helmet}
                <img src={s.helmet} alt={s.school} class="helmet" />
              {:else}
                <div class="helmet helmet-placeholder">{s.school[0] ?? '?'}</div>
              {/if}
              {#if s.eligible === false}
                <div class="x-badge" aria-label="ineligible">×</div>
              {/if}
            </div>
            <div class="school-name">{s.school}</div>
            <div class="school-pct">
              {#if s.eligible === false}
                <span class="pct-bad">{(s.raw ?? 0).toFixed(1)}% · below cut</span>
              {:else}
                <span class="pct-big">{(s.normalized ?? 0).toFixed(1)}<small>%</small></span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Spinner -->
    {#if rollState === 'spinning'}
      <div class="spinner-stage">
        {#if data.placeholderHelmet}
          <img src={data.placeholderHelmet} alt="Rolling…" class="spinner-img" />
        {:else}
          <div class="spinner-img spinner-fallback">?</div>
        {/if}
        <div class="spinner-label">Rolling…</div>
      </div>
    {/if}

    <!-- Reveal -->
    {#if rollState === 'revealed'}
      {#if rollOutcome === 'steal_failed_locked'}
        <div class="reveal-stage locked">
          {#if data.lockedImage}
            <img src={data.lockedImage} alt="Locked" class="locked-img" />
          {/if}
          <div class="locked-headline">Steal Failed — Locked</div>
        </div>
      {:else if rollWinner}
        {@const winnerHelmet = currentEvent.display.schools.find(s => s.school === rollWinner)?.helmet}
        <div class="reveal-stage">
          {#if rollCameLate}
            <div class="quip">Bruh… now you're interested?</div>
          {/if}
          <div class="winner-card-wrap">
            <div class="winner-card">
              {#if winnerHelmet}
                <img src={winnerHelmet} alt={rollWinner} class="winner-img" />
              {:else}
                <div class="winner-img helmet-placeholder">{rollWinner[0] ?? '?'}</div>
              {/if}
            </div>
            <div class="winner-ring" aria-hidden="true"></div>
          </div>
          <div class="winner-name">{rollWinner}</div>
        </div>
      {:else}
        <div class="reveal-stage">
          <div class="winner-name">No Result</div>
        </div>
      {/if}
    {/if}

    <!-- Controls -->
    <div class="controls">
      {#if previouslyRolled && rollState === 'idle'}
        <div class="prev-note">
          Already rolled · saved result
          <b>{previouslyRolled === 'LOCKED' ? 'Locked' : previouslyRolled}</b>
        </div>
        <button class="tp-pill tp-pill-gold" onclick={nextEvent}>
          {isLastEvent ? 'Finish →' : 'Next Event →'}
        </button>
      {:else if rollState === 'idle'}
        <button class="tp-pill tp-pill-gold tp-pill-big roll-btn" onclick={performRoll}>
          {currentEvent.kind === 'auto' && currentEvent.display.solo ? 'Reveal' : 'Roll'}
        </button>
      {:else if rollState === 'revealed'}
        <button class="tp-pill tp-pill-gold" onclick={nextEvent}>
          {isLastEvent ? 'Finish →' : 'Next Event →'}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ============================================================
     Stage card — used for order / finish screens
     ============================================================ */
  .stage {
    min-height: calc(100vh - 80px);
    display: grid;
    place-items: center;
    background:
      radial-gradient(ellipse at top, var(--tp-navy-2) 0%, var(--tp-navy) 60%, var(--tp-navy-dark) 100%);
    padding: 48px 24px;
  }
  .stage-card {
    background: var(--tp-cream);
    border-radius: 4px;
    padding: 56px 56px 40px;
    text-align: center;
    max-width: 640px;
    width: 100%;
    box-shadow:
      0 0 0 1px var(--tp-rule),
      0 0 0 8px var(--tp-navy),
      0 0 0 9px var(--tp-gold),
      0 30px 60px rgba(0, 0, 0, 0.4);
  }
  .stage-eyebrow {
    font-family: var(--tp-display);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .stage-title {
    font-size: 48px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin: 8px 0 14px;
    line-height: 1;
  }
  .stage-stamp { margin-bottom: 18px; }
  .stage-sub { color: var(--tp-muted); font-style: italic; margin: 0 0 28px; }

  .seal {
    position: relative;
    width: 60px;
    height: 60px;
    margin: 0 auto 16px;
  }
  .seal-ring { position: absolute; inset: 0; border: 2px solid var(--tp-navy); border-radius: 50%; }
  .seal-ring::before {
    content: ''; position: absolute; inset: 5px;
    border: 1px solid var(--tp-gold); border-radius: 50%;
  }
  .seal-star {
    position: absolute; inset: 0; display: grid; place-items: center;
    color: var(--tp-gold); font-size: 20px;
  }

  .order-grid { display: grid; gap: 10px; margin-bottom: 8px; }
  .order-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 12px;
    align-items: center;
    padding: 10px 16px;
    background: rgba(15, 42, 71, 0.04);
    border: 1px solid var(--tp-rule);
    border-radius: 4px;
  }
  .order-label {
    font-family: var(--tp-display);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.18em;
    color: var(--tp-navy);
  }
  .order-select { font-family: var(--tp-display); font-weight: 600; letter-spacing: 0.1em; }

  .tp-pill-big {
    padding: 18px 44px;
    font-size: 17px;
    letter-spacing: 0.2em;
  }

  .finish-actions { display: flex; flex-direction: column; gap: 12px; align-items: center; }

  /* ============================================================
     Theater — event display
     ============================================================ */
  .theater {
    min-height: calc(100vh - 80px);
    background:
      radial-gradient(ellipse at top, var(--tp-navy-2) 0%, var(--tp-navy) 55%, var(--tp-navy-dark) 100%);
    color: var(--tp-cream);
    padding: 48px 32px 64px;
    position: relative;
    overflow: hidden;
  }
  .theater-stripes {
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(
        45deg,
        transparent 0,
        transparent 18px,
        rgba(200, 162, 74, 0.04) 18px,
        rgba(200, 162, 74, 0.04) 20px
      );
    pointer-events: none;
  }

  .event-head {
    position: relative;
    text-align: center;
    margin-bottom: 36px;
  }
  .event-chips {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
  }
  .event-prog {
    font-family: var(--tp-display);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.2em;
    color: var(--tp-gold-soft);
    text-transform: uppercase;
    padding-left: 4px;
  }
  .event-prog .of { color: rgba(244, 236, 221, 0.5); padding: 0 4px; }

  .event-player {
    color: var(--tp-cream);
    font-family: var(--tp-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 0.95;
    margin: 0;
    text-shadow: 0 2px 0 var(--tp-navy-dark);
  }

  /* School cards — full-color logos on cream cards framed by navy */
  .schools {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
    margin: 12px 0 36px;
  }
  .school-card {
    width: 200px;
    text-align: center;
    background: var(--tp-cream);
    border: 1.5px solid var(--tp-navy-dark);
    border-radius: 4px;
    padding: 18px 14px 14px;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.25);
    transition: transform 0.12s ease;
  }
  .school-card.ineligible {
    background: rgba(244, 236, 221, 0.55);
  }
  .helmet-frame {
    position: relative;
    width: 140px;
    height: 140px;
    margin: 0 auto 12px;
    display: grid;
    place-items: center;
  }
  .helmet {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .helmet-placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: var(--tp-cream-2);
    color: var(--tp-muted);
    font-family: var(--tp-display);
    font-size: 56px;
    font-weight: 700;
    border-radius: 4px;
  }
  .ineligible .helmet { opacity: 0.3; filter: grayscale(1); }
  .x-badge {
    position: absolute;
    top: 4px; right: 4px;
    width: 36px; height: 36px;
    background: var(--tp-oxblood);
    color: var(--tp-cream);
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--tp-display);
    font-weight: 700;
    font-size: 22px;
    line-height: 1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
  .school-name {
    font-family: var(--tp-display);
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tp-navy);
    margin-bottom: 4px;
  }
  .school-pct {
    font-family: var(--tp-display);
    color: var(--tp-navy);
    letter-spacing: 0.04em;
  }
  .pct-big {
    font-size: 28px;
    font-weight: 700;
    color: var(--tp-navy);
  }
  .pct-big small {
    font-size: 14px;
    color: var(--tp-muted);
    margin-left: 2px;
  }
  .pct-bad {
    color: var(--tp-oxblood);
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
  }

  /* Spinner */
  .spinner-stage {
    position: relative;
    text-align: center;
    margin: 56px 0;
  }
  .spinner-img {
    width: 260px;
    height: 260px;
    object-fit: contain;
    animation: spin 0.55s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  .spinner-fallback {
    display: inline-grid;
    place-items: center;
    background: var(--tp-cream);
    border-radius: 50%;
    color: var(--tp-navy);
    font-size: 100px;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spinner-label {
    margin-top: 18px;
    font-family: var(--tp-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--tp-gold);
  }

  /* Reveal — winning helmet on cream card with gold ring */
  .reveal-stage {
    position: relative;
    text-align: center;
    margin: 32px 0;
    animation: reveal-in 0.4s ease-out;
  }
  @keyframes reveal-in {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }
  .winner-card-wrap {
    position: relative;
    display: inline-block;
    margin-bottom: 18px;
  }
  .winner-card {
    position: relative;
    width: 280px;
    height: 280px;
    background: var(--tp-cream);
    border: 2px solid var(--tp-navy-dark);
    border-radius: 6px;
    display: grid;
    place-items: center;
    padding: 22px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
    transform: scale(1.02);
  }
  .winner-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .winner-ring {
    position: absolute;
    inset: -14px;
    border: 3px solid var(--tp-gold);
    border-radius: 12px;
    pointer-events: none;
    animation: ring-pulse 1.6s ease-in-out infinite;
  }
  @keyframes ring-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(200, 162, 74, 0.4); }
    50%      { box-shadow: 0 0 0 12px rgba(200, 162, 74, 0); }
  }
  .winner-name {
    font-family: var(--tp-display);
    font-size: clamp(40px, 6vw, 64px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tp-cream);
    text-shadow: 0 2px 0 var(--tp-navy-dark);
  }
  .quip {
    font-family: var(--tp-body);
    font-style: italic;
    font-size: clamp(22px, 3vw, 32px);
    color: var(--tp-gold);
    margin-bottom: 16px;
    letter-spacing: 0.01em;
  }

  /* Locked steal — oxblood full-bleed center */
  .reveal-stage.locked .locked-img {
    width: 280px;
    height: 280px;
    object-fit: contain;
    background: var(--tp-cream);
    border: 2px solid var(--tp-oxblood);
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 18px;
    box-shadow: 0 0 0 6px rgba(122, 31, 43, 0.25), 0 8px 30px rgba(0, 0, 0, 0.45);
  }
  .locked-headline {
    font-family: var(--tp-display);
    font-size: clamp(36px, 5vw, 56px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tp-oxblood-soft);
    text-shadow: 0 2px 0 var(--tp-navy-dark);
  }

  /* Controls */
  .controls {
    position: relative;
    text-align: center;
    margin-top: 32px;
  }
  .prev-note {
    color: rgba(244, 236, 221, 0.7);
    font-style: italic;
    margin-bottom: 14px;
    font-size: 14px;
  }
  .prev-note b {
    color: var(--tp-gold-soft);
    font-style: normal;
    font-family: var(--tp-display);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-left: 4px;
  }
  .roll-btn {
    font-size: 24px;
    padding: 22px 72px;
    letter-spacing: 0.28em;
    box-shadow:
      inset 0 -3px 0 var(--tp-gold-2),
      0 6px 24px rgba(200, 162, 74, 0.35);
  }

  .event-alert { max-width: 480px; margin: 0 auto 16px; }
</style>
