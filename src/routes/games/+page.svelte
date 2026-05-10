<script>
  import { untrack } from 'svelte';

  let { data } = $props();

  const weekLabel = (w) =>
    w.week_type === 'regular'
      ? `Week ${w.week_number}`
      : { wildcard: 'Wild Card', divisional: 'Divisional', conference: 'Conference Championship', superbowl: 'Super Bowl' }[w.week_type] ?? w.week_type;

  let selectedYear = $state(untrack(() => data.week.year));
  let selectedWeek = $state(untrack(() => data.week.number));
  let selectedType = $state(untrack(() => data.week.type));

  let games = $state(untrack(() => data.games));
  let loading = $state(false);

  const years = $derived([...new Set(data.availableWeeks.map(w => w.season_year))].sort((a, b) => b - a));
  const weeksForYear = $derived(data.availableWeeks.filter(w => w.season_year === selectedYear));

  async function loadWeek(year, weekNum, weekType) {
    loading = true;
    try {
      const res = await fetch(`/api/games?year=${year}&week=${weekNum}&weekType=${weekType}`);
      const json = await res.json();
      games = json.data ?? [];
      selectedYear = year;
      selectedWeek = weekNum;
      selectedType = weekType;
    } finally {
      loading = false;
    }
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }

  function statusBadge(game) {
    const s = game.game_status;
    if (s === 'final' || s === 'status_final') return { label: 'Final', cls: 'final' };
    if (s === 'in_progress' || s === 'status_in_progress') return { label: 'Live', cls: 'live' };
    return { label: formatTime(game.game_time), cls: '' };
  }
</script>

<svelte:head><title>Games · down bad ↓</title></svelte:head>

<div class="db-page">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <h1 class="db-h1" style="flex:1">Games</h1>

    <!-- Year selector -->
    <select
      class="db-select"
      value={selectedYear}
      onchange={(e) => {
        const yr = parseInt(e.target.value);
        const first = data.availableWeeks.find(w => w.season_year === yr);
        if (first) loadWeek(yr, first.week_number, first.week_type);
      }}
    >
      {#each years as yr}
        <option value={yr}>{yr}</option>
      {/each}
    </select>
  </div>

  <!-- Week tabs -->
  {#if weeksForYear.length > 1}
    <div class="db-week-tabs" style="margin-bottom:20px">
      {#each weeksForYear as w}
        <button
          class="db-week-tab {w.week_number === selectedWeek && w.week_type === selectedType ? 'active' : ''}"
          onclick={() => loadWeek(w.season_year, w.week_number, w.week_type)}
        >
          {weekLabel(w)}
        </button>
      {/each}
    </div>
  {/if}

  {#if loading}
    <div style="text-align:center;padding:48px;color:var(--ink-mute)">Loading…</div>
  {:else if games.length === 0}
    <div class="db-card" style="padding:48px;text-align:center">
      <p style="font-size:40px;margin:0 0 12px">👻</p>
      <p style="font-weight:700;margin:0">No games found.</p>
    </div>
  {:else}
    {#each games as game}
      {@const badge = statusBadge(game)}
      <div class="db-game-card">
        <div class="db-game-card-header">
          <span class="db-status-badge {badge.cls}">{badge.label}</span>
        </div>
        <div class="db-matchup">
          <div class="db-matchup-team {game.winner === 'away' ? 'winner' : ''}">
            {#if game.away_team_logo}
              <img src={game.away_team_logo} alt={game.away_team_abbr} class="db-team-logo-lg" />
            {/if}
            <div>
              <div class="db-team-abbr-lg">{game.away_team_abbr}</div>
              <div class="db-sub" style="font-size:11px">{game.away_team}</div>
            </div>
            <div class="db-score">{game.away_score ?? '—'}</div>
          </div>

          <div style="color:var(--ink-mute);font-weight:700;font-size:13px;padding:0 8px">@</div>

          <div class="db-matchup-team {game.winner === 'home' ? 'winner' : ''}">
            <div class="db-score">{game.home_score ?? '—'}</div>
            <div style="text-align:right">
              <div class="db-team-abbr-lg">{game.home_team_abbr}</div>
              <div class="db-sub" style="font-size:11px">{game.home_team}</div>
            </div>
            {#if game.home_team_logo}
              <img src={game.home_team_logo} alt={game.home_team_abbr} class="db-team-logo-lg" />
            {/if}
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .db-game-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 10px;
  }
  .db-game-card-header {
    margin-bottom: 12px;
  }
  .db-status-badge {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--bg-2);
    color: var(--ink-mute);
  }
  .db-status-badge.final { background: color-mix(in srgb, var(--good) 15%, var(--bg-2)); color: var(--good); }
  .db-status-badge.live { background: color-mix(in srgb, var(--accent) 15%, var(--bg-2)); color: var(--accent); }
  .db-matchup {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .db-matchup-team {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .db-matchup-team.winner .db-team-abbr-lg { color: var(--good); }
  .db-team-logo-lg { width: 44px; height: 44px; object-fit: contain; }
  .db-team-abbr-lg { font-size: 16px; font-weight: 800; letter-spacing: -.02em; }
  .db-score { font-size: 22px; font-weight: 900; font-family: var(--font-mono); min-width: 32px; text-align: center; }
  .db-week-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .db-week-tabs::-webkit-scrollbar { display: none; }
  .db-week-tab {
    flex-shrink: 0;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--bg-2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    color: var(--ink-mute);
    transition: background .15s, color .15s;
  }
  .db-week-tab.active, .db-week-tab:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .db-select {
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-2);
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
