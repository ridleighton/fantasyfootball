<script>
  let { data } = $props();

  const weekLabel = $derived(
    data.week.type === 'regular'
      ? `Week ${data.week.number}`
      : { wildcard: 'Wild Card', divisional: 'Divisional', conference: 'Conference Championship', superbowl: 'Super Bowl' }[data.week.type] ?? data.week.type
  );

  const leader = $derived(data.leaderboard[0]);
  const maxPts = $derived(leader?.points || 1);
  const rankClass = (r) => r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '';
</script>

<svelte:head><title>Home · down bad ↓</title></svelte:head>

<div class="db-page">
  <!-- Hero row -->
  <div class="db-home-grid" style="margin-bottom:20px">
    <div class="db-card" style="padding:22px;display:flex;gap:18px;align-items:center">
      <div style="font-size:80px;flex-shrink:0;text-align:center;line-height:1">🏆</div>
      <div style="flex:1;min-width:0">
        <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:11px">
          {weekLabel} leader
        </p>
        <h1 class="db-h1 db-italic" style="margin-top:6px">
          {leader?.display_name ?? '—'}
        </h1>
        <p class="db-sub" style="margin-top:6px;line-height:1.5">
          {leader?.points ?? 0} pts · {data.week.year} Season
        </p>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
          <a href="/picks" class="db-btn primary">Make your picks →</a>
          <a href="/compare" class="db-btn">Compare picks</a>
        </div>
      </div>
    </div>

    <div class="db-card" style="padding:22px">
      <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:11px">
        this week
      </p>
      <h2 class="db-h1" style="margin-top:6px;font-size:22px">{data.week.year} · {weekLabel}</h2>
      <p class="db-sub">{data.leaderboard.length} players in the league</p>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <a href="/picks" class="db-btn primary lg" style="flex:1;justify-content:center">Pick'ems →</a>
        <a href="/games" class="db-btn lg">Games</a>
      </div>
    </div>
  </div>

  <!-- Leaderboard + side -->
  <div class="db-home-lower">
    <div class="db-card">
      <div class="db-card-h">
        {weekLabel} leaderboard
        <span class="db-pill">{data.week.year}</span>
      </div>

      {#if data.leaderboard.length === 0}
        <div style="padding:32px;text-align:center;color:var(--ink-mute)">
          <p style="font-size:32px;margin:0 0 8px">👻</p>
          <p style="margin:0;font-weight:600">No picks yet this week.</p>
        </div>
      {:else}
        {#each data.leaderboard as row}
          <div class="db-leader-row">
            <div class="db-rank {rankClass(row.rank)}">{String(row.rank).padStart(2, '0')}</div>
            <div class="db-avatar" style="background:{row.primary_color ?? 'var(--avatar-bg)'}">
              {row.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="db-name">{row.display_name}</div>
              <div class="db-record db-mono">{row.wins}-{row.losses}</div>
              <div class="db-bar">
                <span style="width:{Math.round((row.points / maxPts) * 100)}%"></span>
              </div>
            </div>
            <div></div>
            <div class="db-points">{row.points}</div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="db-side-cards">
      <div class="db-card" style="padding:18px">
        <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700">compare</p>
        <p style="margin:6px 0 10px;font-weight:700">See how your picks stack up against everyone else.</p>
        <a href="/compare" class="db-btn" style="height:32px;font-size:12px">Compare →</a>
      </div>
      <div class="db-card" style="padding:18px">
        <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700">schedule</p>
        <p style="margin:6px 0 10px;font-weight:700">Live scores and this week's full game schedule.</p>
        <a href="/games" class="db-btn" style="height:32px;font-size:12px">Games →</a>
      </div>
    </div>
  </div>
</div>
