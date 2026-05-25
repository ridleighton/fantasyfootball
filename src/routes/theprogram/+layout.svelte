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
    /* Primary chrome */
    --tp-navy: #B8252C;       /* repurposed token: crimson */
    --tp-navy-2: #C73238;     /* lighter crimson */
    --tp-navy-dark: #8C1B22;  /* deeper crimson */
    /* Surfaces */
    --tp-cream: #F4ECDD;
    --tp-cream-2: #EBE0CB;
    --tp-cream-3: #DDD0B4;
    /* Accent */
    --tp-gold: #D9A441;
    --tp-gold-2: #B98624;
    --tp-gold-soft: #ECC880;
    /* Pewter (chrome bevel from the logo) */
    --tp-pewter: #BFB8AD;
    --tp-pewter-2: #8F8979;
    /* Warning / oxblood */
    --tp-oxblood: #7A1F2B;
    --tp-oxblood-soft: #A03A47;
    /* Ink */
    --tp-ink: #2B1815;
    --tp-ink-soft: #5B3F38;
    --tp-muted: #7A6A55;
    /* Rules */
    --tp-rule: rgba(184, 37, 44, 0.28);
    --tp-rule-soft: rgba(184, 37, 44, 0.12);

    --tp-display: 'Alfa Slab One', 'Oswald', 'Bebas Neue', 'Impact', serif;
    --tp-display-condensed: 'Oswald', 'Bebas Neue', 'Impact', sans-serif;
    --tp-body: 'Lora', 'Caslon', Georgia, 'Times New Roman', serif;

    min-height: 100vh;
    background: var(--tp-cream);
    color: var(--tp-ink);
    font-family: var(--tp-body);
    font-feature-settings: 'onum' 1, 'liga' 1, 'kern' 1;
  }

  .tp-app :global(*) { box-sizing: border-box; }

  /* Headings — keep specificity at 0 so per-page color wins */
  .tp-app :global(:where(h1, h2, h3)) {
    font-family: var(--tp-display-condensed);
    color: var(--tp-navy);
    letter-spacing: 0.02em;
    margin: 0;
  }

  /* Stamps — week numbers, conference badges */
  .tp-app :global(.tp-stamp) {
    font-family: var(--tp-display-condensed);
    font-weight: 700;
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

  /* Three-layer "stamped" display treatment (crimson fill, gold outline,
     pewter outer trim). Use for hero headlines on cream backdrops. */
  .tp-app :global(.tp-stamped) {
    color: var(--tp-navy);
    text-shadow:
      -1px -1px 0 var(--tp-gold),
       1px -1px 0 var(--tp-gold),
      -1px  1px 0 var(--tp-gold),
       1px  1px 0 var(--tp-gold),
      -2px -2px 0 var(--tp-pewter),
       2px -2px 0 var(--tp-pewter),
      -2px  2px 0 var(--tp-pewter),
       2px  2px 0 var(--tp-pewter),
       0  4px 0 var(--tp-pewter-2),
       0  6px 0 rgba(0, 0, 0, 0.18);
  }
  /* Cream-fill variant for crimson backdrops */
  .tp-app :global(.tp-stamped-cream) {
    color: var(--tp-cream);
    text-shadow:
      -1px -1px 0 var(--tp-gold),
       1px -1px 0 var(--tp-gold),
      -1px  1px 0 var(--tp-gold),
       1px  1px 0 var(--tp-gold),
      -2px -2px 0 var(--tp-pewter),
       2px -2px 0 var(--tp-pewter),
      -2px  2px 0 var(--tp-pewter),
       2px  2px 0 var(--tp-pewter),
       0  4px 0 var(--tp-navy-dark),
       0  8px 24px rgba(0, 0, 0, 0.45);
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
    border-radius: 2px;
    text-decoration: none;
    color: var(--tp-cream);
    font-family: var(--tp-display-condensed);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    border-bottom: 2px solid transparent;
    transition: border-color 0.12s ease, color 0.12s ease;
  }
  .tp-nav-link:hover { color: var(--tp-gold-soft); }
  .tp-nav-link.active {
    color: var(--tp-cream);
    border-bottom-color: var(--tp-gold);
  }
  .tp-nav-rule {
    height: 4px;
    background:
      linear-gradient(
        90deg,
        var(--tp-gold) 0,
        var(--tp-gold) 33.333%,
        var(--tp-cream) 33.333%,
        var(--tp-cream) 66.666%,
        var(--tp-gold) 66.666%,
        var(--tp-gold) 100%
      );
  }

  .tp-main { width: 100%; }
</style>
