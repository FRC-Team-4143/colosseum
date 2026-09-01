<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import { eventStore } from "$lib/stores/event.svelte";
  import { toScheduleRows } from "$lib/features/schedule";

  let { workspace, onNotice, onChangeEvent }: {
    workspace: number;
    onNotice: (message: string) => void;
    onChangeEvent: () => void;
  } = $props();

  const rows = $derived(toScheduleRows(eventStore.matches.data));
  const info = $derived((eventStore.event.data ?? {}) as Record<string, unknown>);
  const eventYear = $derived(
    eventStore.currentEventKey ? Number(eventStore.currentEventKey.slice(0, 4)) || undefined : undefined,
  );

  const isOurs = (team: string) => Number(team) === workspace;

  async function openBoard(row: ReturnType<typeof toScheduleRows>[number]) {
    if (!eventStore.currentEventKey) return;
    try {
      await app.openMatchByTbaKey(row.key, row.red, row.blue, row.name, eventStore.currentEventKey, eventYear);
    } catch {
      onNotice("Could not open the whiteboard for that match.");
    }
  }
</script>

{#if !eventStore.currentEventKey}
  <div class="schedule-empty">
    <p>No event selected for team {workspace}.</p>
    <button class="btn-accent px-6 py-3" onclick={onChangeEvent}>Choose an event</button>
  </div>
{:else}
  <div id="schedule-view">
    <header class="schedule-header">
      <h1>{(info.name as string) ?? eventStore.currentEventKey}</h1>
      <p>
        {[info.city, info.state_prov, info.country].filter(Boolean).join(", ")}
        {#if info.start_date}· {info.start_date}{#if info.end_date && info.end_date !== info.start_date}–{info.end_date}{/if}{/if}
      </p>
    </header>

    {#if eventStore.matches.loading}
      <p class="schedule-note">Loading the schedule…</p>
    {:else if eventStore.matches.error}
      <p class="schedule-note error">{eventStore.matches.error}</p>
    {:else if rows.length === 0}
      <p class="schedule-note">No matches posted yet.</p>
    {:else}
      <ul class="schedule-list">
        {#each rows as row (row.key)}
          <li class="schedule-row" class:done={row.completed}>
            <span class="row-name">{row.name}</span>
            <span class="row-alliance red">
              {#each row.red as team, i}{#if i > 0}{" "}{/if}<span class:ours={isOurs(team)}>{team}</span>{/each}
            </span>
            <span class="row-score">
              {#if row.completed}
                <span class:win={row.winner === "red"}>{row.redScore}</span>
                –
                <span class:win={row.winner === "blue"}>{row.blueScore}</span>
              {:else}
                <span class="vs">vs</span>
              {/if}
            </span>
            <span class="row-alliance blue">
              {#each row.blue as team, i}{#if i > 0}{" "}{/if}<span class:ours={isOurs(team)}>{team}</span>{/each}
            </span>
            <button class="btn-secondary row-board" onclick={() => openBoard(row)}>Whiteboard</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .schedule-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 1rem;
    color: #9a7878;
    text-align: center;
  }
  #schedule-view { padding: 1.25rem 1rem 3rem; overflow-y: auto; height: 100%; }
  .schedule-header h1 { font-size: 1.4rem; font-weight: 700; color: #f0e8e8; }
  .schedule-header p { color: #9a7878; font-size: 0.9rem; margin-top: 0.15rem; }
  .schedule-note { color: #9a7878; padding: 1.5rem 0; }
  .schedule-note.error { color: #e0857a; }
  .schedule-list { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 1rem; }
  .schedule-row {
    display: grid;
    grid-template-columns: 6rem 1fr 4.5rem 1fr 7rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    background: #111111;
    border: 1px solid #2a1a1a;
    border-radius: 8px;
  }
  .schedule-row.done { opacity: 0.85; }
  .row-name { font-weight: 600; color: #f0e8e8; }
  .row-alliance { font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-alliance.red { text-align: right; color: #c97070; }
  .row-alliance.blue { text-align: left; color: #6090c9; }
  .row-alliance .ours { font-weight: 800; text-decoration: underline; }
  .row-score { text-align: center; color: #f0e8e8; font-variant-numeric: tabular-nums; }
  .row-score .vs { color: #9a7878; }
  .row-score .win { font-weight: 800; }
  .row-board { padding: 0.35rem 0.5rem; font-size: 0.85rem; }
  @media (max-width: 720px) {
    .schedule-row { grid-template-columns: 1fr auto; grid-auto-rows: auto; }
    .row-board { grid-column: 2; grid-row: 1 / span 3; }
  }
</style>
