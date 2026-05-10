<script>
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  // ---- Form state ----
  let showForm = $state(false);
  let editingGame = $state(null); // null = creating new

  let formTitle = $state('');
  let formPrompt = $state('');
  let formSlug = $state('');
  let formTimeLimit = $state(180);
  let formDatabaseIds = $state([]);
  let formHintFields = $state('');
  let formPublished = $state(false);
  let formAnswers = $state([]); // [{ id, full_name, database_name }]

  // Player search
  let searchQuery = $state('');
  let searchResults = $state([]);
  let searchLoading = $state(false);

  let saving = $state(false);
  let formError = $state('');

  function slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  $effect(() => {
    if (!editingGame && formTitle && !formSlug) {
      formSlug = slugify(formTitle);
    }
  });

  function openCreate() {
    editingGame = null;
    formTitle = '';
    formPrompt = '';
    formSlug = '';
    formTimeLimit = 180;
    formDatabaseIds = [];
    formHintFields = '';
    formPublished = false;
    formAnswers = [];
    searchQuery = '';
    searchResults = [];
    formError = '';
    showForm = true;
  }

  function openEdit(game) {
    editingGame = game;
    formTitle = game.title;
    formPrompt = game.prompt;
    formSlug = game.slug;
    formTimeLimit = game.time_limit_seconds;
    formDatabaseIds = game.database_ids ?? [];
    formHintFields = (game.hint_fields ?? []).join(', ');
    formPublished = game.published;
    formAnswers = []; // Would need separate fetch for existing answers; skip for v1
    searchQuery = '';
    searchResults = [];
    formError = '';
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editingGame = null;
  }

  function toggleDatabase(dbId) {
    if (formDatabaseIds.includes(dbId)) {
      formDatabaseIds = formDatabaseIds.filter(id => id !== dbId);
    } else {
      formDatabaseIds = [...formDatabaseIds, dbId];
    }
  }

  let searchTimer = null;
  $effect(() => {
    if (searchQuery.length < 3) {
      searchResults = [];
      return;
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      searchLoading = true;
      try {
        const dbParam = formDatabaseIds.length > 0 ? `&dbs=${formDatabaseIds.join(',')}` : '';
        const res = await fetch(`/api/trivia/admin/players?q=${encodeURIComponent(searchQuery)}${dbParam}`);
        if (res.ok) searchResults = await res.json();
      } catch (e) {
        console.error(e);
      } finally {
        searchLoading = false;
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  });

  function addAnswer(player) {
    if (formAnswers.find(a => a.id === player.id)) return;
    formAnswers = [...formAnswers, player];
  }

  function removeAnswer(playerId) {
    formAnswers = formAnswers.filter(a => a.id !== playerId);
  }

  async function saveGame() {
    formError = '';
    if (!formTitle.trim() || !formPrompt.trim() || !formSlug.trim()) {
      formError = 'Title, prompt, and slug are required.';
      return;
    }

    saving = true;
    try {
      const hintFieldsArr = formHintFields
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        title: formTitle.trim(),
        prompt: formPrompt.trim(),
        slug: formSlug.trim(),
        time_limit_seconds: Number(formTimeLimit),
        database_ids: formDatabaseIds,
        hint_fields: hintFieldsArr,
        published: formPublished
      };

      let res;
      if (editingGame) {
        res = await fetch(`/api/trivia/admin/games?id=${editingGame.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/trivia/admin/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Server error ${res.status}`);
      }

      const saved = await res.json();

      // If creating and we have answers, add them via the game answers endpoint
      // For v1: update answer list via separate calls would be complex; skip for initial save
      // Answers can be managed via the full answer builder once the game exists.

      await invalidateAll();
      closeForm();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function deleteGame(game) {
    if (!confirm(`Delete "${game.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/trivia/admin/games?id=${game.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await invalidateAll();
    } catch (err) {
      alert(err.message);
    }
  }

  async function togglePublish(game) {
    try {
      const res = await fetch(`/api/trivia/admin/games?id=${game.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !game.published })
      });
      if (!res.ok) throw new Error('Failed to update');
      await invalidateAll();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---- Answer management for existing games ----
  let answerGameId = $state(null);
  let gameAnswers = $state([]);
  let answerHintFields = $state('');
  let answerError = $state('');

  async function openAnswerBuilder(game) {
    answerGameId = game.id;
    answerHintFields = (game.hint_fields ?? []).join(', ');
    formDatabaseIds = game.database_ids ?? [];
    searchQuery = '';
    searchResults = [];
    answerError = '';
    // Load existing answers for this game
    try {
      const res = await fetch(`/api/trivia/admin/game-answers?gameId=${game.id}`);
      if (res.ok) gameAnswers = await res.json();
    } catch (e) {
      gameAnswers = [];
    }
  }

  function closeAnswerBuilder() {
    answerGameId = null;
    gameAnswers = [];
  }

  async function addAnswerToGame(player) {
    if (gameAnswers.find(a => a.player_id === player.id)) return;
    answerError = '';
    try {
      const hintData = {};
      const fields = answerHintFields.split(',').map(s => s.trim()).filter(Boolean);
      fields.forEach(f => {
        if (player.metadata?.[f] !== undefined) hintData[f] = player.metadata[f];
      });

      const res = await fetch('/api/trivia/admin/game-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: answerGameId,
          playerId: player.id,
          hintData,
          sortOrder: gameAnswers.length
        })
      });
      if (!res.ok) throw new Error('Failed to add');
      const added = await res.json();
      gameAnswers = [...gameAnswers, { ...added, full_name: player.full_name }];
    } catch (err) {
      answerError = err.message;
    }
  }

  async function removeAnswerFromGame(answerId) {
    try {
      const res = await fetch(`/api/trivia/admin/game-answers?id=${answerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      gameAnswers = gameAnswers.filter(a => a.id !== answerId);
    } catch (err) {
      answerError = err.message;
    }
  }
</script>

<svelte:head><title>Games Admin · down bad ↓</title></svelte:head>

<div class="db-page">
  <div class="page-header">
    <div>
      <a href="/trivia/admin" class="db-sub back-link">← Admin</a>
      <h1 class="db-h1">Trivia Games</h1>
    </div>
    <button class="db-btn primary" onclick={openCreate}>+ New game</button>
  </div>

  <!-- Games table -->
  {#if data.games.length === 0}
    <div class="db-card empty-state">
      <p class="db-sub">No games yet. Create one to get started.</p>
    </div>
  {:else}
    <div class="games-table db-card">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th class="center">Answers</th>
            <th class="center">Published</th>
            <th class="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.games as game}
            <tr>
              <td>
                <div class="game-title-cell">{game.title}</div>
                <div class="game-prompt-cell db-sub">{game.prompt.slice(0, 60)}{game.prompt.length > 60 ? '…' : ''}</div>
              </td>
              <td class="mono">{game.slug}</td>
              <td class="center">{game.answer_count}</td>
              <td class="center">
                <button
                  class="publish-toggle"
                  class:published={game.published}
                  onclick={() => togglePublish(game)}
                  title={game.published ? 'Published — click to unpublish' : 'Draft — click to publish'}
                >
                  {game.published ? 'Live' : 'Draft'}
                </button>
              </td>
              <td class="right actions-cell">
                <button class="db-btn sm" onclick={() => openAnswerBuilder(game)}>Answers</button>
                <button class="db-btn sm" onclick={() => openEdit(game)}>Edit</button>
                <button class="db-btn sm danger" onclick={() => deleteGame(game)}>Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Create/Edit form panel -->
  {#if showForm}
    <div class="modal-overlay" onclick={closeForm}>
      <div class="modal-panel db-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">{editingGame ? 'Edit game' : 'New game'}</h2>
          <button class="close-btn" onclick={closeForm} aria-label="Close">✕</button>
        </div>

        {#if formError}
          <div class="form-error">{formError}</div>
        {/if}

        <div class="form-grid">
          <label class="db-label" for="form-title">Title</label>
          <input
            id="form-title"
            class="db-input"
            type="text"
            bind:value={formTitle}
            placeholder="e.g. 2023 Super Bowl Roster"
          />

          <label class="db-label" for="form-prompt">Prompt</label>
          <textarea
            id="form-prompt"
            class="db-input form-textarea"
            bind:value={formPrompt}
            placeholder="e.g. Name every player who appeared in Super Bowl LVIII."
          ></textarea>

          <label class="db-label" for="form-slug">Slug</label>
          <input
            id="form-slug"
            class="db-input"
            type="text"
            bind:value={formSlug}
            placeholder="super-bowl-lviii-roster"
          />

          <div class="form-row">
            <div class="form-field">
              <label class="db-label" for="form-time">Time limit (seconds)</label>
              <input
                id="form-time"
                class="db-input"
                type="number"
                bind:value={formTimeLimit}
                min="30"
                max="600"
              />
            </div>
            <div class="form-field check-field">
              <label class="db-label" for="form-published">
                <input id="form-published" type="checkbox" bind:checked={formPublished} />
                Published
              </label>
            </div>
          </div>

          <label class="db-label">Databases</label>
          <div class="db-checkboxes">
            {#each data.databases as db}
              <label class="check-label">
                <input
                  type="checkbox"
                  checked={formDatabaseIds.includes(db.id)}
                  onchange={() => toggleDatabase(db.id)}
                />
                {db.name}
              </label>
            {/each}
          </div>

          <label class="db-label" for="form-hints">Hint fields (comma-separated)</label>
          <input
            id="form-hints"
            class="db-input"
            type="text"
            bind:value={formHintFields}
            placeholder="e.g. position, team, season"
          />
        </div>

        <div class="form-actions">
          <button class="db-btn" onclick={closeForm}>Cancel</button>
          <button class="db-btn primary" onclick={saveGame} disabled={saving}>
            {saving ? 'Saving…' : editingGame ? 'Save changes' : 'Create game'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Answer builder panel -->
  {#if answerGameId !== null}
    {@const currentGame = data.games.find(g => g.id === answerGameId)}
    <div class="modal-overlay" onclick={closeAnswerBuilder}>
      <div class="modal-panel modal-wide db-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">Answers — {currentGame?.title}</h2>
          <button class="close-btn" onclick={closeAnswerBuilder} aria-label="Close">✕</button>
        </div>

        {#if answerError}
          <div class="form-error">{answerError}</div>
        {/if}

        <div class="answer-builder">
          <!-- Left: search -->
          <div class="answer-search-col">
            <label class="db-label" for="answer-search">Search players</label>
            <input
              id="answer-search"
              class="db-input"
              type="text"
              bind:value={searchQuery}
              placeholder="Type 3+ chars…"
            />

            {#if searchLoading}
              <p class="db-sub">Searching…</p>
            {:else if searchResults.length > 0}
              <div class="search-results">
                {#each searchResults as player}
                  <div class="search-result-row">
                    <span class="result-name">{player.full_name}</span>
                    <span class="result-db db-sub">{player.database_name}</span>
                    <button
                      class="db-btn sm"
                      onclick={() => addAnswerToGame(player)}
                      disabled={gameAnswers.some(a => a.player_id === player.id)}
                    >
                      {gameAnswers.some(a => a.player_id === player.id) ? 'Added' : 'Add'}
                    </button>
                  </div>
                {/each}
              </div>
            {:else if searchQuery.length >= 3}
              <p class="db-sub">No results found.</p>
            {/if}
          </div>

          <!-- Right: current answers -->
          <div class="answer-list-col">
            <p class="db-label">Current answers ({gameAnswers.length})</p>
            {#if gameAnswers.length === 0}
              <p class="db-sub">No answers yet.</p>
            {:else}
              <div class="answer-list">
                {#each gameAnswers as answer, i}
                  <div class="answer-item">
                    <span class="answer-num">{i + 1}.</span>
                    <span class="answer-name">{answer.full_name ?? answer.player_name ?? '?'}</span>
                    <button
                      class="db-btn sm danger"
                      onclick={() => removeAnswerFromGame(answer.id)}
                      aria-label="Remove"
                    >✕</button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .back-link {
    display: block;
    margin-bottom: 4px;
    text-decoration: none;
    color: var(--ink-soft);
  }

  .games-table {
    padding: 0;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--line);
  }

  th {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-soft);
    background: var(--bg-2);
  }

  tr:last-child td { border-bottom: none; }

  .center { text-align: center; }
  .right { text-align: right; }
  .mono { font-family: var(--font-mono); font-size: 12px; }

  .game-title-cell { font-weight: 700; font-size: 14px; }
  .game-prompt-cell { font-size: 12px; margin-top: 2px; }

  .publish-toggle {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1.5px solid var(--line);
    background: var(--bg-2);
    color: var(--ink-soft);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .publish-toggle.published {
    border-color: var(--good);
    color: var(--good);
    background: color-mix(in srgb, var(--good) 10%, var(--bg-2));
  }

  .actions-cell {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    align-items: center;
  }

  .empty-state {
    text-align: center;
    padding: 48px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px;
    z-index: 100;
    overflow-y: auto;
  }

  .modal-panel {
    width: 100%;
    max-width: 560px;
    border-radius: 16px;
    padding: 28px;
  }

  .modal-wide {
    max-width: 820px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .modal-title {
    font-size: 18px;
    font-weight: 800;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--ink-soft);
    padding: 4px 8px;
    border-radius: 6px;
  }

  .close-btn:hover { color: var(--ink); background: var(--bg-2); }

  .form-error {
    background: color-mix(in srgb, var(--bad) 12%, var(--card));
    border: 1px solid var(--bad);
    color: var(--bad);
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .form-textarea {
    min-height: 80px;
    resize: vertical;
  }

  .form-row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .form-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }

  .check-field {
    flex: 0;
    white-space: nowrap;
    padding-bottom: 10px;
  }

  .db-checkboxes {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .check-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  /* Answer builder */
  .answer-builder {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 600px) {
    .answer-builder { grid-template-columns: 1fr; }
  }

  .answer-search-col, .answer-list-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .search-results {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 4px;
  }

  .search-result-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
  }

  .search-result-row:hover { background: var(--bg-2); }

  .result-name { flex: 1; font-size: 13px; font-weight: 600; }
  .result-db { font-size: 11px; flex-shrink: 0; }

  .answer-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 360px;
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 4px;
  }

  .answer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
  }

  .answer-item:hover { background: var(--bg-2); }

  .answer-num { font-size: 11px; color: var(--ink-soft); width: 20px; flex-shrink: 0; }
  .answer-name { flex: 1; font-size: 13px; font-weight: 600; }

  /* small btn variant */
  :global(.db-btn.sm) {
    padding: 4px 10px;
    font-size: 12px;
    height: auto;
  }

  :global(.db-btn.danger) {
    border-color: var(--bad);
    color: var(--bad);
  }

  :global(.db-btn.danger:hover) {
    background: color-mix(in srgb, var(--bad) 12%, var(--card));
  }
</style>
