<script lang="ts">
  import { eventStore } from "$lib/stores/event.svelte";
  import { pickList } from "$lib/stores/picklist.svelte";
  import type { PickTag } from "$lib/api/picklist";

  let { onNotice }: { onNotice: (message: string) => void } = $props();

  let addValue = $state("");

  const eventKey = $derived(eventStore.currentEventKey);
  const teamOptions = $derived(
    ((eventStore.teams.data ?? []) as Array<{ key: string; team_number: number; nickname?: string | null }>),
  );

  $effect(() => {
    void pickList.load(eventKey);
  });

  const nicknames = $derived(() => {
    const map = new Map<number, string>();
    for (const team of (eventStore.teams.data ?? []) as Array<Record<string, unknown>>) {
      map.set(Number(team.team_number), (team.nickname as string) || String(team.team_number));
    }
    return map;
  });

  const rows = $derived(
    pickList.entries.map((entry) => ({ ...entry, nickname: nicknames().get(entry.team) ?? "" })),
  );

  async function guard(op: () => Promise<void>) {
    try {
      await op();
    } catch {
      onNotice("The pick list change did not save.");
    }
  }

  async function submitAdd(event: SubmitEvent) {
    event.preventDefault();
    const team = Number(addValue.trim());
    if (!eventKey || !Number.isInteger(team) || team <= 0) return;
    addValue = "";
    await guard(() => pickList.add(eventKey, team));
  }

  const cycleTag = (current: PickTag): PickTag =>
    current === "" ? "picked" : current === "picked" ? "dnp" : "";
</script>

{#if !eventKey}
  <div class="pl-empty">Choose an event to build a pick list.</div>
{:else}
  <div id="pick-list">
    <form class="pl-add" onsubmit={submitAdd}>
      <input
        list="pl-team-options"
        placeholder="Add a team number…"
        inputmode="numeric"
        bind:value={addValue}
      />
      <datalist id="pl-team-options">
        {#each teamOptions as team (team.key)}
          <option value={team.team_number}>{team.team_number} — {team.nickname ?? ""}</option>
        {/each}
      </datalist>
      <button class="btn-accent" type="submit">Add</button>
    </form>

    {#if pickList.error}<p class="pl-error">{pickList.error}</p>{/if}

    {#if rows.length === 0}
      <p class="pl-note">Nothing here yet. Add teams above, or use the ＋ on the Teams tab.</p>
    {:else}
      <ol class="pl-rows">
        {#each rows as row, index (row.team)}
          <li class="pl-row" class:picked={row.tag === "picked"} class:dnp={row.tag === "dnp"}>
            <span class="pl-pos">{index + 1}</span>
            <span class="pl-team">
              <strong>{row.team}</strong>
              <span class="pl-nick">{row.nickname}</span>
            </span>
            <input
              class="pl-note-input"
              placeholder="note"
              value={row.note}
              onchange={(e) => guard(() => pickList.setNote(eventKey, row.team, (e.currentTarget as HTMLInputElement).value))}
            />
            <span class="pl-actions">
              <button title="Move up" disabled={index === 0} onclick={() => guard(() => pickList.move(eventKey, row.team, -1))}>▲</button>
              <button title="Move down" disabled={index === rows.length - 1} onclick={() => guard(() => pickList.move(eventKey, row.team, 1))}>▼</button>
              <button
                class="pl-tag"
                title="Picked / do-not-pick / clear"
                onclick={() => guard(() => pickList.setTag(eventKey, row.team, cycleTag(row.tag)))}
              >
                {row.tag === "picked" ? "✓ picked" : row.tag === "dnp" ? "✗ DNP" : "tag"}
              </button>
              <button class="pl-remove" title="Remove" onclick={() => guard(() => pickList.remove(eventKey, row.team))}>✕</button>
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
{/if}

<style>
  .pl-empty, .pl-note { padding: 3rem 1rem; text-align: center; color: #9a7878; }
  #pick-list { padding: 1rem 1.25rem 3rem; overflow-y: auto; height: 100%; }
  .pl-add { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .pl-add input {
    width: min(18rem, 100%);
    padding: 0.5rem 0.75rem;
    background: #0a0a0a; border: 1px solid #2a1a1a; border-radius: 6px; color: #f0e8e8;
  }
  .pl-add button { padding: 0.5rem 1rem; }
  .pl-error { color: #e0857a; margin-bottom: 0.5rem; }
  .pl-rows { display: flex; flex-direction: column; gap: 0.4rem; }
  .pl-row {
    display: grid;
    grid-template-columns: 2rem minmax(8rem, 1fr) minmax(6rem, 2fr) auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: #111111; border: 1px solid #2a1a1a; border-radius: 8px;
  }
  .pl-row.picked { border-color: #2f6f3f; }
  .pl-row.dnp { opacity: 0.55; }
  .pl-pos { color: #9a7878; text-align: right; font-variant-numeric: tabular-nums; }
  .pl-team strong { color: #f0e8e8; }
  .pl-nick { color: #9a7878; margin-left: 0.4rem; font-size: 0.85rem; }
  .pl-note-input {
    width: 100%;
    padding: 0.35rem 0.5rem;
    background: #0a0a0a; border: 1px solid #2a1a1a; border-radius: 5px; color: #f0e8e8;
  }
  .pl-actions { display: flex; gap: 0.25rem; }
  .pl-actions button {
    padding: 0.3rem 0.5rem;
    background: #0a0a0a; border: 1px solid #2a1a1a; border-radius: 5px;
    color: #9a7878; font: inherit; cursor: pointer;
  }
  .pl-actions button:hover:not(:disabled) { color: #f0e8e8; }
  .pl-actions button:disabled { opacity: 0.3; cursor: default; }
  .pl-tag { min-width: 4.5rem; }
  .pl-remove { color: #cc2200 !important; }
</style>
