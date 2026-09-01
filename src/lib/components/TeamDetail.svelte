<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import { eventStore } from "$lib/stores/event.svelte";
  import { buildTeamStats } from "$lib/features/tba-stats";
  import { toScheduleRows } from "$lib/features/schedule";
  import { getTeamNote, putTeamNote } from "$lib/api/notes";

  let { team, onNotice, onBack, onAddToPicklist }: {
    team: number;
    onNotice: (message: string) => void;
    onBack: () => void;
    onAddToPicklist: (team: number) => void;
  } = $props();

  const stats = $derived(
    buildTeamStats(eventStore.teams.data, eventStore.rankings.data, eventStore.oprs.data, eventStore.coprs.data),
  );
  const row = $derived(stats.rows.find((r) => r.team === team));
  const eventKey = $derived(eventStore.currentEventKey);
  const eventYear = $derived(eventKey ? Number(eventKey.slice(0, 4)) || undefined : undefined);
  const matches = $derived(
    toScheduleRows(eventStore.matches.data).filter(
      (m) => m.red.includes(String(team)) || m.blue.includes(String(team)),
    ),
  );

  let note = $state("");
  let noteLoaded = $state(false);
  let savingNote = $state(false);
  let showComponents = $state(false);

  $effect(() => {
    const key = eventKey;
    if (!key) return;
    noteLoaded = false;
    void getTeamNote(key, team)
      .then((result) => { note = result.body; })
      .catch(() => { /* leave blank */ })
      .finally(() => { noteLoaded = true; });
  });

  async function saveNote() {
    if (!eventKey) return;
    savingNote = true;
    try {
      await putTeamNote(eventKey, team, note);
    } catch {
      onNotice("Could not save the note.");
    } finally {
      savingNote = false;
    }
  }

  async function openBoard(match: (typeof matches)[number]) {
    if (!eventKey) return;
    try {
      await app.openMatchByTbaKey(match.key, match.red, match.blue, match.name, eventKey, eventYear);
    } catch {
      onNotice("Could not open the whiteboard.");
    }
  }

  const fixed = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value.toFixed(1));
</script>

<div id="team-detail">
  <button class="back" onclick={onBack}>← Teams</button>

  <header class="td-header">
    <h1>{team}<span>{row?.nickname ?? ""}</span></h1>
    <div class="td-sub">
      {#if row?.rank}Rank {row.rank} · {/if}{row ? `${row.wins}-${row.losses}-${row.ties}` : ""}
    </div>
    <button class="btn-accent add-pick" onclick={() => onAddToPicklist(team)}>Add to pick list</button>
  </header>

  <section class="cards">
    <div class="card"><span>{stats.rankLabel}</span><strong>{fixed(row?.rankingScore)}</strong></div>
    <div class="card"><span>OPR</span><strong>{fixed(row?.opr)}</strong></div>
    <div class="card"><span>DPR</span><strong>{fixed(row?.dpr)}</strong></div>
    <div class="card"><span>CCWM</span><strong>{fixed(row?.ccwm)}</strong></div>
    {#if showComponents}
      {#each stats.componentNames as name (name)}
        <div class="card"><span>{name}</span><strong>{fixed(row?.components[name] ?? null)}</strong></div>
      {/each}
    {/if}
    {#if stats.componentNames.length}
      <button class="card card-toggle" onclick={() => (showComponents = !showComponents)}>
        {showComponents ? "Fewer" : `+${stats.componentNames.length} more`}
      </button>
    {/if}
  </section>

  <section class="notes">
    <h2>Notes <small>shared across 4143 &amp; 4423 at this event</small></h2>
    <textarea
      bind:value={note}
      disabled={!noteLoaded}
      placeholder={noteLoaded ? "What should we know about this team?" : "Loading…"}
      onblur={saveNote}
    ></textarea>
    <button class="btn-secondary" onclick={saveNote} disabled={savingNote || !noteLoaded}>
      {savingNote ? "Saving…" : "Save note"}
    </button>
  </section>

  <section class="td-matches">
    <h2>Matches</h2>
    {#if matches.length === 0}
      <p class="td-note">No matches for this team yet.</p>
    {:else}
      <ul>
        {#each matches as match (match.key)}
          <li>
            <span class="m-name">{match.name}</span>
            <span class="m-teams">
              <span class="red">{match.red.join(" ")}</span>
              {#if match.completed}<span class="m-score">{match.redScore}–{match.blueScore}</span>{:else}<span class="m-vs">vs</span>{/if}
              <span class="blue">{match.blue.join(" ")}</span>
            </span>
            <button class="btn-secondary" onclick={() => openBoard(match)}>Whiteboard</button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  #team-detail { padding: 1rem 1.25rem 3rem; overflow-y: auto; height: 100%; }
  .back { background: none; border: none; color: #9a7878; cursor: pointer; font: inherit; padding: 0.25rem 0; }
  .back:hover { color: #f0e8e8; }
  .td-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 1rem; margin: 0.25rem 0 1.25rem; }
  .td-header h1 { font-size: 1.6rem; font-weight: 800; color: #f0e8e8; }
  .td-header h1 span { font-size: 1rem; font-weight: 500; color: #9a7878; margin-left: 0.6rem; }
  .td-sub { color: #9a7878; }
  .add-pick { margin-left: auto; padding: 0.5rem 1rem; }
  .cards { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.5rem; }
  .card {
    display: flex; flex-direction: column; gap: 0.2rem;
    min-width: 6rem; padding: 0.7rem 0.9rem;
    background: #111111; border: 1px solid #2a1a1a; border-radius: 8px;
  }
  .card span { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #9a7878; }
  .card strong { font-size: 1.2rem; color: #f0e8e8; font-variant-numeric: tabular-nums; }
  .card-toggle { align-items: center; justify-content: center; color: #9a7878; font: inherit; cursor: pointer; }
  .card-toggle:hover { color: #f0e8e8; }
  section h2 { font-size: 1rem; color: #f0e8e8; margin-bottom: 0.5rem; }
  section h2 small { font-weight: 400; color: #9a7878; font-size: 0.75rem; margin-left: 0.5rem; }
  .notes { margin-bottom: 1.5rem; }
  .notes textarea {
    width: 100%; min-height: 5rem; resize: vertical;
    padding: 0.6rem 0.75rem; background: #0a0a0a; border: 1px solid #2a1a1a;
    border-radius: 6px; color: #f0e8e8; font: inherit;
  }
  .notes button { margin-top: 0.5rem; padding: 0.4rem 0.9rem; }
  .td-matches ul { display: flex; flex-direction: column; gap: 0.35rem; }
  .td-matches li {
    display: grid; grid-template-columns: 6rem 1fr 7rem; align-items: center; gap: 0.75rem;
    padding: 0.5rem 0.8rem; background: #111111; border: 1px solid #2a1a1a; border-radius: 8px;
  }
  .m-name { font-weight: 600; color: #f0e8e8; }
  .m-teams { display: flex; gap: 0.6rem; align-items: baseline; overflow: hidden; }
  .m-teams .red { color: #c97070; }
  .m-teams .blue { color: #6090c9; }
  .m-score { color: #f0e8e8; font-variant-numeric: tabular-nums; }
  .m-vs { color: #9a7878; }
  .td-note { color: #9a7878; }
</style>
