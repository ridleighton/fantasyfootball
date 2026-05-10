<script>
  // No data needed; layout handles auth guard.
</script>

<svelte:head><title>Trivia Admin · down bad ↓</title></svelte:head>

<div class="db-page">
  <h1 class="db-h1">Trivia Admin</h1>
  <p class="db-sub" style="margin-bottom:32px">Manage trivia games, databases, and player imports.</p>

  <div class="admin-grid">
    <a href="/trivia/admin/games" class="db-card admin-card">
      <span class="card-icon">🎮</span>
      <h2 class="card-title">Games</h2>
      <p class="db-sub">Create, edit, and publish trivia games. Build answer lists with player search.</p>
      <span class="card-arrow">→</span>
    </a>

    <a href="/trivia/admin/databases" class="db-card admin-card">
      <span class="card-icon">🗄️</span>
      <h2 class="card-title">Databases</h2>
      <p class="db-sub">Manage player databases. Import players via CSV or the API Sports endpoint.</p>
      <span class="card-arrow">→</span>
    </a>
  </div>

  <div style="margin-top:24px">
    <a href="/trivia" class="db-sub" style="text-decoration:none;color:var(--ink-soft)">← Back to trivia lobby</a>
  </div>
</div>

<style>
  .admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  .admin-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 28px 24px;
    text-decoration: none;
    color: inherit;
    transition: transform 0.15s, border-color 0.15s;
    border-radius: 14px;
  }

  .admin-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
  }

  .card-icon {
    font-size: 32px;
    margin-bottom: 4px;
  }

  .card-title {
    font-size: 20px;
    font-weight: 800;
    margin: 0;
    color: var(--ink);
  }

  .card-arrow {
    font-size: 18px;
    color: var(--accent);
    font-weight: 700;
    margin-top: auto;
    padding-top: 12px;
  }
</style>
