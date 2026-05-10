/**
 * Home Page — down bad redesign
 * Hero leaderboard with ghost mascots
 */

const HomePage = {
  state: {
    currentWeek: null,
    currentYear: null,
    currentWeekType: null,
    leagueId: 1,
    viewMode: 'week', // 'week' | 'season'
    leaderboardData: null,
  },

  getWeekDisplayName(weekType) {
    return {
      regular:     null,
      wildcard:    'Wild Card',
      divisional:  'Divisional',
      conference:  'Conference Championship',
      superbowl:   'Super Bowl',
    }[weekType] || weekType;
  },

  weekLabel() {
    if (this.state.currentWeekType === 'regular') {
      return `Week ${this.state.currentWeek}`;
    }
    return this.getWeekDisplayName(this.state.currentWeekType);
  },

  async render(container) {
    if (!container) return;

    container.innerHTML = `<div class="db-page" style="opacity:0;transition:opacity 0.25s">
      <div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--ink-mute);font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;gap:12px">
        ${Mascots.dizzy(56)} loading…
      </div>
    </div>`;

    try {
      const weekResponse = await API.games.getCurrentWeek();
      this.state.currentWeek    = weekResponse.data.weekNumber;
      this.state.currentYear    = weekResponse.data.year;
      this.state.currentWeekType = weekResponse.data.weekType;

      const [boardRes] = await Promise.all([
        API.leaderboard.getWeek(
          this.state.currentWeek,
          this.state.leagueId,
          this.state.currentYear,
          this.state.currentWeekType
        )
      ]);

      this.state.leaderboardData = boardRes.data;
      this._draw(container);
      this.setupGameUpdateListener(container);

    } catch (err) {
      console.error('[HomePage] error:', err);
      container.innerHTML = `
        <div class="db-page">
          <div class="db-card" style="padding:32px;text-align:center">
            <p style="font-size:24px;margin:0 0 8px">👻</p>
            <p style="font-weight:700;margin:0 0 4px">Couldn't load the page</p>
            <p class="db-sub" style="margin:0 0 16px">${err.message || 'Unknown error'}</p>
            <button class="db-btn primary" onclick="location.reload()">Retry</button>
          </div>
        </div>`;
    }
  },

  _draw(container) {
    const data   = this.state.leaderboardData || [];
    const leader = data[0];
    const user   = Auth.currentUser;
    const userId = user?.id;
    const maxPts = data[0]?.points || 1;
    const week   = this.weekLabel();
    const year   = this.state.currentYear;

    const rankClass = r => r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '';

    const rows = data.map(entry => {
      const isMe = entry.userId === userId;
      const pct  = Math.round((entry.points / maxPts) * 100);
      const rc   = rankClass(entry.rank);
      const rec  = `${entry.wins}-${entry.losses}${entry.ties > 0 ? `-${entry.ties}` : ''}`;
      const avatarColor = entry.primaryColor || 'var(--avatar-bg)';
      const avatarText  = (window.Colors && entry.primaryColor)
        ? Colors.getContrastColor(entry.primaryColor)
        : 'var(--ink)';
      return `
        <div class="db-leader-row${isMe ? ' me' : ''}" data-user-id="${entry.userId}">
          <div class="db-rank ${rc}">${String(entry.rank).padStart(2, '0')}</div>
          <div class="db-avatar" style="background:${avatarColor};color:${avatarText}">
            ${entry.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="db-name">${entry.displayName}</span>
              ${isMe ? '<span class="db-badge you">you</span>' : ''}
            </div>
            <div class="db-record db-mono">${rec}</div>
            <div class="db-bar"><span style="width:${pct}%"></span></div>
          </div>
          <div></div>
          <div class="db-points">${entry.points}</div>
        </div>`;
    }).join('');

    const leaderName = leader ? leader.displayName : '—';
    const leaderPts  = leader ? leader.points : '—';

    container.innerHTML = `
      <div class="db-page">

        <!-- hero row -->
        <div class="db-home-grid" style="margin-bottom:20px">
          <div class="db-card" style="padding:22px;display:flex;gap:18px;align-items:center">
            <div style="width:140px;height:168px;flex-shrink:0">
              ${Mascots.trophy(140)}
            </div>
            <div style="flex:1;min-width:0">
              <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:11px">${week} winner</p>
              <h1 class="db-h1 db-italic" style="margin-top:6px">${leaderName}</h1>
              <p class="db-sub" style="margin-top:6px;line-height:1.5">${leaderPts} points · ${week} · ${year} Season</p>
              <div style="display:flex;gap:10px;margin-top:14px">
                <a href="#picks" class="db-btn primary">Make your picks →</a>
                <a href="#compare-picks" class="db-btn">Compare picks</a>
              </div>
            </div>
          </div>

          <div class="db-card" style="padding:22px">
            <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:11px">season standings</p>
            <h2 class="db-h1" style="margin-top:6px;font-size:22px">${year} · ${week}</h2>
            <p class="db-sub">${data.length} players · ranked by picks correct</p>
            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="db-btn${this.state.viewMode === 'week' ? ' primary' : ''}" id="db-week-btn">Week</button>
              <button class="db-btn${this.state.viewMode === 'season' ? ' primary' : ''}" id="db-season-btn">Season</button>
            </div>
          </div>
        </div>

        <!-- leaderboard + side cards -->
        <div class="db-home-lower">
          <div class="db-card" id="db-leaderboard-card">
            <div class="db-card-h">
              ${this.state.viewMode === 'week' ? week : year + ' Season'} leaderboard
              <span class="db-pill">${year} · ${week}</span>
            </div>
            ${rows.length ? rows : `
              <div style="padding:32px;text-align:center;color:var(--ink-mute)">
                <p style="font-size:32px;margin:0 0 8px">👻</p>
                <p style="margin:0;font-weight:600">No picks yet — be the first!</p>
              </div>`}
          </div>

          <div class="db-side-cards">
            <div class="db-card" style="padding:18px;display:flex;gap:14px;align-items:center">
              <div style="width:86px;height:104px;flex-shrink:0">${Mascots.ref(86)}</div>
              <div>
                <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700">league</p>
                <p style="margin:4px 0 8px;font-weight:700;font-size:13px">Compare your picks with the rest of the league.</p>
                <a href="#compare-picks" class="db-btn" style="height:32px;font-size:12px">View →</a>
              </div>
            </div>
            <div class="db-card" style="padding:18px">
              <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700">your picks</p>
              <h3 style="margin:8px 0 6px;font-size:18px;font-weight:800;letter-spacing:-.02em">Ready for ${week}?</h3>
              <p class="db-sub">Lock in before kickoff. Picks close at game time.</p>
              <a href="#picks" class="db-btn primary" style="margin-top:12px;display:inline-flex">Pick'ems →</a>
            </div>
          </div>
        </div>

      </div>`;

    // fade in
    requestAnimationFrame(() => {
      const page = container.querySelector('.db-page');
      if (page) page.style.opacity = '1';
    });

    this._attachListeners(container);
  },

  _attachListeners(container) {
    const weekBtn   = container.querySelector('#db-week-btn');
    const seasonBtn = container.querySelector('#db-season-btn');

    weekBtn?.addEventListener('click', async () => {
      if (this.state.viewMode === 'week') return;
      this.state.viewMode = 'week';
      const res = await API.leaderboard.getWeek(
        this.state.currentWeek, this.state.leagueId,
        this.state.currentYear, this.state.currentWeekType
      );
      this.state.leaderboardData = res.data;
      this._draw(container);
    });

    seasonBtn?.addEventListener('click', async () => {
      if (this.state.viewMode === 'season') return;
      this.state.viewMode = 'season';
      try {
        const res = await API.leaderboard.getSeason(this.state.leagueId);
        // normalize season shape to week shape for rendering
        this.state.leaderboardData = (res.data || []).map(e => ({
          ...e,
          wins:   e.totalWins   ?? e.wins,
          losses: e.totalLosses ?? e.losses,
          ties:   e.totalTies   ?? e.ties,
          points: e.totalPoints ?? e.points,
        }));
        this._draw(container);
      } catch (err) {
        console.error('[HomePage] season load error:', err);
      }
    });

    container.querySelectorAll('.db-leader-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        window.location.hash = 'compare-picks';
      });
    });
  },

  setupGameUpdateListener(container) {
    if (this.gameUpdateHandler) {
      window.removeEventListener('games-updated', this.gameUpdateHandler);
    }
    this.gameUpdateHandler = () => this.render(container);
    window.addEventListener('games-updated', this.gameUpdateHandler);
  },
};

window.HomePage = HomePage;
