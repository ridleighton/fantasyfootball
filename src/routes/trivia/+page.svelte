<script>
  import GameCard from '$lib/components/trivia/GameCard.svelte';

  let { data } = $props();
</script>

<svelte:head><title>Trivia · down bad ↓</title></svelte:head>

<div class="db-page">
  <div class="page-header">
    <h1 class="db-h1">Trivia</h1>
    <p class="db-sub">Name every player that fits the prompt.</p>
  </div>

  {#if data.games.length === 0}
    <div class="empty-state db-card">
      <span class="ghost">👻</span>
      <p class="empty-title">No games yet.</p>
      <p class="db-sub">Check back soon — games are coming.</p>
    </div>
  {:else}
    <div class="games-grid">
      {#each data.games as game}
        <GameCard {game} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-header {
    margin-bottom: 28px;
  }

  .games-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .empty-state {
    text-align: center;
    padding: 64px 32px;
  }

  .ghost {
    font-size: 52px;
    display: block;
    margin-bottom: 12px;
  }

  .empty-title {
    font-weight: 700;
    font-size: 18px;
    margin: 0 0 6px;
  }
</style>
