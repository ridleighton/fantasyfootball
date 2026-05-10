/**
 * down bad — ghost mascots
 * Pure SVG + CSS animation characters. Each returns an HTML string
 * or can be used with a container element.
 */

const GHOST_PATH = "M 100 12 C 50 12, 28 52, 28 100 L 28 200 Q 28 218, 42 218 Q 56 218, 60 206 Q 64 218, 80 218 Q 96 218, 100 206 Q 104 218, 120 218 Q 136 218, 140 206 Q 144 218, 158 218 Q 172 218, 172 200 L 172 100 C 172 52, 150 12, 100 12 Z";

const Mascots = {

  /* ----------------------------------------------------------
     QB Ghost — winds up & throws a football in a loop
  ---------------------------------------------------------- */
  qb(size = 180) {
    const h = Math.round(size * 1.2);
    return `
      <div class="db-mascot" style="width:${size}px;height:${h}px">
        <div class="db-mascot-stage">
          <div class="db-football-fly" aria-hidden="true">
            <svg viewBox="0 0 40 24" width="32" height="20">
              <ellipse cx="20" cy="12" rx="18" ry="9" fill="#7a3a1f" stroke="#3a1810" stroke-width="1"/>
              <path d="M 8 12 H 32" stroke="#fff" stroke-width="1.4"/>
              <path d="M 12 9 v 6 M 16 9 v 6 M 20 9 v 6 M 24 9 v 6 M 28 9 v 6" stroke="#fff" stroke-width="1"/>
            </svg>
          </div>
          <div class="db-ghost-bob db-throw-rotate">
            <svg viewBox="0 0 200 240" width="100%" height="100%" style="overflow:visible">
              <defs>
                <radialGradient id="qbShade" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.4"/>
                  <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <path d="${GHOST_PATH}" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
              <path d="${GHOST_PATH}" fill="url(#qbShade)"/>
              <!-- eyes -->
              <ellipse class="db-ghost-eye" cx="84" cy="108" rx="6" ry="8" fill="#1a1124"/>
              <ellipse class="db-ghost-eye" cx="122" cy="108" rx="6" ry="8" fill="#1a1124" style="animation-delay:0.1s"/>
              <!-- blush -->
              <ellipse cx="70"  cy="138" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <ellipse cx="134" cy="138" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <!-- smile -->
              <path d="M 92 146 Q 100 154 108 146" fill="none" stroke="#1a1124" stroke-width="2.4" stroke-linecap="round"/>
              <!-- throwing arm -->
              <g class="db-throw-arm">
                <ellipse cx="170" cy="80" rx="14" ry="11" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5" transform="rotate(-30 170 80)"/>
              </g>
              <!-- support arm -->
              <ellipse cx="38" cy="160" rx="12" ry="9" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
            </svg>
          </div>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Dizzy Ghost — the page loader. Spins, eyes swirl, tongue out
  ---------------------------------------------------------- */
  dizzy(size = 140) {
    const h = Math.round(size * 1.2);
    return `
      <div class="db-mascot db-spinner" style="width:${size}px;height:${h}px">
        <div class="db-mascot-stage">
          <div class="db-orbit">
            <span class="db-orbit-star" style="--i:0">★</span>
            <span class="db-orbit-star" style="--i:1">★</span>
            <span class="db-orbit-star" style="--i:2">★</span>
          </div>
          <div class="db-spin-body">
            <svg viewBox="0 0 200 240" width="100%" height="100%" style="overflow:visible">
              <defs>
                <radialGradient id="dizzyShade" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.4"/>
                  <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <path d="${GHOST_PATH}" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
              <path d="${GHOST_PATH}" fill="url(#dizzyShade)"/>
              <!-- dizzy swirl eyes -->
              <g style="transform-origin:78px 108px;animation:db-dizzy-spin 1.6s linear infinite">
                <path d="M 71 108 a 7 7 0 1 1 0 0.1 M 74 108 a 4 4 0 1 0 0 0.1"
                  fill="none" stroke="#1a1124" stroke-width="2" stroke-linecap="round"/>
              </g>
              <g style="transform-origin:122px 108px;animation:db-dizzy-spin 1.6s linear 0.3s infinite">
                <path d="M 115 108 a 7 7 0 1 1 0 0.1 M 118 108 a 4 4 0 1 0 0 0.1"
                  fill="none" stroke="#1a1124" stroke-width="2" stroke-linecap="round"/>
              </g>
              <!-- blush -->
              <ellipse cx="66"  cy="138" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <ellipse cx="134" cy="138" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <!-- wobbly mouth -->
              <path d="M 86 148 Q 92 156 100 148 Q 108 140 114 148"
                fill="none" stroke="#1a1124" stroke-width="2.4" stroke-linecap="round"/>
              <!-- tongue -->
              <ellipse cx="100" cy="156" rx="3.5" ry="5" fill="#ff7aa6"/>
            </svg>
          </div>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Referee Ghost — zebra sash, whistle, flag wave
  ---------------------------------------------------------- */
  ref(size = 180) {
    const h = Math.round(size * 1.2);
    return `
      <div class="db-mascot" style="width:${size}px;height:${h}px">
        <div class="db-mascot-stage">
          <div class="db-ghost-bob">
            <svg viewBox="0 0 200 240" width="100%" height="100%" style="overflow:visible">
              <defs>
                <radialGradient id="refShade" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.4"/>
                  <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
                </radialGradient>
                <clipPath id="refClip"><path d="${GHOST_PATH}"/></clipPath>
              </defs>
              <path d="${GHOST_PATH}" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
              <!-- zebra stripes clipped to ghost -->
              <g clip-path="url(#refClip)">
                <rect x="36" y="158" width="128" height="22" fill="#fff"/>
                <rect x="36"  y="158" width="16" height="22" fill="#1a1124"/>
                <rect x="68"  y="158" width="16" height="22" fill="#1a1124"/>
                <rect x="100" y="158" width="16" height="22" fill="#1a1124"/>
                <rect x="132" y="158" width="16" height="22" fill="#1a1124"/>
              </g>
              <path d="${GHOST_PATH}" fill="url(#refShade)"/>
              <ellipse class="db-ghost-eye" cx="84"  cy="108" rx="6" ry="8" fill="#1a1124"/>
              <ellipse class="db-ghost-eye" cx="116" cy="108" rx="6" ry="8" fill="#1a1124" style="animation-delay:0.1s"/>
              <ellipse cx="70"  cy="134" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <ellipse cx="130" cy="134" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <!-- whistle -->
              <ellipse cx="100" cy="146" rx="6" ry="4" fill="#1a1124"/>
              <rect x="106" y="143" width="14" height="6" rx="2" fill="#c0c0c0" stroke="#1a1124" stroke-width="1"/>
              <circle cx="118" cy="146" r="2" fill="#1a1124"/>
              <!-- yellow flag -->
              <g class="db-flag" style="transform-origin:30px 180px">
                <line x1="30" y1="180" x2="14" y2="120" stroke="#1a1124" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M 14 120 Q 30 116 36 130 Q 22 134 14 120 Z" fill="#ffd24a" stroke="#c89517" stroke-width="1.2"/>
              </g>
            </svg>
          </div>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Trophy Ghost — winner of the week, big grin
  ---------------------------------------------------------- */
  trophy(size = 180) {
    const h = Math.round(size * 1.2);
    return `
      <div class="db-mascot" style="width:${size}px;height:${h}px">
        <div class="db-mascot-stage">
          <span class="db-sparkle" style="left:20%;top:20%;animation-delay:0s">✦</span>
          <span class="db-sparkle" style="left:78%;top:26%;animation-delay:0.5s">✦</span>
          <span class="db-sparkle" style="left:30%;top:60%;animation-delay:1s">✦</span>
          <div class="db-ghost-bob">
            <svg viewBox="0 0 200 240" width="100%" height="100%" style="overflow:visible">
              <defs>
                <radialGradient id="trophyShade" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.4"/>
                  <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <path d="${GHOST_PATH}" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
              <path d="${GHOST_PATH}" fill="url(#trophyShade)"/>
              <!-- squint eyes (happy) -->
              <path d="M 78 108 Q 84 100 90 108" fill="none" stroke="#1a1124" stroke-width="2.4" stroke-linecap="round"/>
              <path d="M 110 108 Q 116 100 122 108" fill="none" stroke="#1a1124" stroke-width="2.4" stroke-linecap="round"/>
              <ellipse cx="66"  cy="138" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <ellipse cx="134" cy="138" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <!-- big smile + tooth -->
              <path d="M 78 144 Q 100 168 122 144 Q 100 154 78 144 Z" fill="#3a0d22"/>
              <rect x="96" y="148" width="8" height="6" fill="#fff"/>
              <!-- trophy -->
              <g transform="translate(60 168)">
                <rect x="20" y="34" width="40" height="6" rx="1" fill="#b8860b"/>
                <rect x="32" y="22" width="16" height="14" fill="#d4a017"/>
                <path d="M 24 4 L 56 4 Q 56 26 40 26 Q 24 26 24 4 Z" fill="#ffd24a" stroke="#b8860b" stroke-width="1.5"/>
                <path d="M 24 6 Q 12 6 12 14 Q 12 22 24 22" fill="none" stroke="#ffd24a" stroke-width="3"/>
                <path d="M 56 6 Q 68 6 68 14 Q 68 22 56 22" fill="none" stroke="#ffd24a" stroke-width="3"/>
                <text x="40" y="20" text-anchor="middle" font-family="Helvetica" font-weight="900" font-size="10" fill="#7a4f00">1</text>
              </g>
            </svg>
          </div>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Helmet Ghost — pink football helmet, for Apply page
  ---------------------------------------------------------- */
  helmet(size = 180) {
    const h = Math.round(size * 1.2);
    return `
      <div class="db-mascot" style="width:${size}px;height:${h}px">
        <div class="db-mascot-stage">
          <div class="db-ghost-bob">
            <svg viewBox="0 0 200 240" width="100%" height="100%" style="overflow:visible">
              <defs>
                <radialGradient id="helmetShade" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.4"/>
                  <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <path d="${GHOST_PATH}" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
              <path d="${GHOST_PATH}" fill="url(#helmetShade)"/>
              <ellipse class="db-ghost-eye" cx="84"  cy="120" rx="6" ry="8" fill="#1a1124"/>
              <ellipse class="db-ghost-eye" cx="116" cy="120" rx="6" ry="8" fill="#1a1124" style="animation-delay:0.1s"/>
              <ellipse cx="70"  cy="146" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <ellipse cx="130" cy="146" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <path d="M 92 152 Q 100 158 108 152" fill="none" stroke="#1a1124" stroke-width="2.4" stroke-linecap="round"/>
              <!-- pink helmet -->
              <path d="M 30 90 Q 28 40, 100 30 Q 172 40, 170 90 L 170 110 Q 100 80 30 110 Z" fill="#ff5d9a" stroke="#1a1124" stroke-width="2"/>
              <path d="M 30 70 Q 100 50 170 70" fill="none" stroke="#fff" stroke-width="6"/>
              <!-- face mask bars -->
              <path d="M 50 110 Q 100 132 150 110" fill="none" stroke="#1a1124" stroke-width="3" stroke-linecap="round"/>
              <path d="M 56 118 Q 100 138 144 118" fill="none" stroke="#1a1124" stroke-width="3" stroke-linecap="round"/>
              <path d="M 68 100 v 30 M 100 96 v 36 M 132 100 v 30" stroke="#1a1124" stroke-width="2.5"/>
              <!-- shine -->
              <path d="M 50 50 Q 60 38 90 36" fill="none" stroke="#fff" stroke-width="4" opacity="0.7"/>
            </svg>
          </div>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Thinking Ghost — trivia buddy. Lightbulb, shifty eyes
  ---------------------------------------------------------- */
  think(size = 180) {
    const h = Math.round(size * 1.2);
    return `
      <div class="db-mascot" style="width:${size}px;height:${h}px">
        <div class="db-mascot-stage">
          <div class="db-bulb">
            <svg viewBox="0 0 24 32" width="28" height="36">
              <path d="M 12 2 a 9 9 0 0 1 6 16 v 4 h -12 v -4 a 9 9 0 0 1 6 -16 z" fill="#ffd24a" stroke="#c89517" stroke-width="1.5"/>
              <rect x="8" y="22" width="8" height="3" fill="#9a8a4a"/>
              <rect x="9" y="25" width="6" height="2" fill="#9a8a4a"/>
              <path d="M 9 8 Q 11 12 12 18 M 15 8 Q 13 12 12 18" fill="none" stroke="#fff" stroke-width="1" opacity="0.7"/>
            </svg>
          </div>
          <div class="db-ghost-bob db-ghost-bob-slow">
            <svg viewBox="0 0 200 240" width="100%" height="100%" style="overflow:visible">
              <defs>
                <radialGradient id="thinkShade" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.4"/>
                  <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <path d="${GHOST_PATH}" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
              <path d="${GHOST_PATH}" fill="url(#thinkShade)"/>
              <!-- shifty thinking eyes -->
              <ellipse class="db-eye-shift" cx="92"  cy="112" rx="6" ry="8" fill="#1a1124"/>
              <ellipse class="db-eye-shift" cx="130" cy="112" rx="6" ry="8" fill="#1a1124" style="animation-delay:0.1s"/>
              <ellipse cx="70"  cy="140" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <ellipse cx="134" cy="140" rx="9" ry="5" fill="#ff8fb5" opacity="0.55"/>
              <!-- hmm mouth -->
              <path d="M 90 152 Q 100 148 110 152" fill="none" stroke="#1a1124" stroke-width="2.4" stroke-linecap="round"/>
              <!-- hand on chin -->
              <ellipse cx="78" cy="170" rx="14" ry="10" fill="#f6f0fa" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>
            </svg>
          </div>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Helper: inject a mascot into a container element
  ---------------------------------------------------------- */
  render(type, container, size) {
    if (!container) return;
    const fn = this[type];
    if (typeof fn !== 'function') return;
    container.innerHTML = fn.call(this, size);
  }
};

window.Mascots = Mascots;
