/**
 * Unified Picks/History Page — down bad redesign
 *
 * Combined picks and history page with week selector.
 * All data fetching and submission logic unchanged;
 * only rendering methods updated to the new design system.
 */

const PicksUnifiedPage = {
  state: {
    selectedWeek:    null,
    selectedYear:    null,
    selectedWeekType: null,
    currentWeek:     null,
    currentYear:     null,
    currentWeekType: null,
    leagueId:        1,
    games:           [],
    picks:           {},
    existingPicks:   [],
    availableWeeks:  [],
    isCurrentWeek:   false,
    locked:          false,
  },

  /* ----------------------------------------------------------
     Data loading
  ---------------------------------------------------------- */
  async render(container) {
    if (!container) return;

    try {
      const [weekResponse, weeksResponse] = await Promise.all([
        API.games.getCurrentWeek(),
        API.games.getWeeks()
      ]);

      this.state.currentWeek     = weekResponse.data.weekNumber;
      this.state.currentYear     = weekResponse.data.year;
      this.state.currentWeekType = this.normalizeWeekType(weekResponse.data.weekType);
      this.state.availableWeeks  = weeksResponse.data.map(w => ({
        ...w, weekType: this.normalizeWeekType(w.weekType)
      }));

      if (!this.state.selectedWeek) {
        const hash = window.location.hash.slice(1);
        if (hash === 'history') {
          const typeOrder = { regular: 0, wildcard: 1, divisional: 2, conference: 3, superbowl: 4 };
          const pastWeeks = this.state.availableWeeks.filter(w => {
            if (w.year < this.state.currentYear) return true;
            if (w.year === this.state.currentYear) {
              if (w.weekType === this.state.currentWeekType) return w.weekNumber < this.state.currentWeek;
              return typeOrder[w.weekType] < typeOrder[this.state.currentWeekType];
            }
            return false;
          });
          const most = pastWeeks[pastWeeks.length - 1];
          if (most) {
            this.state.selectedWeek     = most.weekNumber;
            this.state.selectedYear     = most.year;
            this.state.selectedWeekType = most.weekType;
          } else {
            this.state.selectedWeek     = this.state.currentWeek;
            this.state.selectedYear     = this.state.currentYear;
            this.state.selectedWeekType = this.state.currentWeekType;
          }
        } else {
          this.state.selectedWeek     = this.state.currentWeek;
          this.state.selectedYear     = this.state.currentYear;
          this.state.selectedWeekType = this.state.currentWeekType;
        }
      }

      this.state.isCurrentWeek = (
        this.state.selectedWeek     === this.state.currentWeek &&
        this.state.selectedYear     === this.state.currentYear &&
        this.state.selectedWeekType === this.state.currentWeekType
      );

      const [gamesResponse, picksResponse] = await Promise.all([
        API.games.getGames(this.state.selectedWeek, this.state.selectedYear, this.state.selectedWeekType),
        API.picks.get(this.state.selectedWeek, this.state.selectedYear, this.state.leagueId, this.state.selectedWeekType)
      ]);

      this.state.games         = gamesResponse.data;
      this.state.existingPicks = picksResponse.data;

      this.state.picks = {};
      this.state.existingPicks.forEach(pick => {
        this.state.picks[pick.gameId] = pick.predictedWinner;
      });

      const now = new Date();
      this.state.locked = this.state.games.every(g => new Date(g.gameTime) < now);

      const stats = this.state.isCurrentWeek ? null : this.calculateWeekStats();

      container.innerHTML = `
        <div class="db-page">
          ${this.renderHeader()}
          ${!this.state.isCurrentWeek ? this.renderWeekStats(stats) : ''}
          ${this.renderGamesList()}
          ${this.state.isCurrentWeek && !this.state.locked ? this.renderFooter() : ''}
        </div>`;

      this.attachEventListeners(container);
      this.setupGameUpdateListener(container);

    } catch (err) {
      console.error('[PicksUnifiedPage] error:', err);
      container.innerHTML = `
        <div class="db-page">
          <div class="db-card" style="padding:32px;text-align:center">
            <p style="font-size:24px;margin:0 0 8px">👻</p>
            <p style="font-weight:700;margin:0 0 4px">Couldn't load picks</p>
            <p class="db-sub" style="margin:0 0 16px">${err.message || 'Unknown error'}</p>
            <button class="db-btn primary" onclick="location.reload()">Retry</button>
          </div>
        </div>`;
    }
  },

  /* ----------------------------------------------------------
     Header — week label + selector dropdown
  ---------------------------------------------------------- */
  renderHeader() {
    const title = this.state.selectedWeekType === 'regular'
      ? `Week ${this.state.selectedWeek}`
      : this.getWeekDisplayName(this.state.selectedWeekType);

    let subtitle;
    if (this.state.isCurrentWeek && !this.state.locked) {
      subtitle = `Tap a team to pick. ${this.state.games.length} games this week.`;
    } else if (this.state.locked && this.state.isCurrentWeek) {
      subtitle = 'All games have started — picks are locked.';
    } else {
      subtitle = 'History — your picks &amp; results.';
    }

    const weekOptions = this.state.availableWeeks.map((w, i) => {
      const label = w.weekType === 'regular'
        ? `Week ${w.weekNumber} · ${w.year}`
        : `${this.getWeekDisplayName(w.weekType)} · ${w.year}`;
      const selected = (
        w.weekNumber === this.state.selectedWeek &&
        w.year       === this.state.selectedYear &&
        w.weekType   === this.state.selectedWeekType
      );
      return `<option value="${i}"
                data-week-number="${w.weekNumber}"
                data-year="${w.year}"
                data-week-type="${w.weekType}"
                ${selected ? 'selected' : ''}>
                ${label}
              </option>`;
    }).join('');

    const now = new Date();
    const picksLockingSoon = this.state.isCurrentWeek && !this.state.locked && this.state.games.length > 0;
    const nextGame = picksLockingSoon
      ? this.state.games
          .filter(g => new Date(g.gameTime) > now)
          .sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime))[0]
      : null;

    return `
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap">
        <div>
          <h1 class="db-h1">${title} picks</h1>
          <p class="db-sub">${subtitle}</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${nextGame ? `<div class="db-timer"><span class="db-timer-dot"></span><span class="db-mono" style="font-size:12px">locks ${this._formatGameTime(nextGame.gameTime)}</span></div>` : ''}
          <select id="week-select" class="db-input" style="height:40px;width:auto;font-size:13px">
            ${weekOptions}
          </select>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Week stats bar (history view)
  ---------------------------------------------------------- */
  renderWeekStats(stats) {
    if (!stats) return '';
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
        <div class="db-card" style="padding:14px;text-align:center">
          <div class="db-mono" style="font-size:28px;font-weight:800;color:var(--good)">${stats.correct}</div>
          <div class="db-sub" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Correct</div>
        </div>
        <div class="db-card" style="padding:14px;text-align:center">
          <div class="db-mono" style="font-size:28px;font-weight:800;color:var(--bad)">${stats.incorrect}</div>
          <div class="db-sub" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Incorrect</div>
        </div>
        <div class="db-card" style="padding:14px;text-align:center">
          <div class="db-mono" style="font-size:28px;font-weight:800;color:var(--ink-mute)">${stats.pending}</div>
          <div class="db-sub" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Pending</div>
        </div>
        <div class="db-card" style="padding:14px;text-align:center">
          <div class="db-mono" style="font-size:28px;font-weight:800;color:var(--accent)">${stats.percentage}%</div>
          <div class="db-sub" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Rate</div>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Games grid
  ---------------------------------------------------------- */
  renderGamesList() {
    if (!this.state.games.length) {
      return `<div class="db-card" style="padding:32px;text-align:center;color:var(--ink-mute)">
                <p style="font-size:32px;margin:0 0 8px">📅</p>
                <p style="margin:0;font-weight:600">No games found for this week.</p>
              </div>`;
    }

    const now = new Date();
    const cards = this.state.games.map(game => {
      const userPick = this.state.existingPicks.find(p => p.gameId === game.id);
      const canEdit  = this.state.isCurrentWeek && new Date(game.gameTime) > now;
      return this.renderGameCard(game, userPick, canEdit);
    }).join('');

    return `<div class="db-picks-grid">${cards}</div>`;
  },

  /* ----------------------------------------------------------
     Individual game card
  ---------------------------------------------------------- */
  renderGameCard(game, userPick, canEdit) {
    const isFinal      = game.gameStatus === 'final' || game.gameStatus === 'status_final';
    const isInProgress = game.gameStatus === 'in_progress' || game.gameStatus === 'in';

    const statusText = isFinal ? 'Final' : isInProgress ? '🔴 Live' : 'Scheduled';

    const homePicked = userPick?.predictedWinner === 'home';
    const awayPicked = userPick?.predictedWinner === 'away';

    const resultBadge = (picked) => {
      if (!picked || !isFinal || !userPick) return '';
      const correct = userPick.isCorrect;
      if (correct === true)  return `<span class="db-pick-tag" style="border-color:var(--good);color:var(--good)">✓ Correct</span>`;
      if (correct === false) return `<span class="db-pick-tag" style="border-color:var(--bad);color:var(--bad)">✗ Wrong</span>`;
      return '';
    };

    const teamLogo = (abbr, logoUrl) => {
      if (logoUrl) return `<img src="${logoUrl}" alt="${abbr}" style="width:44px;height:44px;border-radius:50%;object-fit:contain;background:#fff">`;
      const colors = {
        KC:'#e31837',BUF:'#00338d',PHI:'#004c54',DAL:'#003594',
        SF:'#aa0000',DET:'#0076b6',BAL:'#241773',MIA:'#008e97',
        GB:'#203731',NYJ:'#125740',LAR:'#003594',SEA:'#002244',
        CIN:'#fb4f14',PIT:'#ffb612',NE:'#002244',NO:'#d3b787',
      };
      const bg = colors[abbr] || 'var(--plum)';
      return `<div class="db-team-logo" style="background:${bg}">${abbr ? abbr.charAt(0) : '?'}</div>`;
    };

    const scoreDisplay = (score, winner, side) =>
      score !== null && score !== undefined
        ? `<span class="db-mono" style="font-size:13px;font-weight:800;color:${game.winner===side?'var(--accent)':'var(--ink-mute)'}">${score}</span>`
        : '';

    const clickable = canEdit ? 'role="button" tabindex="0" style="cursor:pointer"' : '';

    return `
      <div class="db-game" data-game-id="${game.id}">
        <!-- away team -->
        <div class="db-team ${awayPicked ? 'picked' : ''}" data-team="away" data-game-id="${game.id}" ${clickable}>
          ${awayPicked ? `<span class="db-pick-tag">YOUR PICK</span>` : ''}
          ${resultBadge(awayPicked)}
          ${teamLogo(game.awayTeamAbbr, game.awayTeamLogo)}
          <div class="db-team-name">${game.awayTeam || game.awayTeamAbbr}</div>
          <div class="db-team-record db-mono">${game.awayTeamAbbr || ''} · away</div>
          ${scoreDisplay(game.awayScore, game.winner, 'away')}
        </div>

        <!-- vs / score divider -->
        <div class="db-vs">
          <span>${isFinal || isInProgress ? `${game.awayScore ?? '–'}<br><span style="font-size:9px;letter-spacing:.1em">VS</span><br>${game.homeScore ?? '–'}` : 'VS'}</span>
        </div>

        <!-- home team -->
        <div class="db-team ${homePicked ? 'picked' : ''}" data-team="home" data-game-id="${game.id}" ${clickable}>
          ${homePicked ? `<span class="db-pick-tag">YOUR PICK</span>` : ''}
          ${resultBadge(homePicked)}
          ${teamLogo(game.homeTeamAbbr, game.homeTeamLogo)}
          <div class="db-team-name">${game.homeTeam || game.homeTeamAbbr}</div>
          <div class="db-team-record db-mono">${game.homeTeamAbbr || ''} · home</div>
          ${scoreDisplay(game.homeScore, game.winner, 'home')}
        </div>

        <!-- footer meta -->
        <div class="db-game-meta">
          <span>${this._formatGameTime(game.gameTime)}</span>
          <span style="display:flex;align-items:center;gap:6px">
            <span class="db-mono" style="font-size:10px;padding:2px 6px;border-radius:4px;background:${isInProgress?'var(--accent)':'var(--bg-2)'};color:${isInProgress?'var(--accent-ink)':'var(--ink-mute)'}">${statusText}</span>
            ${canEdit ? `<button class="db-btn" style="height:22px;padding:0 8px;font-size:10px;border-radius:6px" data-team="tie" data-game-id="${game.id}">${userPick?.predictedWinner==='tie'?'✓ Tie':'Tie'}</button>` : ''}
          </span>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     QB ghost footer (submit bar)
  ---------------------------------------------------------- */
  renderFooter() {
    const count  = Object.keys(this.state.picks).length;
    const total  = this.state.games.length;
    const now    = new Date();
    const open   = this.state.games.filter(g => new Date(g.gameTime) > now && !this.state.picks[g.id]).length;

    return `
      <div class="db-card" style="padding:16px;display:flex;gap:16px;align-items:center;margin-top:4px">
        <div style="width:86px;height:104px;flex-shrink:0">${Mascots.qb(86)}</div>
        <div style="flex:1">
          <p style="margin:0;font-weight:700">${count} of ${total} picks made${open > 0 ? ` · ${open} left` : ' · all done ✓'}.</p>
          <p class="db-sub" style="margin:2px 0 0">Auto-saved. Picks lock at kickoff for each game.</p>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
          <button class="db-btn" id="reset-picks-btn">Reset week</button>
          <button class="db-btn primary lg" id="submit-picks-btn">Lock picks (${count}/${total}) →</button>
        </div>
      </div>`;
  },

  /* ----------------------------------------------------------
     Helpers
  ---------------------------------------------------------- */
  _formatGameTime(rawTime) {
    if (!rawTime) return '—';
    try {
      const tz = Auth.currentUser?.timezone || Auth.currentUser?.timezone || 'America/New_York';
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      }).format(new Date(rawTime));
    } catch {
      return new Date(rawTime).toLocaleString();
    }
  },

  normalizeWeekType(weekType) {
    if (['1','2','3',1,2,3].includes(weekType)) return 'regular';
    return weekType;
  },

  getWeekDisplayName(weekType) {
    return { regular:'Regular Season', wildcard:'Wild Card', divisional:'Divisional', conference:'Conference Championship', superbowl:'Super Bowl' }[weekType] || weekType;
  },

  calculateWeekStats() {
    const correct   = this.state.existingPicks.filter(p => p.isCorrect === true).length;
    const incorrect = this.state.existingPicks.filter(p => p.isCorrect === false).length;
    const pending   = this.state.existingPicks.filter(p => p.isCorrect === null).length;
    const final     = this.state.games.filter(g => g.gameStatus === 'final' || g.gameStatus === 'status_final').length;
    return { correct, incorrect, pending, percentage: final > 0 ? Math.round((correct / final) * 100) : 0 };
  },

  /* ----------------------------------------------------------
     Event listeners (business logic unchanged)
  ---------------------------------------------------------- */
  attachEventListeners(container) {
    // Week selector
    const weekSelect = container.querySelector('#week-select');
    if (weekSelect) {
      weekSelect.addEventListener('change', async () => {
        const opt = weekSelect.options[weekSelect.selectedIndex];
        this.state.selectedWeek     = parseInt(opt.dataset.weekNumber);
        this.state.selectedYear     = parseInt(opt.dataset.year);
        this.state.selectedWeekType = opt.dataset.weekType;
        this.state.selectedWeek && (this.state.selectedWeek = this.state.selectedWeek); // trigger re-render
        await this.render(container);
      });
    }

    // Team picks
    container.querySelectorAll('.db-team[role="button"]').forEach(el => {
      el.addEventListener('click', () => {
        const gameId = parseInt(el.dataset.gameId);
        const side   = el.dataset.team;
        this.state.picks[gameId] = side;
        this.updatePickSelection(container, gameId, side);
        this._refreshFooter(container);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });

    // Tie buttons (inside game-meta)
    container.querySelectorAll('[data-team="tie"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const gameId = parseInt(btn.dataset.gameId);
        const current = this.state.picks[gameId];
        if (current === 'tie') {
          delete this.state.picks[gameId];
          btn.textContent = 'Tie';
        } else {
          this.state.picks[gameId] = 'tie';
          btn.textContent = '✓ Tie';
        }
        this.updatePickSelection(container, gameId, this.state.picks[gameId] || null);
        this._refreshFooter(container);
      });
    });

    // Submit
    const submitBtn = container.querySelector('#submit-picks-btn');
    submitBtn?.addEventListener('click', () => this.submitPicks(container));

    // Reset (clear all pending picks)
    const resetBtn = container.querySelector('#reset-picks-btn');
    resetBtn?.addEventListener('click', async () => {
      if (!confirm('Clear all picks for this week?')) return;
      this.state.picks = {};
      await this.render(container);
    });
  },

  updatePickSelection(container, gameId, selection) {
    const card = container.querySelector(`.db-game[data-game-id="${gameId}"]`);
    if (!card) return;

    card.querySelectorAll('.db-team').forEach(t => t.classList.remove('picked'));
    card.querySelectorAll('.db-pick-tag').forEach(t => {
      if (t.textContent === 'YOUR PICK') t.remove();
    });

    if (selection === 'away' || selection === 'home') {
      const picked = card.querySelector(`.db-team[data-team="${selection}"]`);
      if (picked) {
        picked.classList.add('picked');
        const tag = document.createElement('span');
        tag.className = 'db-pick-tag';
        tag.textContent = 'YOUR PICK';
        picked.prepend(tag);
      }
    }

    // update tie btn text
    const tieBtn = card.querySelector('[data-team="tie"]');
    if (tieBtn) tieBtn.textContent = selection === 'tie' ? '✓ Tie' : 'Tie';
  },

  _refreshFooter(container) {
    const footer = container.querySelector('.db-card:last-child');
    if (footer && footer.querySelector('#submit-picks-btn')) {
      const count = Object.keys(this.state.picks).length;
      const total = this.state.games.length;
      const now   = new Date();
      const open  = this.state.games.filter(g => new Date(g.gameTime) > now && !this.state.picks[g.id]).length;
      const p = footer.querySelector('p');
      if (p) p.textContent = `${count} of ${total} picks made${open > 0 ? ` · ${open} left` : ' · all done ✓'}.`;
      const btn = footer.querySelector('#submit-picks-btn');
      if (btn) btn.textContent = `Lock picks (${count}/${total}) →`;
    }
  },

  async submitPicks(container) {
    const arr = Object.entries(this.state.picks).map(([gameId, predictedWinner]) => ({
      gameId: parseInt(gameId), predictedWinner, leagueId: this.state.leagueId
    }));
    if (!arr.length) { window.UI?.showToast('No picks to submit', 'warning'); return; }

    try {
      window.UI?.showLoading();
      const res = await API.picks.submit(arr);
      if (res.data.submitted > 0) {
        window.UI?.showToast(`${res.data.submitted} pick(s) submitted!`, 'success');
      } else {
        window.UI?.showToast('No picks could be submitted.', 'warning');
      }
      await this.render(container);
      window.UI?.hideLoading();
    } catch (err) {
      console.error('[PicksUnifiedPage] submit error:', err);
      window.UI?.showToast(err.message || 'Failed to submit picks', 'error');
      window.UI?.hideLoading();
    }
  },

  setupGameUpdateListener(container) {
    if (this.gameUpdateHandler) window.removeEventListener('games-updated', this.gameUpdateHandler);
    this.gameUpdateHandler = () => this.render(container);
    window.addEventListener('games-updated', this.gameUpdateHandler);
  },
};

window.PicksUnifiedPage = PicksUnifiedPage;
