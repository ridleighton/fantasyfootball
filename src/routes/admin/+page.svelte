<script>
  let { data } = $props();

  let syncing = $state(false);
  let syncResult = $state('');
  let syncError = $state('');

  let syncYear = $state(new Date().getFullYear());
  let syncWeek = $state(1);
  let syncType = $state('regular');

  async function syncGames() {
    syncing = true;
    syncResult = '';
    syncError = '';
    try {
      const res = await fetch('/api/admin/sync/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: syncWeek, year: syncYear, weekType: syncType })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Sync failed');
      syncResult = json.message ?? `Synced ${json.synced ?? '?'} games`;
    } catch (err) {
      syncError = err.message;
    } finally {
      syncing = false;
    }
  }
</script>

<svelte:head><title>Admin · down bad ↓</title></svelte:head>

<div class="db-page">
  <div class="db-card-h" style="margin-bottom:20px">Admin</div>

  <div class="db-home-grid">
    <!-- Game sync card -->
    <div class="db-card" style="padding:22px">
      <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700;margin-bottom:12px">
        Sync games
      </p>

      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:80px">
          <label class="db-label" for="syncYear">Year</label>
          <input id="syncYear" type="number" class="db-input" bind:value={syncYear} min="2020" max="2030" />
        </div>
        <div style="flex:1;min-width:80px">
          <label class="db-label" for="syncType">Type</label>
          <select id="syncType" class="db-input" bind:value={syncType}>
            <option value="regular">Regular</option>
            <option value="wildcard">Wild Card</option>
            <option value="divisional">Divisional</option>
            <option value="conference">Conference</option>
            <option value="superbowl">Super Bowl</option>
          </select>
        </div>
        {#if syncType === 'regular'}
          <div style="flex:1;min-width:80px">
            <label class="db-label" for="syncWeek">Week</label>
            <input id="syncWeek" type="number" class="db-input" bind:value={syncWeek} min="1" max="18" />
          </div>
        {/if}
      </div>

      {#if syncResult}
        <p style="color:var(--good);font-size:13px;font-weight:600;margin-bottom:10px">{syncResult}</p>
      {/if}
      {#if syncError}
        <p style="color:var(--bad);font-size:13px;font-weight:600;margin-bottom:10px">{syncError}</p>
      {/if}

      <button class="db-btn primary" onclick={syncGames} disabled={syncing}>
        {syncing ? 'Syncing…' : 'Sync games →'}
      </button>
    </div>

    <!-- Quick links -->
    <div class="db-card" style="padding:22px">
      <p class="db-sub" style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700;margin-bottom:12px">
        Manage
      </p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <a href="/admin/users" class="db-btn">Manage users →</a>
      </div>
    </div>
  </div>
</div>
