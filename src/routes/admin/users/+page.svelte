<script>
  let { data } = $props();
</script>

<svelte:head><title>Users · Admin · down bad ↓</title></svelte:head>

<div class="db-page">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
    <a href="/admin" class="db-btn" style="padding:6px 10px;font-size:12px">← Admin</a>
    <h1 class="db-h1">Users</h1>
    <span class="db-pill">{data.users.length}</span>
  </div>

  <div class="db-card" style="padding:0;overflow:hidden">
    {#each data.users as user}
      <div class="db-user-row">
        <div class="db-avatar" style="background:{user.primary_color ?? 'var(--avatar-bg)'}">
          {user.display_name.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px">{user.display_name}</div>
          <div class="db-sub db-mono" style="font-size:11px">{user.username}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          {#if user.is_admin}
            <span class="db-badge admin">Admin</span>
          {/if}
          {#if user.is_commissioner}
            <span class="db-badge commissioner">Commissioner</span>
          {/if}
          {#if user.has_supabase_account}
            <span class="db-badge linked">Linked</span>
          {:else}
            <span class="db-badge unlinked">No account</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .db-user-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .db-user-row:last-child { border-bottom: none; }
  .db-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: .05em;
  }
  .db-badge.admin { background: color-mix(in srgb, var(--accent) 15%, var(--bg-2)); color: var(--accent); }
  .db-badge.commissioner { background: color-mix(in srgb, #f59e0b 15%, var(--bg-2)); color: #f59e0b; }
  .db-badge.linked { background: color-mix(in srgb, var(--good) 15%, var(--bg-2)); color: var(--good); }
  .db-badge.unlinked { background: var(--bg-2); color: var(--ink-mute); }
</style>
