<script>
  import { page } from '$app/stores';
  import { goto, invalidateAll } from '$app/navigation';
  import { preloadHelmetCanvas, createConfettiBurst } from '$lib/client/theprogram/confetti.js';

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
      if (!res.ok) throw new Error(await res.text() || 'Could not save order');
      await invalidateAll();
      const first = (data.conferenceList?.[0]?.name) ?? order[0];
      await goto(`/theprogram/show?conf=${encodeURIComponent(first)}`, { invalidateAll: true });
    } catch (e) {
      orderError = e.message;
    } finally {
      savingOrder = false;
    }
  }

  // ---------- Routing ----------
  const confParam = $derived($page.url.searchParams.get('conf') ?? '');
  const eventIndexParam = $derived($page.url.searchParams.get('i'));
  const finishParam = $derived($page.url.searchParams.get('finish') === '1');

  const currentConf = $derived(
    (data.conferenceList ?? []).find(c => c.name === confParam) ?? null
  );
  const currentEvent = $derived(
    currentConf && eventIndexParam != null
      ? currentConf.events[Number.parseInt(eventIndexParam, 10)] ?? null
      : null
  );

  const defaultLanding = $derived.by(() => {
    const list = data.conferenceList ?? [];
    if (list.length === 0) return null;
    const incomplete = list.find(c => c.rolledCount < c.total);
    return incomplete ?? list[list.length - 1];
  });

  const allComplete = $derived(
    (data.conferenceList ?? []).every(c => c.total === 0 || c.rolledCount >= c.total)
      && (data.conferenceList ?? []).length > 0
  );

  // ---------- Roll state ----------
  let rollState = $state('idle'); // 'idle' | 'spinning' | 'exploding' | 'revealed'
  let rollWinner = $state(null);
  let rollOutcome = $state(null);
  let rollCameLate = $state(false);
  let rollError = $state('');
  // Sub-phase of 'spinning' — 'fast' is the normal high-rpm spin, 'slow' is
  // the deceleration + pulse before a long-shot commit explodes.
  let spinPhase = $state('fast');
  // Colors for the spinner glow on the slow phase + confetti burst. Defaults
  // to the brand tokens if the winning school has no extracted colors yet.
  let glowPrimary = $state('#D9A441');
  let glowSecondary = $state('#B8252C');

  // Confetti canvas (always mounted so we can size + bind to it).
  let confettiCanvas = $state(null);
  let confettiController = null;

  // JS-driven spinner rotation (so we can smoothly decelerate).
  let spinnerEl = $state(null);
  let spinRaf = null;
  let spinRotation = 0;       // degrees
  let spinSpeed = 0;          // degrees per millisecond
  const FAST_SPEED = 360 / 550;  // ~0.65 deg/ms — matches the prior 0.55s spin
  const SLOW_SPEED = 360 / 3200; // ~0.11 deg/ms — slow drift before explosion

  function startSpinLoop() {
    if (spinRaf != null) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      spinRotation += spinSpeed * dt;
      if (spinnerEl) spinnerEl.style.transform = `rotate(${spinRotation}deg)`;
      spinRaf = requestAnimationFrame(tick);
    };
    spinRaf = requestAnimationFrame(tick);
  }
  function stopSpinLoop() {
    if (spinRaf != null) {
      cancelAnimationFrame(spinRaf);
      spinRaf = null;
    }
  }
  // Animate spinSpeed from its current value to `targetSpeed` over `durationMs`
  // using ease-out cubic — gradual, not a sudden gear change.
  function decelerateSpin(targetSpeed, durationMs) {
    return new Promise((resolve) => {
      const fromSpeed = spinSpeed;
      const start = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      function tick(now) {
        const t = Math.min(1, (now - start) / durationMs);
        spinSpeed = fromSpeed + (targetSpeed - fromSpeed) * ease(t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  $effect(() => {
    void confParam; void eventIndexParam;
    rollState = 'idle';
    rollWinner = null;
    rollOutcome = null;
    rollCameLate = false;
    rollError = '';
    spinPhase = 'fast';
    lockedDropValues = {};
    lockedAnimDone = false;
    stopSpinLoop();
    spinRotation = 0;
    spinSpeed = 0;
    if (confettiController) {
      confettiController.stop();
      confettiController = null;
    }
    closeEditor();
  });

  // Start the JS spin loop when the spinner mounts in spinning state.
  $effect(() => {
    if (rollState === 'spinning' && spinnerEl) {
      if (spinRaf == null) {
        spinSpeed = FAST_SPEED;
        startSpinLoop();
      }
    } else if (rollState !== 'spinning') {
      stopSpinLoop();
    }
  });

  // Size the confetti canvas to viewport, kept in sync on resize.
  $effect(() => {
    if (!confettiCanvas) return;
    const resize = () => {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  });

  function isSolo(ev) {
    if (!ev) return false;
    if (ev.kind === 'auto' && ev.display.solo) return true;
    if (ev.kind === 'commit' && ev.display.solo) return true;
    // Outcome 4 — only late-joiners tried to steal. No roll needed; the
    // post-roll Stayed-Loyal layout renders directly.
    if (ev.kind === 'steal' && ev.display.noRealAttempt) return true;
    return false;
  }

  async function performRoll(opts = {}) {
    if (!currentEvent || rollState !== 'idle') return;
    rollError = '';

    const skipSpinner =
      opts.instant === true ||
      isSolo(currentEvent) ||
      (currentEvent.kind === 'steal' && currentEvent.display.locked);

    if (!skipSpinner) {
      rollState = 'spinning';
      spinPhase = 'fast';
    }
    const startedAt = Date.now();

    let serverResult;
    try {
      const res = await fetch('/theprogram/show/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIndex: currentEvent.globalIndex })
      });
      if (!res.ok) throw new Error(await res.text());
      serverResult = await res.json();
    } catch (e) {
      rollError = e.message;
      rollState = 'idle';
      return;
    }

    if (skipSpinner) {
      rollWinner = serverResult.winner;
      rollOutcome = serverResult.outcome;
      rollCameLate = !!serverResult.cameLate;
      rollState = 'revealed';
      return;
    }

    // Long-shot commit detection: winner's normalized odds under 25%.
    const winnerSchool = currentEvent.display.schools.find(
      s => s.school?.toLowerCase() === serverResult.winner?.toLowerCase()
    );
    const winnerPct = Number(winnerSchool?.normalized ?? 100);
    const isLongShotCommit = currentEvent.kind === 'commit' && winnerPct < 25;

    if (!isLongShotCommit) {
      const wantedSpin = 3000 + Math.random() * 2000;
      const remaining = Math.max(0, wantedSpin - (Date.now() - startedAt));
      if (remaining > 0) await wait(remaining);
      rollWinner = serverResult.winner;
      rollOutcome = serverResult.outcome;
      rollCameLate = !!serverResult.cameLate;
      rollState = 'revealed';
      return;
    }

    // ---- Long-shot commit flow ----
    // 1. Spin at full speed for 4s.
    // 2. Gradually decelerate over 3.5s with a pulsing team-colored glow.
    // 3. Explode confetti for ~5.5s.
    // 4. Reveal.
    const FAST_MS = 4000;
    const SLOW_MS = 3500;
    const EXPLODE_MS = 5500;

    const fastRemaining = Math.max(0, FAST_MS - (Date.now() - startedAt));
    if (fastRemaining > 0) await wait(fastRemaining);

    // Switch to slow phase: pulse the helmet with the winner's team colors
    // and begin gradual JS-driven deceleration.
    glowPrimary = winnerSchool?.colors?.primary ?? '#D9A441';
    glowSecondary = winnerSchool?.colors?.secondary ?? '#B8252C';
    spinPhase = 'slow';

    // Preload the winner helmet (CORS-stripped) while the spinner slows.
    const helmetPromise = winnerSchool?.helmet
      ? preloadHelmetCanvas(winnerSchool.helmet)
      : Promise.resolve(null);

    // Eased deceleration: speed cubic-eases from FAST_SPEED → SLOW_SPEED over SLOW_MS.
    await decelerateSpin(SLOW_SPEED, SLOW_MS);

    const helmetCanvas = await helmetPromise;

    // Switch to explode state; spawn confetti burst from screen center.
    rollState = 'exploding';
    await wait(20); // let canvas mount/size before spawning
    if (confettiCanvas) {
      confettiController = createConfettiBurst(confettiCanvas, {
        primary: glowPrimary,
        secondary: glowSecondary,
        helmetCanvas,
        count: 480 // doubled for drama
      });
    }
    await wait(EXPLODE_MS);

    rollWinner = serverResult.winner;
    rollOutcome = serverResult.outcome;
    rollCameLate = !!serverResult.cameLate;
    rollState = 'revealed';
  }

  // Auto-reveal solo events (commit / auto-commit with one school)
  $effect(() => {
    if (!currentEvent) return;
    if (rollState !== 'idle') return;
    if (currentEvent.savedResult) return; // already done
    if (!isSolo(currentEvent)) return;
    performRoll({ instant: true });
  });

  function nextUnrolledInConf() {
    if (!currentConf || !currentEvent) return null;
    const evs = currentConf.events;
    const n = evs.length;
    const cur = currentEvent.confIndex;
    for (let step = 1; step <= n; step++) {
      const idx = (cur + step) % n;
      const ev = evs[idx];
      const rolled = ev.savedResult || idx === cur;
      if (!rolled) return idx;
    }
    return null;
  }

  function goToNextRecruit() {
    const next = nextUnrolledInConf();
    if (next != null) {
      goto(`/theprogram/show?conf=${encodeURIComponent(currentConf.name)}&i=${next}`, { invalidateAll: true });
    } else {
      goto(`/theprogram/show?conf=${encodeURIComponent(currentConf.name)}`, { invalidateAll: true });
    }
  }

  function returnToList() {
    if (!currentConf) return;
    goto(`/theprogram/show?conf=${encodeURIComponent(currentConf.name)}`, { invalidateAll: true });
  }

  function goToConference(name) {
    goto(`/theprogram/show?conf=${encodeURIComponent(name)}`, { invalidateAll: true });
  }
  function goToEvent(i) {
    goto(`/theprogram/show?conf=${encodeURIComponent(currentConf.name)}&i=${i}`, { invalidateAll: true });
  }
  function goToFinish() {
    goto(`/theprogram/show?finish=1`, { invalidateAll: true });
  }

  function chipClass(kind) {
    return `tp-stamp ${kind === 'steal' ? 'tp-stamp-oxblood' : kind === 'auto' ? '' : 'tp-stamp-gold'}`;
  }

  const previouslyRolled = $derived(currentEvent?.savedResult ?? null);

  $effect(() => {
    if (!data.hasOrder) return;
    if (finishParam) return;
    if (!confParam && defaultLanding) {
      const target = allComplete
        ? `/theprogram/show?finish=1`
        : `/theprogram/show?conf=${encodeURIComponent(defaultLanding.name)}`;
      goto(target, { replaceState: true, invalidateAll: false });
    }
  });

  const nextConference = $derived.by(() => {
    if (!currentConf) return null;
    const list = data.conferenceList ?? [];
    const idx = list.findIndex(c => c.name === currentConf.name);
    if (idx === -1 || idx >= list.length - 1) return null;
    return list[idx + 1];
  });

  const isLastConference = $derived.by(() => {
    if (!currentConf) return false;
    const list = data.conferenceList ?? [];
    return list[list.length - 1]?.name === currentConf.name;
  });

  // ---------- Steal helpers ----------
  function isStealSuccess() {
    if (!currentEvent || currentEvent.kind !== 'steal') return false;
    if (!rollWinner) return false;
    if (rollOutcome === 'steal_failed_locked' || rollOutcome === 'steal_failed_stayed') return false;
    return rollOutcome === 'steal_succeeded' || rollOutcome === 'steal_succeeded_late';
  }
  function isStealFailedNotLocked() {
    return currentEvent?.kind === 'steal'
      && (rollOutcome === 'steal_failed_stayed');
  }
  function isLockedReveal() {
    return currentEvent?.kind === 'steal'
      && rollState === 'revealed'
      && rollOutcome === 'steal_failed_locked';
  }
  // Outcomes 3 and 4 — both keep the schools view mounted with the same
  // bars + odds-drop + STAYED LOYAL stamp treatment.
  function isStealStayed() {
    return currentEvent?.kind === 'steal'
      && rollState === 'revealed'
      && (rollOutcome === 'steal_failed_stayed' || rollOutcome === 'steal_no_real_attempt');
  }

  // ---------- Locked-reveal odds drop animation ----------
  let lockedDropValues = $state({});
  let lockedAnimDone = $state(false);

  function startLockedAnimation() {
    if (!currentEvent?.display?.schools) return;
    const startValues = {};
    for (const s of currentEvent.display.schools) {
      if (!s.isCommitted) startValues[s.school] = Number(s.normalized ?? 0);
    }
    lockedDropValues = { ...startValues };
    lockedAnimDone = false;

    const start = performance.now();
    const duration = 1400;
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = {};
      for (const k in startValues) next[k] = startValues[k] * (1 - eased);
      lockedDropValues = next;
      if (t < 1) requestAnimationFrame(step);
      else lockedAnimDone = true;
    }
    requestAnimationFrame(step);
  }

  $effect(() => {
    if (isLockedReveal() || isStealStayed()) startLockedAnimation();
  });

  // ---------- Edit panel ----------
  let editOpen = $state(false);
  let editRows = $state([]); // [{ school, percent }]
  let editSaving = $state(false);
  let editError = $state('');

  function openEditor() {
    if (!currentEvent) return;
    editError = '';
    editRows = (currentEvent.display.schools ?? []).map(s => ({
      school: s.school,
      percent: currentEvent.kind === 'commit'
        ? Number((s.raw ?? 0).toFixed(1))
        : Number((s.normalized ?? 0).toFixed(1))
    }));
    editOpen = true;
  }

  function closeEditor() {
    editOpen = false;
    editRows = [];
    editError = '';
  }

  function removeEditRow(i) {
    editRows.splice(i, 1);
  }

  async function saveEdits() {
    editError = '';
    const payload = {
      eventIndex: currentEvent.globalIndex,
      schools: editRows
        .filter(r => r.school?.trim())
        .map(r => ({
          school: r.school.trim(),
          percent: currentEvent.kind === 'commit' ? Number(r.percent) : null
        }))
    };
    if (payload.schools.length === 0) {
      editError = 'Keep at least one school.';
      return;
    }
    if (currentEvent.kind === 'commit') {
      for (const s of payload.schools) {
        if (Number.isNaN(s.percent) || s.percent < 0) {
          editError = `Percent for "${s.school}" is invalid.`;
          return;
        }
      }
    }
    editSaving = true;
    // Capture URL params BEFORE invalidateAll triggers a re-render so we can
    // navigate back to the same event after data refreshes.
    const restoreConf = currentConf?.name;
    const restoreIdx = currentEvent?.confIndex;
    try {
      const res = await fetch('/theprogram/show/edit-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text() || 'Save failed');
      await invalidateAll();
      // Defensive: re-assert the URL so we stay on the same event after
      // the data shape shifts. Without this, the page sometimes flashed
      // back to the launcher because $derived chains briefly went null.
      if (restoreConf && restoreIdx != null) {
        await goto(
          `/theprogram/show?conf=${encodeURIComponent(restoreConf)}&i=${restoreIdx}`,
          { invalidateAll: false, replaceState: true, noScroll: true }
        );
      }
      closeEditor();
    } catch (e) {
      editError = e.message;
    } finally {
      editSaving = false;
    }
  }
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
      <h1 class="stage-title tp-stamped">Conference Order</h1>
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
{:else if (data.conferenceList ?? []).length === 0}
  <div class="stage">
    <div class="stage-card">
      <h1 class="stage-title">No Events to Show</h1>
      <p class="stage-sub">Week {data.weekNumber} has no roll events on file.</p>
      <a href="/theprogram/commish" class="tp-pill tp-pill-navy">Back to Commish</a>
    </div>
  </div>
{:else if finishParam || (allComplete && !confParam)}
  <!-- ============================ Finish ============================ -->
  <div class="stage">
    <div class="stage-card">
      <div class="seal" aria-hidden="true">
        <div class="seal-ring"></div>
        <div class="seal-star">✦</div>
      </div>
      <div class="stage-eyebrow">Curtain</div>
      <h1 class="stage-title tp-stamped">Show Complete</h1>
      <div class="stage-stamp"><span class="tp-stamp tp-stamp-gold">Week {data.weekNumber}</span></div>
      <p class="stage-sub">{data.events.length} event{data.events.length === 1 ? '' : 's'} across {data.conferenceList.length} conferences.</p>
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

    <div class="event-topbar">
      <button class="tp-pill tp-pill-small" onclick={returnToList}>← Return to List</button>
      <div class="event-breadcrumb">
        <span class="tp-stamp">{currentConf.name}</span>
        <span class="event-sep">•</span>
        <span class="event-prog">{currentEvent.confIndex + 1} / {currentConf.total}</span>
      </div>
      <div class="event-topbar-right">
        <button class="edit-btn" onclick={openEditor} aria-label="Edit odds" title="Edit odds">✎</button>
      </div>
    </div>

    <header class="event-head">
      <div class="event-chips">
        <span class={chipClass(currentEvent.kind)}>{currentEvent.type}</span>
      </div>
      <div class="player-wrap">
        <h1 class="event-player tp-stamped-cream">{currentEvent.player}</h1>
        {#if isStealSuccess()}
          <div class="player-name-stamp player-stamp-stolen" aria-label="Stolen">STOLEN</div>
        {:else if isStealStayed()}
          <div class="player-name-stamp player-stamp-stayed" aria-label="Stayed loyal">
            <span class="psl-l1">Stayed</span><span class="psl-l2">Loyal</span>
          </div>
        {/if}
      </div>
    </header>

    {#if rollError}
      <div class="tp-alert tp-alert-error event-alert">{rollError}</div>
    {/if}

    <!-- Schools display — shown pre-roll AND during locked / stayed reveals -->
    {#if rollState === 'idle' || isLockedReveal() || isStealStayed()}
      {@const inPostStealReveal = isLockedReveal() || isStealStayed()}
      <div class="schools" class:schools-locked={isLockedReveal()} class:schools-stayed={isStealStayed()}>
        {#each currentEvent.display.schools as s}
          {@const showBars = inPostStealReveal && !s.isCommitted && data.barsImage}
          {@const showLockSlap = isLockedReveal() && s.isCommitted}
          {@const dropping = inPostStealReveal && !s.isCommitted}
          {@const showLateTag = inPostStealReveal && currentEvent.kind === 'steal' && s.inOriginalRoll === false}
          <div
            class="school-card"
            class:ineligible={s.eligible === false}
            class:committed={currentEvent.kind === 'steal' && s.isCommitted}
            class:locked-active={isLockedReveal()}
            class:stayed-active={isStealStayed()}
          >
            {#if currentEvent.kind === 'steal' && s.isCommitted}
              <div class="committed-banner">Currently Committed</div>
            {/if}
            {#if showLateTag}
              <div class="late-banner">Now You're Interested?</div>
            {/if}
            <div class="helmet-frame">
              {#if s.helmet}
                <img src={s.helmet} alt={s.school} class="helmet" referrerpolicy="no-referrer" />
              {:else}
                <div class="helmet helmet-placeholder">{s.school[0] ?? '?'}</div>
              {/if}
              {#if s.eligible === false}
                <div class="x-badge" aria-label="ineligible">×</div>
              {/if}
              {#if showBars}
                <img src={data.barsImage} alt="" class="bars-overlay" referrerpolicy="no-referrer" />
              {/if}
              {#if showLockSlap}
                <div class="locked-slap-on-card" aria-label="Locked">LOCKED</div>
              {/if}
            </div>
            <div class="school-name">{s.school}</div>
            <div class="school-pct">
              {#if s.eligible === false}
                <span class="pct-bad">{(s.raw ?? 0).toFixed(1)}% · below cut</span>
              {:else if dropping}
                <span class="pct-big dropping">{(lockedDropValues[s.school] ?? s.normalized ?? 0).toFixed(1)}<small>%</small></span>
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
          <img
            bind:this={spinnerEl}
            src={data.placeholderHelmet}
            alt="Rolling…"
            class="spinner-img"
            class:spinning-slow={spinPhase === 'slow'}
            style:--glow-1={glowPrimary}
            style:--glow-2={glowSecondary}
            referrerpolicy="no-referrer"
          />
        {:else}
          <div class="spinner-img spinner-fallback rotating">?</div>
        {/if}
        <div class="spinner-label">{spinPhase === 'slow' ? 'Settling…' : 'Rolling…'}</div>
      </div>
    {/if}

    <!-- Exploding state: confetti only (canvas is rendered below the page) -->
    {#if rollState === 'exploding'}
      <div class="explosion-stage" aria-hidden="true"></div>
    {/if}

    <!-- Reveal: locked + stayed are rendered inside the schools view above.
         This block handles stolen, commit, and auto-commit. -->
    {#if rollState === 'revealed' && !isLockedReveal() && !isStealStayed()}
      {#if isStealSuccess()}
        {@const stealerSchool = currentEvent.display.schools.find(s => s.school?.toLowerCase() === rollWinner?.toLowerCase())}
        {@const stealerHelmet = stealerSchool?.helmet}
        {@const committedSchool = currentEvent.display.schools.find(s => s.isCommitted)}
        {@const committedHelmet = committedSchool?.helmet ?? currentEvent.display.committedSchoolHelmet}
        {@const committedName = committedSchool?.school ?? currentEvent.display.committedSchool ?? ''}
        <!-- Stolen reveal: committed card visible alone, then stealer card slams on top -->
        <div class="reveal-stage steal-success">
          <div class="stolen-stack">
            <div class="winner-card committed-base">
              {#if committedHelmet}
                <img src={committedHelmet} alt={committedName} class="winner-img" referrerpolicy="no-referrer" />
              {:else}
                <div class="winner-img helmet-placeholder">{committedName?.[0]?.toUpperCase() ?? '?'}</div>
              {/if}
            </div>
            <div class="winner-card stealer-slam">
              {#if stealerHelmet}
                <img src={stealerHelmet} alt={rollWinner} class="winner-img" referrerpolicy="no-referrer" />
              {:else}
                <div class="winner-img helmet-placeholder">{rollWinner[0] ?? '?'}</div>
              {/if}
            </div>
            <!-- Tag + committed school name sit on the stack so they aren't
                 covered by the slamming card; they fade out as the slam lands. -->
            <div class="committed-tag">Committed To</div>
            {#if committedName}
              <div class="committed-name">{committedName}</div>
            {/if}
          </div>
          <div class="winner-name tp-stamped-cream">{rollWinner}</div>
        </div>
      {:else if rollWinner}
        {@const winnerSchool = currentEvent.display.schools.find(s => s.school?.toLowerCase() === rollWinner?.toLowerCase())}
        {@const winnerHelmet = winnerSchool?.helmet}
        {@const winnerPct = winnerSchool?.normalized}
        <!-- Commit / Auto-Commit winner -->
        <div class="reveal-stage">
          <div class="winner-card-wrap">
            <div class="winner-card">
              {#if winnerHelmet}
                <img src={winnerHelmet} alt={rollWinner} class="winner-img" referrerpolicy="no-referrer" />
              {:else}
                <div class="winner-img helmet-placeholder">{rollWinner[0] ?? '?'}</div>
              {/if}
            </div>
            <div class="winner-ring" aria-hidden="true"></div>
          </div>
          <div class="winner-name tp-stamped-cream">
            {rollWinner}
            {#if currentEvent.kind === 'commit' && winnerPct != null}
              <span class="winner-pct">{winnerPct.toFixed(1)}%</span>
            {/if}
          </div>
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
        <div class="control-row">
          <button class="tp-pill" onclick={returnToList}>← Return to List</button>
          <button class="tp-pill tp-pill-gold" onclick={goToNextRecruit}>Next Recruit →</button>
        </div>
      {:else if rollState === 'idle'}
        {#if !isSolo(currentEvent)}
          <button class="tp-pill tp-pill-gold tp-pill-big roll-btn" onclick={() => performRoll()}>
            Roll
          </button>
        {/if}
      {:else if rollState === 'revealed'}
        <div class="control-row">
          <button class="tp-pill" onclick={returnToList}>← Return to List</button>
          <button class="tp-pill tp-pill-gold" onclick={goToNextRecruit}>Next Recruit →</button>
        </div>
      {/if}
    </div>

    <!-- Edit modal -->
    {#if editOpen}
      <div class="edit-backdrop" onclick={closeEditor}></div>
      <div class="edit-modal" role="dialog" aria-label="Edit odds">
        <div class="edit-head">
          <div class="edit-eyebrow">Adjust</div>
          <h2 class="edit-title">Edit {currentEvent.type} — {currentEvent.player}</h2>
        </div>
        {#if editError}
          <div class="tp-alert tp-alert-error">{editError}</div>
        {/if}
        <div class="edit-list">
          {#each editRows as row, i}
            <div class="edit-row">
              <input
                type="text"
                bind:value={row.school}
                class="tp-field edit-school"
                placeholder="School name"
              />
              {#if currentEvent.kind === 'commit'}
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  bind:value={row.percent}
                  class="tp-field edit-pct"
                  placeholder="Odds %"
                />
                <span class="edit-unit">%</span>
              {/if}
              <button type="button" class="edit-del" onclick={() => removeEditRow(i)} aria-label="Remove">×</button>
            </div>
          {/each}
        </div>
        <div class="edit-foot">
          <span class="edit-note">
            {currentEvent.kind === 'commit'
              ? 'Saves a single odds string back to every row in this event.'
              : 'Removed schools are deleted from this event.'}
          </span>
          <div class="edit-actions">
            <button class="tp-pill tp-pill-small" onclick={closeEditor}>Cancel</button>
            <button class="tp-pill tp-pill-small tp-pill-gold" onclick={saveEdits} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{:else if currentConf}
  <!-- ============================ Conference Launcher ============================ -->
  <div class="launcher">
    <div class="theater-stripes" aria-hidden="true"></div>

    <header class="launcher-head">
      <div class="launcher-eyebrow">Now Entering</div>
      <h1 class="launcher-title tp-stamped-cream">{currentConf.name}</h1>
      <div class="launcher-meta">
        <span class="tp-stamp tp-stamp-gold">Week {data.weekNumber}</span>
        <span class="launcher-count">{currentConf.rolledCount} / {currentConf.total} rolled</span>
      </div>
      <p class="launcher-sub">Pick any recruit to begin. The order will loop until every recruit is rolled.</p>
    </header>

    <div class="recruits-grid">
      {#each currentConf.events as ev}
        <button
          type="button"
          class="recruit-card"
          class:done={!!ev.savedResult}
          onclick={() => goToEvent(ev.confIndex)}
        >
          <div class="recruit-card-top">
            <span class="recruit-num">{ev.confIndex + 1}</span>
            <span class={chipClass(ev.kind)}>{ev.type}</span>
          </div>
          <div class="recruit-player">{ev.player}</div>
          {#if ev.savedResult}
            <div class="recruit-status">
              <span class="check">✓</span>
              {ev.savedResult === 'LOCKED' ? 'Locked' : ev.savedResult}
            </div>
          {:else}
            <div class="recruit-status pending">Ready to roll</div>
          {/if}
        </button>
      {/each}
    </div>

    <div class="launcher-controls">
      {#if currentConf.rolledCount >= currentConf.total && currentConf.total > 0}
        {#if isLastConference}
          <button class="tp-pill tp-pill-gold tp-pill-big" onclick={goToFinish}>Finish the Show →</button>
        {:else if nextConference}
          <button class="tp-pill tp-pill-gold tp-pill-big" onclick={() => goToConference(nextConference.name)}>
            Next: {nextConference.name} →
          </button>
        {/if}
      {/if}

      <div class="launcher-jump">
        {#each data.conferenceList as c}
          <button
            type="button"
            class="jump-pill"
            class:active={c.name === currentConf.name}
            onclick={() => goToConference(c.name)}
          >
            {c.name}
            <span class="jump-prog">{c.rolledCount}/{c.total}</span>
          </button>
        {/each}
        <button class="jump-pill" onclick={goToFinish}>Finish</button>
      </div>
    </div>
  </div>
{:else}
  <div class="stage">
    <div class="stage-card">
      <h1 class="stage-title">Loading…</h1>
    </div>
  </div>
{/if}

<!-- Confetti overlay — always mounted, only visible during the exploding state -->
<canvas
  bind:this={confettiCanvas}
  class="confetti-canvas"
  class:active={rollState === 'exploding'}
  aria-hidden="true"
></canvas>

<style>
  /* ============================================================
     Stage card — order / finish screens
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
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .stage-title {
    font-family: var(--tp-display);
    font-size: 48px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    margin: 8px 0 14px;
    line-height: 1;
  }
  .stage-stamp { margin-bottom: 18px; }
  .stage-sub { color: var(--tp-muted); font-style: italic; margin: 0 0 28px; }

  .seal { position: relative; width: 60px; height: 60px; margin: 0 auto 16px; }
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
    background: rgba(184, 37, 44, 0.05);
    border: 1px solid var(--tp-rule);
    border-radius: 4px;
  }
  .order-label {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.18em;
    color: var(--tp-navy);
  }
  .order-select { font-family: var(--tp-display-condensed); font-weight: 600; letter-spacing: 0.1em; }

  .tp-pill-big {
    padding: 18px 44px;
    font-size: 17px;
    letter-spacing: 0.2em;
  }

  .finish-actions { display: flex; flex-direction: column; gap: 12px; align-items: center; }

  /* ============================================================
     Launcher
     ============================================================ */
  .launcher {
    min-height: calc(100vh - 80px);
    background:
      radial-gradient(ellipse at top, var(--tp-navy-2) 0%, var(--tp-navy) 55%, var(--tp-navy-dark) 100%);
    color: var(--tp-cream);
    padding: 40px 32px 56px;
    position: relative;
    overflow: hidden;
  }
  .launcher-head { position: relative; text-align: center; margin-bottom: 32px; }
  .launcher-eyebrow {
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: var(--tp-gold-soft);
    margin-bottom: 10px;
  }
  .launcher-title {
    font-family: var(--tp-display);
    font-size: clamp(56px, 9vw, 112px);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1;
    margin: 0 0 18px;
  }
  .launcher-meta { display: inline-flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .launcher-count {
    font-family: var(--tp-display-condensed);
    font-size: 13px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-gold-soft);
  }
  .launcher-sub { color: rgba(244, 236, 221, 0.78); font-style: italic; margin: 0; }

  .recruits-grid {
    position: relative;
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
  }
  .recruit-card {
    text-align: left;
    background: var(--tp-cream);
    color: var(--tp-navy);
    border: 2px solid var(--tp-navy-dark);
    border-radius: 4px;
    padding: 14px 16px 16px;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
    font-family: var(--tp-body);
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25);
    position: relative;
  }
  .recruit-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3), 0 0 0 2px var(--tp-gold);
  }
  .recruit-card.done { background: rgba(244, 236, 221, 0.65); }
  .recruit-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .recruit-num {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.16em;
    color: var(--tp-muted);
  }
  .recruit-player {
    font-family: var(--tp-display);
    font-size: 22px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.05;
    margin-bottom: 10px;
    color: var(--tp-navy);
  }
  .recruit-status {
    font-family: var(--tp-display-condensed);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tp-gold-2);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .recruit-status.pending {
    color: var(--tp-muted);
    font-style: italic;
    text-transform: none;
    letter-spacing: 0.02em;
    font-family: var(--tp-body);
    font-size: 13px;
  }
  .recruit-status .check { color: var(--tp-gold); font-size: 14px; }

  .launcher-controls {
    position: relative;
    max-width: 1200px;
    margin: 36px auto 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
  }
  .launcher-jump { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .jump-pill {
    padding: 8px 14px;
    background: rgba(244, 236, 221, 0.08);
    border: 1px solid rgba(244, 236, 221, 0.25);
    border-radius: 999px;
    color: var(--tp-cream);
    font-family: var(--tp-display-condensed);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .jump-pill:hover { background: rgba(244, 236, 221, 0.16); }
  .jump-pill.active {
    background: var(--tp-gold);
    color: var(--tp-navy-dark);
    border-color: var(--tp-gold-2);
  }
  .jump-prog { font-size: 11px; opacity: 0.7; }

  /* ============================================================
     Theater (event view)
     ============================================================ */
  .theater {
    min-height: calc(100vh - 80px);
    background:
      radial-gradient(ellipse at top, var(--tp-navy-2) 0%, var(--tp-navy) 55%, var(--tp-navy-dark) 100%);
    color: var(--tp-cream);
    padding: 28px 32px 56px;
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
        rgba(217, 164, 65, 0.05) 18px,
        rgba(217, 164, 65, 0.05) 20px
      );
    pointer-events: none;
  }

  .event-topbar {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    margin-bottom: 20px;
    gap: 12px;
  }
  .event-topbar > :first-child { justify-self: start; }
  .event-topbar-right { justify-self: end; display: inline-flex; align-items: center; gap: 8px; }
  .event-breadcrumb {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--tp-cream);
    font-family: var(--tp-display-condensed);
  }
  .event-sep { color: rgba(244, 236, 221, 0.4); }
  .event-prog {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.2em;
    color: var(--tp-gold-soft);
    text-transform: uppercase;
  }
  .event-topbar :global(.tp-pill) {
    background: rgba(244, 236, 221, 0.1);
    color: var(--tp-cream);
    border-color: rgba(244, 236, 221, 0.3);
  }
  .event-topbar :global(.tp-pill:hover:not(:disabled)) {
    background: rgba(244, 236, 221, 0.18);
    box-shadow: none;
    transform: none;
  }
  .edit-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(244, 236, 221, 0.1);
    border: 1px solid rgba(244, 236, 221, 0.3);
    color: var(--tp-gold-soft);
    font-size: 16px;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .edit-btn:hover {
    background: var(--tp-gold);
    color: var(--tp-navy-dark);
    border-color: var(--tp-gold-2);
  }

  .event-head { position: relative; text-align: center; margin-bottom: 32px; }
  .event-chips { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 16px; }

  /* Player-name wrapper — host for the STOLEN stamp overlay */
  .player-wrap {
    position: relative;
    display: inline-block;
    max-width: 100%;
  }
  .event-player {
    font-family: var(--tp-display);
    font-size: clamp(48px, 8vw, 96px);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 0.95;
    margin: 0;
  }

  /* Stamps on the last third of the player name (STOLEN / STAYED LOYAL) */
  .player-name-stamp {
    position: absolute;
    top: 50%;
    left: 66%;
    transform: translate(-30%, -50%) rotate(-8deg);
    font-family: var(--tp-display);
    letter-spacing: 0.04em;
    line-height: 0.9;
    color: var(--tp-cream);
    text-transform: uppercase;
    pointer-events: none;
    z-index: 5;
    text-shadow:
      -3px -3px 0 var(--tp-navy-dark),
       3px -3px 0 var(--tp-navy-dark),
      -3px  3px 0 var(--tp-navy-dark),
       3px  3px 0 var(--tp-navy-dark),
      -5px -5px 0 var(--tp-gold),
       5px -5px 0 var(--tp-gold),
      -5px  5px 0 var(--tp-gold),
       5px  5px 0 var(--tp-gold),
       0 8px 24px rgba(0, 0, 0, 0.6);
  }
  .player-stamp-stolen {
    font-size: clamp(36px, 5vw, 76px);
    /* Lands ~0.4s after the stealer card finishes settling
       (3s hold + 0.55s slam + 0.4s pause). */
    animation: slap 0.45s cubic-bezier(0.18, 1.4, 0.5, 1) 4s both;
  }
  .player-stamp-stayed {
    font-size: clamp(28px, 4vw, 56px);
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    animation: slap 0.45s cubic-bezier(0.18, 1.4, 0.5, 1) 1.4s both;
  }
  .psl-l1, .psl-l2 { display: block; line-height: 0.85; }

  /* "Now you're interested?" pre-roll tag on late-joiner school cards */
  .late-banner {
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%) rotate(-3deg);
    background: var(--tp-oxblood);
    color: var(--tp-gold-soft);
    padding: 4px 10px;
    font-family: var(--tp-body);
    font-style: italic;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    border-radius: 2px;
    white-space: nowrap;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
    z-index: 4;
  }

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
    border: 2px solid var(--tp-navy-dark);
    border-radius: 4px;
    padding: 18px 14px 14px;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.25);
    position: relative;
  }
  .school-card.ineligible { background: rgba(244, 236, 221, 0.55); }
  .school-card.committed {
    border-color: var(--tp-gold);
    box-shadow:
      0 0 0 3px var(--tp-gold),
      0 6px 0 rgba(0, 0, 0, 0.3);
  }
  .committed-banner {
    position: absolute;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--tp-gold);
    color: var(--tp-navy-dark);
    padding: 4px 12px;
    font-family: var(--tp-display-condensed);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    border-radius: 2px;
    white-space: nowrap;
    box-shadow: 0 2px 0 var(--tp-gold-2);
  }

  .helmet-frame {
    position: relative;
    width: 140px;
    height: 140px;
    margin: 0 auto 12px;
    display: grid;
    place-items: center;
  }
  .helmet { max-width: 100%; max-height: 100%; object-fit: contain; }
  .helmet-placeholder {
    width: 100%; height: 100%; display: grid; place-items: center;
    background: var(--tp-cream-2); color: var(--tp-muted);
    font-family: var(--tp-display); font-size: 56px; border-radius: 4px;
  }
  .ineligible .helmet { opacity: 0.3; filter: grayscale(1); }
  .x-badge {
    position: absolute;
    top: 4px; right: 4px;
    width: 36px; height: 36px;
    background: var(--tp-navy);
    color: var(--tp-cream);
    border-radius: 50%;
    display: grid; place-items: center;
    font-family: var(--tp-display);
    font-size: 22px;
    line-height: 1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
  .school-name {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tp-navy);
    margin-bottom: 4px;
  }
  .school-pct { font-family: var(--tp-display-condensed); color: var(--tp-navy); letter-spacing: 0.04em; }
  .pct-big { font-size: 28px; font-weight: 700; color: var(--tp-navy); }
  .pct-big small { font-size: 14px; color: var(--tp-muted); margin-left: 2px; }
  .pct-bad {
    color: var(--tp-oxblood);
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
  }

  .spinner-stage { position: relative; text-align: center; margin: 56px 0; }
  .spinner-img {
    width: 260px; height: 260px; object-fit: contain;
    /* Rotation is JS-driven via inline `transform` so it can decelerate
       smoothly across the slow phase. The pulse below is layered separately. */
  }
  /* Fallback (no placeholder helmet uploaded) uses CSS-only rotation. */
  .spinner-img.rotating {
    animation: spin 0.55s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  /* Slow phase: pulsing team-colored drop-shadow. JS handles rotation speed. */
  .spinner-img.spinning-slow {
    animation: spinner-pulse 1.4s ease-in-out infinite;
  }
  @keyframes spinner-pulse {
    0%, 100% {
      filter:
        drop-shadow(0 0 8px var(--glow-1, var(--tp-gold)));
    }
    50% {
      filter:
        drop-shadow(0 0 24px var(--glow-1, var(--tp-gold)))
        drop-shadow(0 0 56px var(--glow-2, var(--tp-navy)))
        drop-shadow(0 0 80px var(--glow-2, var(--tp-navy)));
    }
  }
  .explosion-stage { min-height: 360px; }
  .confetti-canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 80;
    opacity: 0;
    transition: opacity 0.18s ease-out;
  }
  .confetti-canvas.active { opacity: 1; }
  .spinner-fallback {
    display: inline-grid; place-items: center;
    background: var(--tp-cream); border-radius: 50%; color: var(--tp-navy); font-size: 100px;
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .spinner-label {
    margin-top: 18px;
    font-family: var(--tp-display-condensed);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--tp-gold);
  }

  .reveal-stage {
    position: relative;
    text-align: center;
    margin: 32px 0 64px;
    animation: reveal-in 0.4s ease-out;
  }
  /* Locked steal needs even more breathing room since the slap sits on the
     locked card directly (no winner-name spacer below). */
  .reveal-stage.locked .locked-wrap { margin-bottom: 32px; }
  @keyframes reveal-in {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }
  .winner-card-wrap {
    position: relative;
    display: inline-block;
    margin-bottom: 48px; /* room for rotated STOLEN/FAILED slap overhang */
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
    overflow: hidden;
  }
  .winner-img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .bars-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    mix-blend-mode: multiply;
    pointer-events: none;
    animation: bars-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes bars-drop {
    from { transform: translateY(-30%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
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
    0%, 100% { box-shadow: 0 0 0 0 rgba(217, 164, 65, 0.5); }
    50% { box-shadow: 0 0 0 12px rgba(217, 164, 65, 0); }
  }
  .winner-name {
    font-family: var(--tp-display);
    font-size: clamp(40px, 6vw, 64px);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .winner-pct {
    font-family: var(--tp-display-condensed);
    font-size: 0.55em;
    color: var(--tp-gold);
    letter-spacing: 0.06em;
    font-weight: 700;
    text-shadow: 0 2px 0 var(--tp-navy-dark);
  }

  /* Slap overlays — sit on top of the winner / locked card */
  .stolen-slap,
  .failed-slap,
  .locked-slap {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-8deg);
    font-family: var(--tp-display);
    letter-spacing: 0.04em;
    color: var(--tp-cream);
    text-transform: uppercase;
    line-height: 0.85;
    text-align: center;
    pointer-events: none;
    z-index: 5;
    text-shadow:
      -3px -3px 0 var(--tp-navy-dark),
       3px -3px 0 var(--tp-navy-dark),
      -3px  3px 0 var(--tp-navy-dark),
       3px  3px 0 var(--tp-navy-dark),
       0 0 12px rgba(0, 0, 0, 0.9),
       0 14px 30px rgba(0, 0, 0, 0.55);
    animation: slap 0.4s cubic-bezier(0.18, 1.4, 0.5, 1);
  }
  .stolen-slap {
    font-size: clamp(80px, 14vw, 200px);
    color: var(--tp-cream);
    text-shadow:
      -3px -3px 0 var(--tp-navy-dark),
       3px -3px 0 var(--tp-navy-dark),
      -3px  3px 0 var(--tp-navy-dark),
       3px  3px 0 var(--tp-navy-dark),
      -6px -6px 0 var(--tp-gold),
       6px -6px 0 var(--tp-gold),
      -6px  6px 0 var(--tp-gold),
       6px  6px 0 var(--tp-gold),
       0 14px 36px rgba(0, 0, 0, 0.7);
  }
  .failed-slap,
  .locked-slap {
    font-size: clamp(56px, 9vw, 124px);
    color: var(--tp-cream);
  }
  @keyframes slap {
    from { transform: translate(-50%, -50%) rotate(-8deg) scale(0.3); opacity: 0; }
    60%  { transform: translate(-50%, -50%) rotate(-8deg) scale(1.15); opacity: 1; }
    to   { transform: translate(-50%, -50%) rotate(-8deg) scale(1); }
  }

  /* Locked steal — schools view augmented with bars + LOCKED slam */
  .schools-locked .school-card.committed {
    /* Pulse halo to draw attention to the locked one */
    animation: locked-pulse 1.5s ease-in-out infinite;
  }
  @keyframes locked-pulse {
    0%, 100% { box-shadow: 0 0 0 3px var(--tp-gold), 0 6px 0 rgba(0, 0, 0, 0.3); }
    50%      { box-shadow: 0 0 0 8px var(--tp-gold), 0 6px 0 rgba(0, 0, 0, 0.3); }
  }
  .helmet-frame .bars-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    mix-blend-mode: multiply;
    pointer-events: none;
    animation: bars-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
    z-index: 3;
  }
  .locked-slap-on-card {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-8deg);
    font-family: var(--tp-display);
    font-size: clamp(28px, 4vw, 48px);
    line-height: 0.85;
    color: var(--tp-cream);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-align: center;
    pointer-events: none;
    z-index: 6;
    text-shadow:
      -2px -2px 0 var(--tp-navy-dark),
       2px -2px 0 var(--tp-navy-dark),
      -2px  2px 0 var(--tp-navy-dark),
       2px  2px 0 var(--tp-navy-dark),
      -4px -4px 0 var(--tp-gold),
       4px -4px 0 var(--tp-gold),
      -4px  4px 0 var(--tp-gold),
       4px  4px 0 var(--tp-gold),
       0 6px 18px rgba(0, 0, 0, 0.7);
    animation: slap 0.45s cubic-bezier(0.18, 1.4, 0.5, 1) 0.7s both;
  }
  .pct-big.dropping {
    color: var(--tp-oxblood);
    font-variant-numeric: tabular-nums;
  }

  /* Stolen reveal — committed card visible, stealer slams on top */
  .stolen-stack {
    position: relative;
    display: inline-block;
    width: 320px;
    height: 320px;
    margin-bottom: 48px;
  }
  .stolen-stack .winner-card {
    position: absolute;
    inset: 0;
    margin: 0;
    transform: none;
  }
  .stolen-stack .committed-base {
    z-index: 1;
    border-color: var(--tp-gold);
    box-shadow: 0 0 0 3px var(--tp-gold), 0 8px 30px rgba(0, 0, 0, 0.45);
  }
  .committed-tag {
    position: absolute;
    top: -22px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--tp-gold);
    color: var(--tp-navy-dark);
    padding: 4px 12px;
    font-family: var(--tp-display-condensed);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    border-radius: 2px;
    white-space: nowrap;
    box-shadow: 0 2px 0 var(--tp-gold-2);
    z-index: 5;
    /* Fades out just before the stealer card lands. */
    animation: committed-fade-out 0.3s ease 2.85s both;
  }
  .committed-name {
    position: absolute;
    bottom: -38px;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--tp-display-condensed);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--tp-cream);
    white-space: nowrap;
    text-shadow: 0 2px 0 var(--tp-navy-dark);
    z-index: 5;
    animation: committed-fade-out 0.3s ease 2.85s both;
  }
  @keyframes committed-fade-out {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to   { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  }
  .stolen-stack .stealer-slam {
    z-index: 4;
    /* Committed school sits alone for a full 3s, then the stealer slams. */
    animation: stealer-slam 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 3s both;
  }
  @keyframes stealer-slam {
    0%   { transform: translateY(-180vh) scale(1.6) rotate(-12deg); opacity: 0; }
    70%  { transform: translateY(8px) scale(1.04) rotate(2deg); opacity: 1; }
    100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
  }
  .quip {
    font-family: var(--tp-body);
    font-style: italic;
    font-size: clamp(22px, 3vw, 32px);
    color: var(--tp-gold);
    margin-bottom: 16px;
  }

  .controls { position: relative; text-align: center; margin-top: 64px; z-index: 10; }
  .control-row {
    display: inline-flex; gap: 14px; flex-wrap: wrap; justify-content: center;
  }
  .control-row :global(.tp-pill:not(.tp-pill-gold)) {
    background: rgba(244, 236, 221, 0.12);
    color: var(--tp-cream);
    border-color: rgba(244, 236, 221, 0.4);
  }
  .control-row :global(.tp-pill:not(.tp-pill-gold):hover:not(:disabled)) {
    background: rgba(244, 236, 221, 0.2);
    box-shadow: none;
  }
  .prev-note { color: rgba(244, 236, 221, 0.78); font-style: italic; margin-bottom: 14px; font-size: 14px; }
  .prev-note b {
    color: var(--tp-gold-soft);
    font-style: normal;
    font-family: var(--tp-display-condensed);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-left: 4px;
  }
  .roll-btn {
    font-size: 24px;
    padding: 22px 72px;
    letter-spacing: 0.28em;
    box-shadow: inset 0 -3px 0 var(--tp-gold-2), 0 6px 24px rgba(217, 164, 65, 0.4);
  }
  .event-alert { max-width: 480px; margin: 0 auto 16px; }

  /* ============================================================
     Edit modal
     ============================================================ */
  .edit-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 90;
    cursor: pointer;
  }
  .edit-modal {
    position: fixed;
    z-index: 91;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--tp-cream);
    border-radius: 6px;
    width: min(540px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    overflow: auto;
    padding: 24px 24px 18px;
    box-shadow:
      0 0 0 1px var(--tp-rule),
      0 0 0 8px var(--tp-navy),
      0 0 0 9px var(--tp-gold),
      0 30px 60px rgba(0, 0, 0, 0.5);
  }
  .edit-head { margin-bottom: 12px; }
  .edit-eyebrow {
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-muted);
  }
  .edit-title {
    font-family: var(--tp-display);
    font-size: 22px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--tp-navy);
    margin: 4px 0 0;
  }
  .edit-list { display: grid; gap: 8px; margin: 16px 0; }
  .edit-row {
    display: grid;
    grid-template-columns: 1fr 90px auto auto;
    align-items: center;
    gap: 8px;
  }
  .edit-school { font-size: 14px; }
  .edit-pct { font-size: 14px; text-align: right; }
  .edit-unit { font-family: var(--tp-display-condensed); color: var(--tp-muted); font-size: 14px; }
  .edit-del {
    background: transparent;
    border: 1px solid transparent;
    color: var(--tp-oxblood);
    border-radius: 3px;
    width: 32px;
    height: 32px;
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
  }
  .edit-del:hover {
    background: rgba(122, 31, 43, 0.1);
    border-color: var(--tp-oxblood);
  }
  .edit-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    border-top: 1px solid var(--tp-rule);
    padding-top: 12px;
    margin-top: 8px;
  }
  .edit-note { color: var(--tp-muted); font-size: 12px; font-style: italic; }
  .edit-actions { display: inline-flex; gap: 8px; }
</style>
