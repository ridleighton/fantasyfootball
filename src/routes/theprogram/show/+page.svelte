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
  let rollError = $state('');
  // Colors for the spinner glow on the slow phase + confetti burst. Defaults
  // to the brand tokens if the winning school has no extracted colors yet.
  let glowPrimary = $state('#D9A441');
  let glowSecondary = $state('#B8252C');

  // Confetti canvas (always mounted so we can size + bind to it).
  let confettiCanvas = $state(null);
  let confettiController = null;

  // JS-driven spinner rotation. Frame-based (degrees per RAF tick) to match
  // the spec values verbatim: 14 deg/frame during spin_fast, * 0.962 per
  // frame during spin_slow (floor 0.4).
  let spinnerEl = $state(null);
  let spinRaf = null;
  let spinRotation = 0;       // degrees, accumulates forever
  let spinSpeed = 0;          // degrees per RAF tick
  const REGULAR_SPIN_SPEED = 11; // ~660 deg/s, matches the old 0.55s/rev look
  const UPSET_FAST_SPEED   = 14; // spec
  const UPSET_SLOW_FLOOR   = 0.4;
  const UPSET_SLOW_DECAY   = 0.962;

  // Upset (long-shot commit) phase machine. Drives CSS classes on the
  // spinner image and the darken overlay. 'off' = not in the upset flow.
  let upsetPhase = $state('off');
  let darkenOpacity = $state(0);

  // Auto-commit phase machine.
  //   'off'           — not in the auto-commit flow
  //   'megaphone'     — bursts emitting from each bidder card (~1200ms)
  //   'fading'        — non-bidder cards fading out (~600ms)
  //   'solo_done'     — sole-bidder reveal active
  //   'phase2_ready' — contested: bidder cards visible with equalized odds,
  //                    awaiting second Roll click
  //   'phase2_spin'   — contested second spinner running
  //   'phase2_done'   — contested winner revealed
  let acPhase = $state('off');
  let acMegaphonesBySchool = $state({}); // school → [{ dx, dy, delay, duration }]
  // For contested auto-commits we already know the winner from the first
  // server call — stash it until the second Roll click finishes its spin.
  let pendingAcWinner = $state(null);
  let pendingAcOutcome = $state(null);

  function spawnMegaphoneParticles() {
    const n = 14;
    return Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.45;
      const dist = 90 + Math.random() * 70;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: Math.random() * 180,
        duration: 800 + Math.random() * 350
      };
    });
  }

  function startSpinLoop() {
    if (spinRaf != null) return;
    const tick = () => {
      if (upsetPhase === 'spin_slow') {
        spinSpeed = Math.max(UPSET_SLOW_FLOOR, spinSpeed * UPSET_SLOW_DECAY);
      }
      const rotating =
        rollState === 'spinning' && (
          upsetPhase === 'off' ||
          upsetPhase === 'spin_fast' ||
          upsetPhase === 'spin_slow'
        );
      if (rotating) spinRotation += spinSpeed;
      // Always publish the current angle as a CSS custom property; the
      // .spinner-img base rule reads it via transform: rotate(var(--spin-deg)).
      // Using a custom prop instead of element.style.transform means the
      // phase-specific CSS rules (.upset-in, .upset-explode, etc.) can
      // override `transform` cleanly — no inline-style war.
      if (spinnerEl) spinnerEl.style.setProperty('--spin-deg', `${spinRotation}deg`);
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

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Rubber-stamp animation trigger — double rAF so the browser has a chance
  // to commit the initial opacity:0 state before the keyframe fires.
  // Optionally shakes a target element on impact ("thud").
  function stampIn(node, opts = {}) {
    let cancelled = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return;
      node.classList.add('animate');
      const targetSel = opts.thudTarget;
      if (targetSel) {
        const t = typeof targetSel === 'string'
          ? node.closest(targetSel)
          : targetSel;
        if (t && typeof t.animate === 'function') {
          t.animate([
            { transform: 'translateY(0) scale(1)' },
            { transform: 'translateY(7px) scale(0.99)' },
            { transform: 'translateY(-3px) scale(1.005)' },
            { transform: 'translateY(0) scale(1)' }
          ], { duration: 260, easing: 'ease-out' });
        }
      }
    }));
    return {
      destroy() { cancelled = true; }
    };
  }

  $effect(() => {
    void confParam; void eventIndexParam;
    rollState = 'idle';
    rollWinner = null;
    rollOutcome = null;
    rollError = '';
    upsetPhase = 'off';
    darkenOpacity = 0;
    acPhase = 'off';
    acMegaphonesBySchool = {};
    lockedDropValues = {};
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
  // For the regular (non-upset) path, set a constant speed up front.
  // The upset flow will overwrite spinSpeed at the right phase boundary.
  $effect(() => {
    if (rollState === 'spinning' && spinnerEl) {
      if (spinRaf == null) {
        if (upsetPhase === 'off') spinSpeed = REGULAR_SPIN_SPEED;
        startSpinLoop();
      }
    } else if (rollState !== 'spinning') {
      stopSpinLoop();
    }
  });

  // Reset the rotation accumulator at the start of the upset 'in' phase
  // so the helmet springs in from a clean angle. The CSS variable is
  // updated on the next RAF tick. No inline-transform-clearing effect
  // needed — phase-specific rules override `transform` directly.
  $effect(() => {
    if (upsetPhase === 'in') spinRotation = 0;
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
    // Auto-commits no longer auto-trigger — they wait for the commissioner
    // to press "Reveal Auto-Commits".
    if (ev.kind === 'commit' && ev.display.solo) return true;
    // Outcome 4 — only late-joiners tried to steal. No roll needed; the
    // post-roll Stayed-Loyal layout renders directly.
    if (ev.kind === 'steal' && ev.display.noRealAttempt) return true;
    return false;
  }

  async function performRoll(opts = {}) {
    if (!currentEvent || rollState !== 'idle') return;
    rollError = '';

    // Clear any prior confetti burst that's still ticking — happens when a
    // contested auto-commit re-rolls, or any event is rolled twice in the
    // same session after an edit.
    if (confettiController) {
      confettiController.stop();
      confettiController = null;
    }

    const skipSpinner =
      opts.instant === true ||
      isSolo(currentEvent) ||
      (currentEvent.kind === 'steal' && currentEvent.display.locked);

    if (!skipSpinner) {
      rollState = 'spinning';
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
      rollState = 'revealed';
      return;
    }

    // ---- Auto-Commit flow ----
    if (currentEvent.kind === 'auto') {
      const acSchools = currentEvent.display.autoCommitSchools ?? [];
      // Seed megaphone particles per bidder card.
      const byS = {};
      for (const s of acSchools) byS[s] = spawnMegaphoneParticles();
      acMegaphonesBySchool = byS;

      acPhase = 'megaphone';
      await wait(1200);

      acPhase = 'fading';
      await wait(600);

      if (acSchools.length <= 1) {
        // Sole bidder — straight to the winner reveal.
        rollWinner = serverResult.winner;
        rollOutcome = serverResult.outcome;
        acPhase = 'solo_done';
        rollState = 'revealed';
      } else {
        // Contested — stash the server's winner and wait for the Roll click.
        pendingAcWinner = serverResult.winner;
        pendingAcOutcome = serverResult.outcome;
        acPhase = 'phase2_ready';
        // Drop rollState back to idle so the schools markup re-renders with
        // the phase-2 layout (equalized odds + second Roll button).
        rollState = 'idle';
      }
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
      rollState = 'revealed';
      return;
    }

    // ---- Long-shot commit / upset flow (per the spec) ----
    //   in (500ms) → pulse (1800ms) → spin_fast (3500ms) → spin_slow (2000ms)
    //   → stop_glow (3500ms) → explode (260ms) → confetti (5000ms)
    //   → cooling (700ms) → reveal
    glowPrimary = winnerSchool?.colors?.primary ?? '#D9A441';
    glowSecondary = winnerSchool?.colors?.secondary ?? '#B8252C';

    // Preload a helmet for the confetti burst. Try the winning school first;
    // fall back to the Placeholder Helmet so the burst always has helmet
    // pieces (otherwise schools without an uploaded helmet would produce a
    // helmet-less confetti, which reads as "broken").
    const helmetPromise = (async () => {
      if (winnerSchool?.helmet) {
        const c = await preloadHelmetCanvas(winnerSchool.helmet);
        if (c) return c;
      }
      if (data.placeholderHelmet) {
        const c = await preloadHelmetCanvas(data.placeholderHelmet);
        if (c) return c;
      }
      return null;
    })();

    upsetPhase = 'in';
    await wait(500);

    upsetPhase = 'pulse';
    await wait(1800);

    upsetPhase = 'spin_fast';
    spinSpeed = UPSET_FAST_SPEED;
    await wait(3500);

    upsetPhase = 'spin_slow';
    // The spin loop will decay spinSpeed *= 0.962 per frame, floor 0.4.
    await wait(2000);

    upsetPhase = 'stop_glow';
    spinSpeed = 0; // freeze rotation at its final angle
    darkenOpacity = 0.62;
    await wait(3500);

    upsetPhase = 'explode';
    const helmetCanvas = await helmetPromise;
    await wait(260);

    upsetPhase = 'confetti';
    if (confettiCanvas) {
      // Stop any prior burst (e.g. a back-to-back upset) before starting the new one.
      if (confettiController) confettiController.stop();
      confettiController = createConfettiBurst(confettiCanvas, {
        primary: glowPrimary,
        secondary: glowSecondary,
        accent: '#F4ECDD',
        helmetCanvas,
        count: 240
      });
    }
    await wait(5000);

    upsetPhase = 'cooling';
    darkenOpacity = 0;
    await wait(700);

    upsetPhase = 'off';
    rollWinner = serverResult.winner;
    rollOutcome = serverResult.outcome;
    rollState = 'revealed';
  }

  // Auto-reveal solo events (commit with one school). Don't fire while the
  // edit modal is open — opening the modal on a solo-commit event would
  // otherwise persist a roll result mid-edit, leaving the CSV with a winner
  // derived from pre-edit odds.
  $effect(() => {
    if (!currentEvent) return;
    if (rollState !== 'idle') return;
    if (currentEvent.savedResult) return; // already done
    if (editOpen) return;
    if (!isSolo(currentEvent)) return;
    performRoll({ instant: true });
  });

  // Contested auto-commit second roll. The server already determined the
  // winner during the first Roll click — the spin here is ceremonial.
  async function performAcPhase2Roll() {
    if (acPhase !== 'phase2_ready') return;
    acPhase = 'phase2_spin';
    rollState = 'spinning';
    spinSpeed = REGULAR_SPIN_SPEED;
    await wait(3200 + Math.random() * 1200);
    rollWinner = pendingAcWinner;
    rollOutcome = pendingAcOutcome;
    acPhase = 'phase2_done';
    rollState = 'revealed';
    pendingAcWinner = null;
    pendingAcOutcome = null;
  }

  const isAcPhase2 = $derived(
    currentEvent?.kind === 'auto'
    && (acPhase === 'phase2_ready' || acPhase === 'phase2_spin' || acPhase === 'phase2_done')
  );

  const acBiddersLower = $derived(
    new Set((currentEvent?.display?.autoCommitSchools ?? []).map(s => s.toLowerCase()))
  );

  // Phase-2 equalized schools — only the bidders, equal odds across them.
  const acPhase2Schools = $derived.by(() => {
    if (!currentEvent || currentEvent.kind !== 'auto') return [];
    const ac = currentEvent.display.autoCommitSchools ?? [];
    if (ac.length <= 1) return [];
    const acLower = new Set(ac.map(s => s.toLowerCase()));
    const pct = 100 / ac.length;
    return currentEvent.display.schools
      .filter(s => acLower.has(s.school.toLowerCase()))
      .map(s => ({ ...s, raw: pct, normalized: pct, eligible: true }));
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
    return currentEvent?.kind === 'steal'
      && rollState === 'revealed'
      && !!rollWinner
      && rollOutcome === 'steal_succeeded';
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

  // ---------- Locked / stayed reveal: odds drop animation ----------
  let lockedDropValues = $state({});

  function startLockedAnimation() {
    if (!currentEvent?.display?.schools) return;
    const startValues = {};
    for (const s of currentEvent.display.schools) {
      if (!s.isCommitted) startValues[s.school] = Number(s.normalized ?? 0);
    }
    lockedDropValues = { ...startValues };

    const start = performance.now();
    const duration = 1400;
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = {};
      for (const k in startValues) next[k] = startValues[k] * (1 - eased);
      lockedDropValues = next;
      if (t < 1) requestAnimationFrame(step);
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
      // Re-assert the URL in case query params drifted. The launcher
      // branch is gated by !editOpen && !editSaving above, so this is no
      // longer compensating for a flash — just keeping URL state tidy.
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
          <div class="rect-stamp player-stamp" use:stampIn={{ thudTarget: '.player-wrap' }} aria-label="Stolen">
            <div class="rect-stamp-inner">
              <span class="stamp-label">Stolen</span>
              <span class="stamp-sub">Tampering Confirmed</span>
            </div>
          </div>
        {:else if isStealStayed()}
          <div class="rect-stamp player-stamp" use:stampIn={{ thudTarget: '.player-wrap' }} aria-label="Stayed loyal">
            <div class="rect-stamp-inner">
              <span class="stamp-label">Loyal</span>
              <span class="stamp-sub">Commitment Secured</span>
            </div>
          </div>
        {/if}
      </div>
    </header>

    {#if rollError}
      <div class="tp-alert tp-alert-error event-alert">{rollError}</div>
    {/if}

    <!-- Schools display — shown pre-roll AND during locked / stayed reveals.
         Auto-commit Phase 2 (contested) renders a different markup further below. -->
    {#if !isAcPhase2 && (rollState === 'idle' || isLockedReveal() || isStealStayed() || acPhase === 'megaphone' || acPhase === 'fading' || acPhase === 'solo_done')}
      {@const inPostStealReveal = isLockedReveal() || isStealStayed()}
      <div class="schools" class:schools-locked={isLockedReveal()}>
        {#each currentEvent.display.schools as s}
          {@const showBars = inPostStealReveal && !s.isCommitted && data.barsImage}
          {@const showLockSlap = isLockedReveal() && s.isCommitted}
          {@const dropping = inPostStealReveal && !s.isCommitted}
          {@const showLateTag = inPostStealReveal && currentEvent.kind === 'steal' && s.inOriginalRoll === false}
          {@const isAcBidder = currentEvent.kind === 'auto' && acBiddersLower.has(s.school.toLowerCase())}
          {@const acFading = currentEvent.kind === 'auto' && acPhase === 'fading' && !isAcBidder}
          {@const acHidden = currentEvent.kind === 'auto' && acPhase === 'solo_done' && !isAcBidder}
          <div
            class="school-card"
            class:ineligible={s.eligible === false}
            class:committed={currentEvent.kind === 'steal' && s.isCommitted}
            class:ac-bidder={isAcBidder}
            class:ac-fading={acFading}
            class:ac-hidden={acHidden}
            style:display={acHidden ? 'none' : null}
          >
            {#if currentEvent.kind === 'steal' && s.isCommitted}
              <div class="committed-banner">Currently Committed</div>
            {/if}
            {#if showLateTag}
              <div class="late-banner">Now You're Interested?</div>
            {/if}
            {#if isAcBidder && acPhase === 'megaphone'}
              <div class="megaphone-burst" aria-hidden="true">
                {#each (acMegaphonesBySchool[s.school] ?? []) as m, i (i)}
                  <span
                    class="megaphone"
                    style:--m-dx="{m.dx}px"
                    style:--m-dy="{m.dy}px"
                    style:--m-delay="{m.delay}ms"
                    style:--m-duration="{m.duration}ms"
                  >📣</span>
                {/each}
              </div>
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
                <div class="rect-stamp card-stamp" use:stampIn={{ thudTarget: '.school-card' }} aria-label="Locked">
                  <div class="rect-stamp-inner">
                    <span class="stamp-label">Locked</span>
                    <span class="stamp-sub">Commitment Ironclad</span>
                  </div>
                </div>
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

    <!-- Darken overlay — covers the theater backdrop during stop_glow.
         Inline opacity is state-driven; the CSS transition handles the fade. -->
    <div class="darken-overlay" style:opacity={darkenOpacity} aria-hidden="true"></div>

    <!-- Spinner — mounted for both regular spinning and the full upset sequence -->
    {#if rollState === 'spinning'}
      <div class="spinner-stage" data-upset={upsetPhase}>
        {#if data.placeholderHelmet}
          <img
            bind:this={spinnerEl}
            src={data.placeholderHelmet}
            alt="Rolling…"
            class="spinner-img"
            class:upset-in={upsetPhase === 'in'}
            class:upset-pulse={upsetPhase === 'pulse'}
            class:upset-stop-glow={upsetPhase === 'stop_glow'}
            class:upset-explode={upsetPhase === 'explode' || upsetPhase === 'confetti' || upsetPhase === 'cooling'}
            style:--glow-1={glowPrimary}
            style:--glow-2={glowSecondary}
            referrerpolicy="no-referrer"
          />
        {:else}
          <div class="spinner-img spinner-fallback rotating">?</div>
        {/if}
        {#if upsetPhase === 'off'}
          <div class="spinner-label">Rolling…</div>
        {:else if upsetPhase === 'in' || upsetPhase === 'pulse'}
          <div class="spinner-label">Something's happening…</div>
        {:else if upsetPhase === 'spin_fast' || upsetPhase === 'spin_slow'}
          <div class="spinner-label">Rolling…</div>
        {:else if upsetPhase === 'stop_glow'}
          <div class="spinner-label upset-charge-label">Upset Brewing</div>
        {/if}
      </div>
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
          {#if currentEvent.kind === 'auto' && acPhase === 'solo_done'}
            <div class="ac-solo-line">
              <strong>{rollWinner}</strong> has auto-committed
              <strong>{currentEvent.player}</strong>. Money well spent.
            </div>
          {/if}
        </div>
      {:else}
        <div class="reveal-stage">
          <div class="winner-name">No Result</div>
        </div>
      {/if}
    {/if}

    <!-- Auto-Commit Phase 2 (contested) — bidders only, equalized odds,
         second Roll button. After Roll click, rollState becomes 'spinning'
         and this block hides while the regular spinner runs; reveal lands
         via the standard winner-card markup above. -->
    {#if currentEvent.kind === 'auto' && acPhase === 'phase2_ready'}
      <div class="ac-phase2-head">
        <div class="ac-phase2-eyebrow">Auto-Commit Contested</div>
        <h2 class="ac-phase2-title tp-stamped-cream">Multiple schools went all in. Roll to decide.</h2>
      </div>
      <div class="schools">
        {#each acPhase2Schools as s (s.school)}
          <div class="school-card ac-bidder">
            <div class="helmet-frame">
              {#if s.helmet}
                <img src={s.helmet} alt={s.school} class="helmet" referrerpolicy="no-referrer" />
              {:else}
                <div class="helmet helmet-placeholder">{s.school[0] ?? '?'}</div>
              {/if}
            </div>
            <div class="school-name">{s.school}</div>
            <div class="school-pct">
              <span class="pct-big">{(s.normalized ?? 0).toFixed(1)}<small>%</small></span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Controls. Branch precedence matters:
         1. Phase-2 ready (contested auto-commit) — show the second Roll
            button even if a previous saved result exists, otherwise the
            "Already rolled" branch would steal this state.
         2. Already rolled (any other type) — saved-result note + Next.
         3. Roll / Reveal Auto-Commits button (waiting on first click).
         4. Final reveal — Next Recruit. -->
    <div class="controls">
      {#if rollState === 'idle' && acPhase === 'phase2_ready'}
        <button class="tp-pill tp-pill-gold tp-pill-big roll-btn" onclick={performAcPhase2Roll}>
          Roll
        </button>
      {:else if previouslyRolled && rollState === 'idle' && acPhase === 'off'}
        <div class="prev-note">
          Already rolled · saved result
          <b>{previouslyRolled === 'LOCKED' ? 'Locked' : previouslyRolled}</b>
        </div>
        <div class="control-row">
          <button class="tp-pill" onclick={returnToList}>← Return to List</button>
          <button class="tp-pill tp-pill-gold" onclick={goToNextRecruit}>Next Recruit →</button>
        </div>
      {:else if rollState === 'idle' && acPhase === 'off'}
        {#if !isSolo(currentEvent)}
          <button class="tp-pill tp-pill-gold tp-pill-big roll-btn" onclick={() => performRoll()}>
            {currentEvent.kind === 'auto' ? 'Reveal Auto-Commits' : 'Roll'}
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
{:else if currentConf && !editOpen && !editSaving}
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

<!-- Confetti overlay — always mounted, visible during confetti+cooling phases -->
<canvas
  bind:this={confettiCanvas}
  class="confetti-canvas"
  class:active={rollState === 'exploding' || upsetPhase === 'confetti' || upsetPhase === 'cooling'}
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
      radial-gradient(ellipse at top,
        rgba(199, 50, 56, 0.55) 0%,
        rgba(184, 37, 44, 0.55) 60%,
        rgba(140, 27, 34, 0.7) 100%),
      #1a0608;
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
      radial-gradient(ellipse at top,
        rgba(199, 50, 56, 0.55) 0%,
        rgba(184, 37, 44, 0.55) 55%,
        rgba(140, 27, 34, 0.7) 100%),
      #1a0608;
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
      radial-gradient(ellipse at top,
        rgba(199, 50, 56, 0.55) 0%,
        rgba(184, 37, 44, 0.55) 55%,
        rgba(140, 27, 34, 0.7) 100%),
      #1a0608;
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
    z-index: 4; /* above darken overlay */
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

  .event-head { position: relative; text-align: center; margin-bottom: 32px; z-index: 4; }
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

  /* ============================================================
     Rubber-stamp (rect-stamp) — black ink rectangle, drops in.
     Used for player-name reveals (STOLEN / LOYAL) and the small
     LOCKED card stamp.
     ============================================================ */
  .rect-stamp {
    --stamp-ink: #111111;
    --rot: -7deg;
    position: absolute;
    top: 58%;
    right: -60px;
    transform: translateY(-50%) rotate(-7deg);
    color: var(--stamp-ink);
    opacity: 0;
    pointer-events: none;
    z-index: 5;
  }
  .rect-stamp-inner {
    border: 8px solid currentColor;
    outline: 2px solid currentColor;
    outline-offset: 4px;
    padding: 14px 28px;
    text-align: center;
    position: relative;
    background: rgba(244, 220, 160, 0.22);
    box-shadow:
      inset 0 0 0 3px currentColor,
      0 4px 24px rgba(0, 0, 0, 0.45);
  }
  .rect-stamp .stamp-label {
    font-family: 'Bebas Neue', 'Oswald', sans-serif;
    font-size: 4.8rem;
    letter-spacing: 12px;
    line-height: 1;
    display: block;
    color: currentColor;
    text-transform: uppercase;
    -webkit-text-stroke: 2px currentColor;
    paint-order: stroke fill;
    text-shadow:
      3px  3px 0 currentColor,
      -1px -1px 0 currentColor,
      0 0 18px rgba(0, 0, 0, 0.2);
  }
  .rect-stamp .stamp-sub {
    font-family: 'Courier Prime', ui-monospace, monospace;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 4px;
    display: block;
    margin-top: 8px;
    border-top: 3px solid currentColor;
    padding-top: 6px;
    opacity: 0.85;
    color: currentColor;
    text-transform: uppercase;
  }
  /* Variant on player name: uses the base positioning
     (top: 58%, right: -60px, rotate(-7deg)) — overhangs the right edge. */
  .rect-stamp.player-stamp { /* inherits base */ }
  /* Variant on a school card: centered, sized down. Overrides the
     right-anchored base so it sits on top of the helmet. */
  .rect-stamp.card-stamp {
    top: 50%;
    right: auto;
    left: 50%;
    transform: translate(-50%, -50%) rotate(var(--rot));
  }
  .rect-stamp.card-stamp .rect-stamp-inner { padding: 6px 10px; }
  .rect-stamp.card-stamp .stamp-label { font-size: 1.4rem; letter-spacing: 4px; }
  .rect-stamp.card-stamp .stamp-sub  { font-size: 0.45rem; letter-spacing: 1.5px; margin-top: 3px; padding-top: 3px; }

  /* Drop-in animation. Keyframes use var(--rot) so the resting angle is
     always preserved regardless of scale phase. Player-stamp variant is
     anchored via right: -60px / top: 58% so only vertical centering is
     needed via translateY(-50%). */
  @keyframes stampDown {
    0% {
      transform: translateY(-50%) scale(2.8) rotate(var(--rot));
      opacity: 0;
      filter: blur(6px);
    }
    55% {
      transform: translateY(-50%) scale(0.90) rotate(var(--rot));
      opacity: 1;
      filter: blur(0);
    }
    72% {
      transform: translateY(-50%) scale(1.06) rotate(var(--rot));
    }
    100% {
      transform: translateY(-50%) scale(1) rotate(var(--rot));
      opacity: 1;
    }
  }
  @keyframes stampDownCenter {
    0% {
      transform: translate(-50%, -50%) scale(2.8) rotate(var(--rot));
      opacity: 0;
      filter: blur(6px);
    }
    55% {
      transform: translate(-50%, -50%) scale(0.90) rotate(var(--rot));
      opacity: 1;
      filter: blur(0);
    }
    72% {
      transform: translate(-50%, -50%) scale(1.06) rotate(var(--rot));
    }
    100% {
      transform: translate(-50%, -50%) scale(1) rotate(var(--rot));
      opacity: 1;
    }
  }
  .rect-stamp.player-stamp.animate {
    animation: stampDown 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .rect-stamp.card-stamp.animate {
    animation: stampDownCenter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

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

  .spinner-stage {
    position: relative;
    text-align: center;
    margin: 56px 0;
    z-index: 3; /* above the darken overlay */
  }
  .spinner-img {
    width: 260px; height: 260px; object-fit: contain;
    will-change: transform, filter;
    /* JS spin loop publishes the current rotation as --spin-deg; the phase
       classes below (.upset-in, .upset-explode) override `transform`
       entirely when they need to drive scale + opacity. No inline
       style.transform writes — keeps the cascade predictable. */
    transform: rotate(var(--spin-deg, 0deg));
  }
  /* Fallback (no placeholder helmet uploaded) uses CSS-only rotation. */
  .spinner-img.rotating {
    animation: spin 0.55s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* ---- Upset phases — driven by class on the spinner img ---- */
  /* in: helmet springs in from scale 0 */
  @keyframes helmet-spring-in {
    0%   { transform: scale(0);    opacity: 0; }
    60%  { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  .spinner-img.upset-in {
    animation: helmet-spring-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  /* pulse: slow team-color glow (idle hum) */
  @keyframes glowPulse {
    0%, 100% {
      filter:
        drop-shadow(0 0 5px var(--glow-1, var(--tp-navy)))
        drop-shadow(0 0 14px var(--glow-2, var(--tp-gold)));
    }
    50% {
      filter:
        drop-shadow(0 0 18px var(--glow-1, var(--tp-navy)))
        drop-shadow(0 0 40px var(--glow-2, var(--tp-gold)))
        drop-shadow(0 0 62px rgba(244, 236, 221, 0.4));
    }
  }
  .spinner-img.upset-pulse {
    animation: glowPulse 2.6s ease-in-out infinite;
  }

  /* stop_glow: fast intense team-color glow (charging up) */
  @keyframes glowCharge {
    0%, 100% {
      filter:
        drop-shadow(0 0 10px var(--glow-2, var(--tp-gold)))
        drop-shadow(0 0 28px var(--glow-1, var(--tp-navy)))
        drop-shadow(0 0 55px var(--glow-2, var(--tp-gold)));
    }
    50% {
      filter:
        drop-shadow(0 0 28px var(--glow-2, var(--tp-gold)))
        drop-shadow(0 0 60px var(--glow-1, var(--tp-navy)))
        drop-shadow(0 0 90px rgba(244, 236, 221, 0.55));
    }
  }
  .spinner-img.upset-stop-glow {
    animation: glowCharge 1.1s ease-in-out infinite;
  }

  /* explode: helmet scales up and fades out. Inline transform is cleared
     by the $effect at this phase so this rule wins. */
  .spinner-img.upset-explode {
    transform: scale(1.6);
    opacity: 0;
    transition: transform 0.28s ease-in, opacity 0.22s ease-in;
  }

  .upset-charge-label {
    color: var(--tp-cream);
    font-family: var(--tp-display);
    font-size: 24px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    animation: glowPulse 1.1s ease-in-out infinite;
  }

  /* Darken overlay — sits between theater backdrop and the helmet/UI. */
  .darken-overlay {
    position: absolute;
    inset: 0;
    background: #000;
    opacity: 0;
    z-index: 1;
    transition: opacity 0.7s ease;
    pointer-events: none;
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
  /* (locked-wrap rule retired — the locked reveal renders inside the schools
     grid now, not as a separate winner-card.) */
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

  /* Locked steal — schools view augmented with bars + LOCKED rect-stamp */
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
  .pct-big.dropping {
    color: var(--tp-oxblood);
    font-variant-numeric: tabular-nums;
  }

  /* ============================================================
     Auto-Commit reveal flow
     ============================================================ */
  .megaphone-burst {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
    overflow: visible;
    z-index: 9;
  }
  .megaphone {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 40px;
    line-height: 1;
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, -50%);
    animation:
      megaphone-burst var(--m-duration, 1000ms) var(--m-delay, 0ms) ease-out forwards;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
  }
  @keyframes megaphone-burst {
    0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
    20%  { transform: translate(-50%, -50%) scale(1.25); opacity: 1; }
    100% {
      transform: translate(calc(-50% + var(--m-dx)), calc(-50% + var(--m-dy))) scale(0.55) rotate(40deg);
      opacity: 0;
    }
  }
  .school-card.ac-bidder {
    /* Brief gold ring while the burst is firing */
    box-shadow: 0 0 0 3px var(--tp-gold), 0 6px 0 rgba(0, 0, 0, 0.3);
  }
  .school-card.ac-fading {
    animation: ac-card-fade 0.6s ease-out forwards;
  }
  @keyframes ac-card-fade {
    0%   { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.9) translateY(14px); }
  }
  .ac-solo-line {
    margin-top: 18px;
    font-family: var(--tp-body);
    font-size: clamp(18px, 2.4vw, 26px);
    color: var(--tp-cream);
    font-style: italic;
    text-align: center;
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
    text-shadow: 0 1px 0 var(--tp-navy-dark);
  }
  .ac-solo-line strong {
    font-style: normal;
    font-family: var(--tp-display-condensed);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--tp-gold-soft);
  }
  .ac-phase2-head {
    text-align: center;
    margin: 8px 0 24px;
  }
  .ac-phase2-eyebrow {
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: var(--tp-gold-soft);
    margin-bottom: 8px;
  }
  .ac-phase2-title {
    font-family: var(--tp-display);
    font-size: clamp(28px, 4vw, 48px);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1;
    margin: 0;
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
