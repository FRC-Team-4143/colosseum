<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import { eventStore } from "$lib/stores/event.svelte";
  import { buildTeamStats, sortRows, type SortKey } from "$lib/features/tba-stats";

  let { onAddToPicklist }: { onAddToPicklist: (team: number) => void } = $props();

  let sortKey = $state<SortKey>("rank");
  let sortDir = $state<"asc" | "desc">("asc");
  let filter = $state("");
  let showComponents = $state(false);

  const stats = $derived(
    buildTeamStats(eventStore.teams.data, eventStore.rankings.data, eventStore.oprs.data, eventStore.coprs.data),
  );
  const componentColumns = $derived(showComponents ? stats.componentNames : []);
  const visible = $derived(
    sortRows(
      stats.rows.filter((row) => {
        const q = filter.trim().toLowerCase();
        return !q || String(row.team).includes(q) || row.nickname.toLowerCase().includes(q);
      }),
      sortKey,
      sortDir,
    ),
  );

  const loading = $derived(eventStore.teams.loading || eventStore.rankings.loading || eventStore.oprs.loading);

  function sortBy(key: SortKey, defaultDir: "asc" | "desc" = "desc") {
    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortKey = key; sortDir = defaultDir; }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const fixed = (value: number | null) => (value === null ? "—" : value.toFixed(1));
</script>

{#if !eventStore.currentEventKey}
  <div class="teams-empty">Choose an event to see team stats.</div>
{:else}
  <div id="teams-view">
    <div class="teams-controls">
      <input class="teams-filter" placeholder="Filter by number or name…" bind:value={filter} />
      {#if stats.componentNames.length}
        <button class="teams-toggle" onclick={() => (showComponents = !showComponents)}>
          {showComponents ? "Hide" : "Show"} {stats.componentNames.length} detail columns
        </button>
      {/if}
    </div>

    {#if loading && stats.rows.length === 0}
      <p class="teams-note">Loading team stats…</p>
    {:else if stats.rows.length === 0}
      <p class="teams-note">No teams listed for this event yet.</p>
    {:else}
      <div class="teams-scroll">
        <table>
          <thead>
            <tr>
              <th class="num" onclick={() => sortBy("rank", "asc")}>Rank{arrow("rank")}</th>
              <th onclick={() => sortBy("team", "asc")}>Team{arrow("team")}</th>
              <th onclick={() => sortBy("nickname", "asc")}>Name{arrow("nickname")}</th>
              <th class="num" onclick={() => sortBy("record")}>W-L-T{arrow("record")}</th>
              <th class="num" onclick={() => sortBy("rankingScore")}>{stats.rankLabel}{arrow("rankingScore")}</th>
              <th class="num" onclick={() => sortBy("opr")}>OPR{arrow("opr")}</th>
              <th class="num" onclick={() => sortBy("dpr")}>DPR{arrow("dpr")}</th>
              <th class="num" onclick={() => sortBy("ccwm")}>CCWM{arrow("ccwm")}</th>
              {#each componentColumns as name (name)}
                <th class="num" onclick={() => sortBy(`component:${name}`)}>{name}{arrow(`component:${name}`)}</th>
              {/each}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each visible as row (row.team)}
              <tr onclick={() => app.openTeam(row.team)}>
                <td class="num">{row.rank ?? "—"}</td>
                <td class="team-num">{row.team}</td>
                <td class="nick">{row.nickname}</td>
                <td class="num">{row.wins}-{row.losses}-{row.ties}</td>
                <td class="num">{fixed(row.rankingScore)}</td>
                <td class="num">{fixed(row.opr)}</td>
                <td class="num">{fixed(row.dpr)}</td>
                <td class="num">{fixed(row.ccwm)}</td>
                {#each componentColumns as name (name)}
                  <td class="num">{fixed(row.components[name] ?? null)}</td>
                {/each}
                <td class="add">
                  <button
                    title="Add to pick list"
                    onclick={(event) => { event.stopPropagation(); onAddToPicklist(row.team); }}
                  >＋</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/if}

<style>
  .teams-empty, .teams-note { padding: 3rem 1rem; text-align: center; color: #9a7878; }
  #teams-view { display: flex; flex-direction: column; min-height: 0; height: 100%; padding: 1rem; }
  .teams-controls { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
  .teams-filter {
    width: min(20rem, 100%);
    padding: 0.5rem 0.75rem;
    background: #0a0a0a;
    border: 1px solid #2a1a1a;
    border-radius: 6px;
    color: #f0e8e8;
  }
  .teams-toggle {
    padding: 0.5rem 0.9rem;
    background: #0a0a0a;
    border: 1px solid #2a1a1a;
    border-radius: 6px;
    color: #9a7878;
    font: inherit;
    cursor: pointer;
  }
  .teams-toggle:hover { color: #f0e8e8; }
  .teams-scroll { overflow: auto; border: 1px solid #2a1a1a; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
  th, td { padding: 0.45rem 0.7rem; text-align: left; white-space: nowrap; }
  th {
    position: sticky;
    top: 0;
    background: #111111;
    color: #9a7878;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid #2a1a1a;
  }
  th:hover { color: #f0e8e8; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr { border-bottom: 1px solid #1a0f0f; cursor: pointer; }
  tbody tr:hover { background: #141414; }
  .team-num { font-weight: 700; color: #f0e8e8; }
  .nick { color: #f0e8e8; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; }
  td.add { text-align: center; }
  td.add button {
    width: 1.7rem;
    height: 1.7rem;
    border: 1px solid #2a1a1a;
    border-radius: 5px;
    background: #0a0a0a;
    color: #cc2200;
    font-weight: 700;
    cursor: pointer;
  }
</style>
