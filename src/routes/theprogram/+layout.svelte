<script>
  import { page } from '$app/stores';
  let { data, children } = $props();

  const showNav = $derived($page.route.id !== '/theprogram');

  const navItems = [
    { href: '/theprogram/show', label: 'The Show' },
    { href: '/theprogram/commish', label: 'Commish View' },
    { href: '/theprogram/config', label: 'Config' }
  ];
</script>

<svelte:head>
  <title>The Program · down bad ↓</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Alfa+Slab+One&family=Bebas+Neue&family=Courier+Prime:wght@400;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="tp-app">
  {#if showNav}
    <nav class="tp-nav">
      <div class="tp-nav-inner">
        <a href="/theprogram/" class="tp-brand" aria-label="The Program">
          {#if data?.tpLogoUrl}
            <img src={data.tpLogoUrl} alt="The Program" class="tp-brand-logo" referrerpolicy="no-referrer" />
          {:else}
            <span class="tp-brand-text">
              <span class="tp-brand-the">The</span>
              <span class="tp-brand-program">Program</span>
            </span>
          {/if}
        </a>
        <div class="tp-nav-links">
          {#each navItems as item}
            <a
              href={item.href}
              class="tp-nav-link"
              class:active={$page.url.pathname.startsWith(item.href)}
            >{item.label}</a>
          {/each}
        </div>
      </div>
      <div class="tp-nav-rule" aria-hidden="true"></div>
    </nav>
  {/if}

  <main class="tp-main">
    {@render children()}
  </main>
</div>

<style>
  /* ============================================================
     Vintage Varsity — Crimson (pulled from the logo)
     ============================================================ */
  .tp-app {
    /* ============================================================
       Vintage Varsity — Crimson on Cream (canonical guideline)
       Token names kept for backwards compatibility; values updated to
       match the canonical guideline:
         --tp-navy        ==> spec --crimson
         --tp-navy-dark   ==> spec --crimson-ink
         --tp-cream       ==> spec --cream
         --tp-cream-2     ==> spec --cream-sunk
         --tp-oxblood     ==> spec --oxblood (button resting state)
       ============================================================ */
    /* Crimson (repurposed --tp-navy) */
    --tp-navy: #B8252C;       /* spec: --crimson */
    --tp-navy-2: #C73238;     /* lighter crimson (hover) */
    --tp-navy-dark: #7A1820;  /* spec: --crimson-ink — body, helmet outlines */
    /* Surfaces */
    --tp-cream: #EFE5D0;      /* spec: --cream — primary surface */
    --tp-cream-2: #E5DBC4;    /* spec: --cream-sunk — table stripes, sunken cards */
    --tp-cream-3: #DDD0B4;    /* (legacy) deeper cream tier */
    --tp-frame: #D8D3C7;      /* spec: --frame — browser/outer chrome */
    /* Accent — gold is the "earned" color */
    --tp-gold: #D9A441;
    --tp-gold-2: #B98624;
    --tp-gold-soft: #ECC880;
    /* Pewter — outer trim, resting button border, disabled states */
    --tp-pewter: #BFB8AD;
    --tp-pewter-2: #8F8979;
    /* Oxblood — resting state for primary buttons (per spec) */
    --tp-oxblood: #4A0F14;
    --tp-oxblood-soft: #A03A47;
    /* Ink */
    --tp-ink: #2B1815;
    --tp-ink-soft: #5B3F38;
    --tp-muted: #5A4A35;
    /* Rules */
    --tp-rule: rgba(184, 37, 44, 0.28);
    --tp-rule-soft: rgba(184, 37, 44, 0.12);

    --tp-display: 'Alfa Slab One', 'Oswald', 'Bebas Neue', 'Impact', serif;
    --tp-display-condensed: 'Oswald', 'Bebas Neue', 'Impact', sans-serif;
    --tp-body: 'Lora', 'Caslon', Georgia, 'Times New Roman', serif;

    /* Full-bleed backdrop — cream per the canonical guideline.
       The drama on every page comes from the contrast between the
       cream-dominant layout and the eventual gold reveal, not from
       a dark theatrical backdrop. */
    --tp-stage-bg: var(--tp-cream);

    min-height: 100vh;
    background: var(--tp-cream);
    color: var(--tp-ink);
    font-family: var(--tp-body);
    font-feature-settings: 'onum' 1, 'liga' 1, 'kern' 1;
  }

  /* ============================================================
     Show theme on the wheat backdrop.
     Cards (school / winner / recruit / stage) take the SAME crimson
     as the player-name stamp. Text inside cards is cream.
     Floating prose on the backdrop becomes crimson so it reads on
     the wheat field.
     ============================================================ */
  /* Reveal cards (school / winner / recruit) match the player-name's
     crimson with cream text. Stage + entry cards keep their cream
     surface — they host forms and need contrast for inputs. */
  .tp-app :global(.school-card),
  .tp-app :global(.winner-card),
  .tp-app :global(.recruit-card) {
    background: var(--tp-cream);
    color: var(--tp-navy-dark);
    border-color: var(--tp-navy);
  }
  .tp-app :global(.school-name),
  .tp-app :global(.pct-big),
  .tp-app :global(.recruit-player),
  .tp-app :global(.recruit-num) {
    color: var(--tp-navy-dark);
  }
  .tp-app :global(.helmet-placeholder) {
    background: transparent;
    color: var(--tp-muted);
  }
  /* Player-name + winner-name + launcher headlines: solid crimson on
     the wheat backdrop. Drop the gold + pewter outline stack — wheat
     is a calm field, no metal trim is needed for separation. Keep a
     darker crimson under-rule and a soft cast shadow for depth. */
  .tp-app :global(.tp-stamped-cream) {
    color: var(--tp-navy);
    text-shadow:
      0 2px 0 var(--tp-navy-dark),
      0 6px 18px rgba(0, 0, 0, 0.18);
  }
  /* Floating prose on the wheat backdrop. Crimson (#B8252C) is only
     4.1:1 on wheat — passes 3:1 large-text but fails 4.5:1 body.
     Switched body-weight prose to navy-dark (#8C1B22) which is ~7:1.
     Bold school names go navy-dark too (gold/gold-2 vanished on wheat
     at 1.5–2.9:1). */
  .tp-app :global(.spinner-label),
  .tp-app :global(.steal-message),
  .tp-app :global(.ac-solo-line),
  .tp-app :global(.ac-phase2-prompt),
  .tp-app :global(.stage-sub),
  .tp-app :global(.launcher-sub),
  .tp-app :global(.prev-note) {
    color: var(--tp-navy-dark);
    text-shadow: none;
  }
  .tp-app :global(.steal-message strong),
  .tp-app :global(.ac-solo-line strong) {
    color: var(--tp-navy-dark);
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }
  .tp-app :global(.recruit-status.pending) {
    color: var(--tp-navy-dark);
  }
  /* Secondary pills in the control row — solid crimson fill with cream
     text so they sit beside gold pills as a clear red/gold pair. */
  .tp-app :global(.control-row .tp-pill:not(.tp-pill-gold)) {
    background: var(--tp-navy);
    color: var(--tp-cream);
    border-color: var(--tp-navy-dark);
  }
  .tp-app :global(.control-row .tp-pill:not(.tp-pill-gold):hover:not(:disabled)) {
    background: var(--tp-navy-2);
  }
  /* Edit modal sits crimson so it stays prominent on the wheat field. */
  .tp-app :global(.edit-modal) {
    background: var(--tp-navy);
    color: var(--tp-cream);
  }
  .tp-app :global(.edit-title) { color: var(--tp-cream); }
  .tp-app :global(.edit-eyebrow) { color: var(--tp-gold-soft); }

  .tp-app :global(*) { box-sizing: border-box; }

  /* Visually-hidden utility for screen-reader-only content. */
  .tp-app :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ============================================================
     prefers-reduced-motion: cancel the heaviest animations.
     The CSS-driven animations (helmet spin, slam keyframes, megaphone
     burst, locked-pulse, ring-pulse, bars-drop, scale-in, fade
     transitions) all collapse to instant for users who request less
     motion. The JS-driven RAF loops (spin loop deceleration, confetti
     burst, megaphone particles) gate themselves via the matchMedia
     query in performRoll / spawnMegaphoneParticles / startSpinLoop.
     ============================================================ */
  @media (prefers-reduced-motion: reduce) {
    .tp-app :global(*),
    .tp-app :global(*::before),
    .tp-app :global(*::after) {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Headings — keep specificity at 0 so per-page color wins */
  .tp-app :global(:where(h1, h2, h3)) {
    font-family: var(--tp-display-condensed);
    color: var(--tp-navy);
    letter-spacing: 0.02em;
    margin: 0;
  }

  /* Stamps — week numbers, conference badges. Sized to qualify as
     "large bold text" (≥14px / 700) so the navy-dark-on-gold variant
     passes WCAG 3:1 large-text contrast. */
  .tp-app :global(.tp-stamp) {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    display: inline-block;
    padding: 4px 12px;
    background: var(--tp-navy);
    color: var(--tp-cream);
    border-radius: 2px;
  }
  .tp-app :global(.tp-stamp-gold) {
    background: var(--tp-gold);
    color: var(--tp-navy-dark);
  }
  .tp-app :global(.tp-stamp-oxblood) {
    background: var(--tp-oxblood);
    color: var(--tp-cream);
  }

  /* Section divider with centered ornament */
  .tp-app :global(.tp-divider) {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 28px 0;
    color: var(--tp-rule);
  }
  .tp-app :global(.tp-divider::before),
  .tp-app :global(.tp-divider::after) {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--tp-rule);
  }
  .tp-app :global(.tp-divider-ornament) {
    color: var(--tp-gold);
    font-size: 14px;
    letter-spacing: 0.4em;
  }

  /* "Small word + big word" stacked head (THE • PROGRAM rhythm).
     Usage:
       <h1 class="tp-stack-head">
         <span class="tp-stack-small">The</span>
         <span class="tp-stack-big">Draft Board</span>
       </h1>
  */
  .tp-app :global(.tp-stack-head) {
    display: inline-flex;
    align-items: baseline;
    gap: 10px;
  }
  .tp-app :global(.tp-stack-small) {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 0.3em;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-gold);
    transform: translateY(-0.25em);
  }
  .tp-app :global(.tp-stack-big) {
    font-family: var(--tp-display);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1;
  }

  /* Crimson-fill "stamped" display treatment for hero headlines on cream
     backdrops. Outline layers stripped — keep only a deeper-crimson under-
     rule so the H1 reads as mainly crimson. */
  .tp-app :global(.tp-stamped) {
    color: var(--tp-navy);
    text-shadow:
       0  4px 0 var(--tp-navy-dark),
       0  6px 0 rgba(0, 0, 0, 0.18);
  }

  /* Pill buttons */
  .tp-app :global(.tp-pill) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 28px;
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    text-decoration: none;
    border-radius: 999px;
    cursor: pointer;
    border: 1.5px solid var(--tp-navy);
    background: var(--tp-cream);
    color: var(--tp-navy);
    transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease;
  }
  .tp-app :global(.tp-pill:hover:not(:disabled)) {
    background: var(--tp-cream-2);
    box-shadow: 0 2px 0 var(--tp-navy);
    transform: translateY(-1px);
  }
  .tp-app :global(.tp-pill:disabled) { opacity: 0.45; cursor: not-allowed; }

  .tp-app :global(.tp-pill-gold) {
    background: var(--tp-gold);
    border-color: var(--tp-gold-2);
    color: var(--tp-navy-dark);
    box-shadow: inset 0 -2px 0 var(--tp-gold-2);
  }
  .tp-app :global(.tp-pill-gold:hover:not(:disabled)) {
    background: var(--tp-gold-soft);
    box-shadow: 0 3px 0 var(--tp-gold-2), inset 0 -2px 0 var(--tp-gold-2);
  }
  .tp-app :global(.tp-pill-navy) {
    background: var(--tp-navy);
    color: var(--tp-cream);
    border-color: var(--tp-navy-dark);
  }
  .tp-app :global(.tp-pill-navy:hover:not(:disabled)) {
    background: var(--tp-navy-2);
  }
  .tp-app :global(.tp-pill-small) {
    padding: 8px 16px;
    font-size: 12px;
  }

  /* Cream card with letterpress edge */
  .tp-app :global(.tp-card) {
    background: var(--tp-cream);
    border: 1px solid var(--tp-rule);
    border-radius: 6px;
    box-shadow:
      inset 0 0 0 1px rgba(244, 236, 221, 0.9),
      0 1px 0 rgba(184, 37, 44, 0.06);
  }

  /* Form fields with notebook feel */
  .tp-app :global(.tp-field) {
    display: block;
    width: 100%;
    padding: 10px 12px;
    background: rgba(244, 236, 221, 0.5);
    border: 1px solid var(--tp-rule);
    border-radius: 4px;
    color: var(--tp-ink);
    font-family: var(--tp-body);
    font-size: 15px;
  }
  .tp-app :global(.tp-field:focus) {
    outline: none;
    border-color: var(--tp-gold-2);
    box-shadow: 0 0 0 3px rgba(217, 164, 65, 0.3);
    background: var(--tp-cream);
  }
  .tp-app :global(.tp-label) {
    display: block;
    font-family: var(--tp-display-condensed);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--tp-muted);
    margin-bottom: 6px;
  }

  .tp-app :global(.tp-alert) {
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 14px;
    margin-bottom: 16px;
    font-family: var(--tp-body);
  }
  .tp-app :global(.tp-alert-error) {
    background: rgba(122, 31, 43, 0.08);
    border: 1px solid var(--tp-oxblood);
    color: var(--tp-oxblood);
  }
  .tp-app :global(.tp-alert-ok) {
    background: rgba(217, 164, 65, 0.14);
    border: 1px solid var(--tp-gold-2);
    color: var(--tp-navy-dark);
  }

  /* ============================================================
     Nav
     ============================================================ */
  .tp-nav {
    background: var(--tp-navy);
    color: var(--tp-cream);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .tp-nav-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 14px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .tp-brand {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    color: var(--tp-cream);
    gap: 12px;
  }
  .tp-brand-logo {
    height: 40px;
    width: auto;
    display: block;
  }
  .tp-brand-text {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    line-height: 1;
  }
  .tp-brand-the {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--tp-gold);
  }
  .tp-brand-program {
    font-family: var(--tp-display);
    font-size: 22px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tp-cream);
  }
  .tp-nav-links { display: flex; gap: 6px; }
  .tp-nav-link {
    padding: 8px 16px;
    text-decoration: none;
    color: var(--tp-cream);
    opacity: 0.65;
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transition: opacity 0.12s ease, color 0.12s ease;
  }
  .tp-nav-link:hover { opacity: 1; }
  .tp-nav-link.active {
    color: var(--tp-gold);
    opacity: 1;
  }
  /* Spec: solid 2–3px gold rule under the top bar. No gradients. */
  .tp-nav-rule {
    height: 3px;
    background: var(--tp-gold);
  }

  .tp-main { width: 100%; }
</style>
