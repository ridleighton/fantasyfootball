<script>
  import { untrack } from 'svelte';

  let { data } = $props();

  const weekLabel = (w) =>
    w.week_type === 'regular'
      ? `Week ${w.week_number}`
      : { wildcard: 'Wild Card', divisional: 'Divisional', conference: 'Conference Championship', superbowl: 'Super Bowl' }[w.week_type] ?? w.week_type;

  let games = $state(untrack(() => data.games));
  let users = $state(untrack(() => data.users));
  let selectedYear = $state(untrack(() => data.week.year));
  let selectedWeek = $state(untrack(() => data.week.number));
  let selectedType = $state(untrack(() => data.week.type));
  let loading = $state(false);

  const years = $derived([...new Set(data.availableWeeks.map(w => w.season_year))].sort((a, b) => b - a));
  const weeksForYear = $derived(data.availableWeeks.filter(w => w.season_year === selectedYear));

  async function loadWeek(year, weekNum, weekType) {
    loading = true;
    try {
      const res = await fetch(`/api/picks/compare?year=${year}&week=${weekNum}&weekType=${weekType}`);
      const json = await res.json();
      games = json.games ?? [];
      users = json.users ?? [];
      selectedYear = year;
      selectedWeek = weekNum;
      selectedType = weekType;
    } finally {
      loading = false;
    }
  }

  function pickClass(gameId, userId) {
    const u = users.find(u => u.userId === userId);
    if (!u) return '';
    const p = u.picks[gameId];
    if (!p) return 'no-pick';
    if (p.isCorrect === true) return 'correct';
    if (p.isCorrect === false) return 'incorrect';
    return 'pending';
  }

  function pickIcon(gameId, userId) {
    const u = users.find(u => u.userId === userId);
    if (!u) return '—';
    const p = u.picks[gameId];
    if (!p) return '—';
    const game = games.find(g => g.id === gameId);
    if (!game) return p.predictedWinner;
    return p.predictedWinner === 'home' ? game.home_team_abbr : game.away_team_abbr;
  }

  const currentWeekLabel = $derived(weekLabel({ week_number: selectedWeek, week_type: selectedType }));
</script>

<svelte:head><title>Compare picks · down bad ↓</title></svelte:head>

<div class="db-page">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <h1 class="db-h1" style="flex:1">Compare picks</h1>
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
  {:else if users.length === 0}
    <div class="db-card" style="padding:48px;text-align:center">
      <p style="font-size:40px;margin:0 0 12px">👻</p>
      <p style="font-weight:700;margin:0">No picks submitted yet this week.</p>
    </div>
  {:else}
    <!-- Scoreboard summary -->
    <div class="db-card" style="padding:0;margin-bottom:16px;overflow:hidden">
      {#each users as u, i}
        {@const isMe = u.userId === data.userId}
        <div class="db-compare-row {isMe ? 'me' : ''}">
          <div class="db-rank-chip" style="background:{u.primaryColor ?? 'var(--accent)'}">
            {String(i + 1).padStart(2, '0')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px">
              {u.displayName}{isMe ? ' (you)' : ''}
            </div>
            <div class="db-sub" style="font-size:11px">{u.correct}/{u.total} correct</div>
          </div>
          <div class="db-mono" style="font-size:18px;font-weight:900">{u.correct}</div>
        </div>
      {/each}
    </div>

    <!-- Game-by-game grid -->
    {#if games.length > 0}
      <div class="db-card" style="padding:0;overflow:auto">
        <table class="db-compare-table">
          <thead>
            <tr>
              <th class="db-compare-th sticky-col">Player</th>
              {#each games as game}
                <th class="db-compare-th">
                  <div class="db-game-header">
                    <span>{game.away_team_abbr}</span>
                    <span class="db-sub" style="font-size:9px">@</span>
                    <span>{game.home_team_abbr}</span>
                    {#if game.winner}
                      <div class="db-sub" style="font-size:9px;margin-top:2px">
                        {game.winner === 'home' ? game.home_team_abbr : game.away_team_abbr} W
                      </div>
                    {/if}
                  </div>
                </th>
              {/each}
              <th class="db-compare-th">Score</th>
            </tr>
          </thead>
          <tbody>
            {#each users as u}
              {@const isMe = u.userId === data.userId}
              <tr class={isMe ? 'me-row' : ''}>
                <td class="db-compare-td sticky-col">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="db-mini-avatar" style="background:{u.primaryColor ?? 'var(--accent)'}">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span style="font-size:12px;font-weight:{isMe ? 700 : 500}">
                      {u.displayName.split(' ')[0]}
                    </span>
                  </div>
                </td>
                {#each games as game}
                  <td class="db-compare-td pick-cell {pickClass(game.id, u.userId)}">
                    <span class="db-mono" style="font-size:11px;font-weight:700">
                      {pickIcon(game.id, u.userId)}
                    </span>
                  </td>
                {/each}
                <td class="db-compare-td" style="font-weight:800;font-size:14px;text-align:center">
                  {u.correct}/{u.total}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<style>
  .db-compare-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .db-compare-row:last-child { border-bottom: none; }
  .db-compare-row.me { background: color-mix(in srgb, var(--accent) 6%, var(--card)); }
  .db-rank-chip {
    width: 28px; height: 28px;
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800;
    color: #fff;
    flex-shrink: 0;
  }
  .db-compare-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .db-compare-th {
    padding: 10px 8px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    font-size: 11px;
  }
  .db-compare-td {
    padding: 8px;
    border-bottom: 1px solid var(--border);
    text-align: center;
    vertical-align: middle;
  }
  .sticky-col {
    position: sticky;
    left: 0;
    background: var(--card);
    z-index: 1;
    text-align: left;
    min-width: 110px;
  }
  .db-compare-th.sticky-col { background: var(--bg-2); }
  .pick-cell.correct { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good); }
  .pick-cell.incorrect { background: color-mix(in srgb, var(--bad) 12%, transparent); color: var(--bad); }
  .pick-cell.pending { color: var(--ink-mute); }
  .pick-cell.no-pick { color: var(--ink-mute); opacity: .4; }
  .me-row { background: color-mix(in srgb, var(--accent) 5%, var(--card)); }
  .db-game-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    font-size: 10px;
  }
  .db-mini-avatar {
    width: 20px; height: 20px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800;
    color: #fff;
    flex-shrink: 0;
  }
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
