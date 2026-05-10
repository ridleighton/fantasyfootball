<script>
  import { untrack } from 'svelte';

  let { data } = $props();

  const weekLabel = $derived(
    data.week.type === 'regular'
      ? `Week ${data.week.number}`
      : { wildcard: 'Wild Card', divisional: 'Divisional', conference: 'Conference Championship', superbowl: 'Super Bowl' }[data.week.type] ?? data.week.type
  );

  // Local pick state (mirrors server picks, updated optimistically)
  let picks = $state(untrack(() => ({ ...data.picks })));
  let saving = $state(false);
  let saved = $state(false);
  let error = $state('');

  function isPicked(gameId, side) {
    return picks[gameId]?.predictedWinner === side;
  }

  function canPick(game) {
    return ['scheduled', 'pre', 'status_scheduled'].includes(game.game_status);
  }

  function pickTeam(gameId, side, game) {
    if (!canPick(game)) return;
    picks[gameId] = { predictedWinner: side, isCorrect: null };
    saved = false;
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }

  function statusLabel(game) {
    const s = game.game_status;
    if (s === 'final' || s === 'status_final') return `Final · ${game.away_score ?? 0}–${game.home_score ?? 0}`;
    if (s === 'in_progress' || s === 'status_in_progress') return 'In progress';
    return formatTime(game.game_time);
  }

  function resultClass(gameId, side) {
    const p = picks[gameId];
    if (!p || p.predictedWinner !== side) return '';
    if (p.isCorrect === true) return 'correct';
    if (p.isCorrect === false) return 'incorrect';
    return 'picked';
  }

  const picksToSubmit = $derived(
    data.games
      .filter(g => canPick(g) && picks[g.id])
      .map(g => ({ gameId: g.id, predictedWinner: picks[g.id].predictedWinner, leagueId: 1 }))
  );

  async function submitPicks() {
    if (picksToSubmit.length === 0) return;
    saving = true;
    error = '';
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: picksToSubmit })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save picks');
      saved = true;
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  const gamesLocked = $derived(data.games.filter(g => !canPick(g)));
  const gamesOpen = $derived(data.games.filter(g => canPick(g)));
  const pendingCount = $derived(picksToSubmit.length);
</script>

<svelte:head><title>Pick'ems · down bad ↓</title></svelte:head>

<div class="db-page">
  <div class="db-card-h" style="margin-bottom:20px">
    {weekLabel} pick'ems
    <span class="db-pill">{data.week.year}</span>
  </div>

  {#if data.games.length === 0}
    <div class="db-card" style="padding:48px;text-align:center">
      <p style="font-size:40px;margin:0 0 12px">👻</p>
      <p style="font-weight:700;margin:0 0 6px">No games this week yet.</p>
      <p class="db-sub">Check back when the schedule is posted.</p>
    </div>
  {:else}
    <!-- Open games -->
    {#if gamesOpen.length > 0}
      <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700;margin-bottom:12px">
        Make your picks
      </p>
      {#each gamesOpen as game}
        <div class="db-game">
          <div class="db-game-meta">{statusLabel(game)}</div>
          <div class="db-game-teams">
            <button
              class="db-team-btn {resultClass(game.id, 'away')} {isPicked(game.id, 'away') ? 'active' : ''}"
              onclick={() => pickTeam(game.id, 'away', game)}
            >
              {#if game.away_team_logo}
                <img src={game.away_team_logo} alt={game.away_team_abbr} class="db-team-logo" />
              {/if}
              <span class="db-team-abbr">{game.away_team_abbr}</span>
              <span class="db-team-name db-sub">{game.away_team}</span>
            </button>

            <div class="db-game-vs">@</div>

            <button
              class="db-team-btn {resultClass(game.id, 'home')} {isPicked(game.id, 'home') ? 'active' : ''}"
              onclick={() => pickTeam(game.id, 'home', game)}
            >
              {#if game.home_team_logo}
                <img src={game.home_team_logo} alt={game.home_team_abbr} class="db-team-logo" />
              {/if}
              <span class="db-team-abbr">{game.home_team_abbr}</span>
              <span class="db-team-name db-sub">{game.home_team}</span>
            </button>
          </div>
        </div>
      {/each}
    {/if}

    <!-- Locked games -->
    {#if gamesLocked.length > 0}
      <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700;margin:24px 0 12px">
        Locked games
      </p>
      {#each gamesLocked as game}
        <div class="db-game locked">
          <div class="db-game-meta">{statusLabel(game)}</div>
          <div class="db-game-teams">
            <div class="db-team-btn {resultClass(game.id, 'away')} {isPicked(game.id, 'away') ? 'active' : ''} readonly">
              {#if game.away_team_logo}
                <img src={game.away_team_logo} alt={game.away_team_abbr} class="db-team-logo" />
              {/if}
              <span class="db-team-abbr">{game.away_team_abbr}</span>
              <span class="db-team-name db-sub">{game.away_team}</span>
              {#if game.winner === 'away'}
                <span class="db-winner-badge">W</span>
              {/if}
            </div>

            <div class="db-game-vs">@</div>

            <div class="db-team-btn {resultClass(game.id, 'home')} {isPicked(game.id, 'home') ? 'active' : ''} readonly">
              {#if game.home_team_logo}
                <img src={game.home_team_logo} alt={game.home_team_abbr} class="db-team-logo" />
              {/if}
              <span class="db-team-abbr">{game.home_team_abbr}</span>
              <span class="db-team-name db-sub">{game.home_team}</span>
              {#if game.winner === 'home'}
                <span class="db-winner-badge">W</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}

    <!-- Submit footer -->
    {#if gamesOpen.length > 0}
      <div class="db-picks-footer">
        {#if error}
          <p style="color:var(--bad);font-size:13px;font-weight:600;margin:0 0 10px">{error}</p>
        {/if}
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <span class="db-sub" style="flex:1">
            {pendingCount} pick{pendingCount !== 1 ? 's' : ''} ready to submit
          </span>
          {#if saved}
            <span style="color:var(--good);font-weight:700;font-size:13px">Saved ✓</span>
          {/if}
          <button
            class="db-btn primary lg"
            onclick={submitPicks}
            disabled={saving || pendingCount === 0}
          >
            {saving ? 'Saving…' : 'Lock in picks →'}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .db-game {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
  }
  .db-game.locked { opacity: .85; }
  .db-game-meta {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--ink-mute);
    margin-bottom: 12px;
  }
  .db-game-teams {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .db-game-vs {
    font-size: 13px;
    color: var(--ink-mute);
    font-weight: 700;
    flex-shrink: 0;
  }
  .db-team-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: var(--bg-2);
    cursor: pointer;
    transition: border-color .15s, background .15s, transform .1s;
    position: relative;
    color: inherit;
    font: inherit;
  }
  .db-team-btn:hover:not(.readonly) { background: var(--bg-3); transform: translateY(-1px); }
  .db-team-btn.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--bg-2)); }
  .db-team-btn.correct { border-color: var(--good); background: color-mix(in srgb, var(--good) 12%, var(--bg-2)); }
  .db-team-btn.incorrect { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, var(--bg-2)); }
  .db-team-btn.readonly { cursor: default; }
  .db-team-logo { width: 40px; height: 40px; object-fit: contain; }
  .db-team-abbr { font-size: 15px; font-weight: 800; letter-spacing: -.02em; }
  .db-team-name { font-size: 11px; text-align: center; }
  .db-winner-badge {
    position: absolute;
    top: 6px; right: 6px;
    background: var(--good);
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 4px;
  }
  .db-picks-footer {
    position: sticky;
    bottom: 0;
    background: var(--bg);
    border-top: 1px solid var(--border);
    padding: 16px;
    margin: 24px -16px -16px;
  }
</style>
