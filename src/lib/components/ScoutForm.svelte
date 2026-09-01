<script lang="ts">
  import { eventStore } from "$lib/stores/event.svelte";
  import { scouting } from "$lib/stores/scouting.svelte";
  import { toScheduleRows } from "$lib/features/schedule";
  import { SCOUT_FIELDS, blankValues, type ScoutValues } from "$lib/scouting/schema";

  let { matchKey, team, onNotice, onBack }: {
    matchKey: string;
    team: number | null;
    onNotice: (message: string) => void;
    onBack: () => void;
  } = $props();

  const eventKey = $derived(eventStore.currentEventKey);
  const row = $derived(toScheduleRows(eventStore.matches.data).find((r) => r.key === matchKey));
  const slots = $derived(row ? [...row.red, ...row.blue].map(Number).filter((n) => n > 0) : []);

  let selected = $state<number | null>(null);
  let values = $state<ScoutValues>(blankValues());
  let saving = $state(false);

  // Reset the chosen slot whenever the form is opened for a different match/team.
  $effect(() => {
    matchKey;
    selected = team;
  });

  // Load any existing record whenever the chosen team changes.
  $effect(() => {
    const t = selected;
    if (t === null) return;
    const existing = scouting.entryFor(matchKey, t);
    values = existing?.values ? { ...blankValues(), ...existing.values } : blankValues();
  });

  function bump(key: string, delta: number) {
    values[key] = Math.max(0, Number(values[key] ?? 0) + delta);
  }

  async function save() {
    if (!eventKey || selected === null) return;
    saving = true;
    try {
      await scouting.save(eventKey, matchKey, selected, values);
      onNotice(`Saved ${selected} for ${row?.name ?? matchKey}.`);
      onBack();
    } catch {
      onNotice("Could not save the scouting record.");
    } finally {
      saving = false;
    }
  }
</script>

<div id="scout-form">
  <button class="back" onclick={onBack}>← Back</button>
  <h1>Scout · {row?.name ?? matchKey}</h1>

  <div class="slots">
    {#each slots as slot, i (slot)}
      <button
        class="slot"
        class:red={i < 3}
        class:blue={i >= 3}
        class:active={selected === slot}
        class:scouted={scouting.entryFor(matchKey, slot)}
        onclick={() => (selected = slot)}
      >{slot}</button>
    {/each}
  </div>

  {#if selected === null}
    <p class="scout-note">Pick a team to scout.</p>
  {:else}
    <div class="fields">
      {#each SCOUT_FIELDS as field (field.key)}
        <label class="field">
          <span>{field.label}</span>
          {#if field.type === "counter"}
            <span class="counter">
              <button type="button" onclick={() => bump(field.key, -1)}>−</button>
              <strong>{values[field.key]}</strong>
              <button type="button" onclick={() => bump(field.key, 1)}>+</button>
            </span>
          {:else if field.type === "rating"}
            <span class="rating">
              {#each Array.from({ length: (field.max ?? 3) + 1 }, (_, n) => n) as n (n)}
                <button
                  type="button"
                  class:on={Number(values[field.key]) === n}
                  onclick={() => (values[field.key] = n)}
                >{n}</button>
              {/each}
            </span>
          {:else if field.type === "toggle"}
            <input type="checkbox" checked={Boolean(values[field.key])} onchange={(e) => (values[field.key] = (e.currentTarget as HTMLInputElement).checked)} />
          {:else}
            <textarea rows="2" value={String(values[field.key] ?? "")} onchange={(e) => (values[field.key] = (e.currentTarget as HTMLTextAreaElement).value)}></textarea>
          {/if}
        </label>
      {/each}
    </div>

    <button class="btn-accent save" onclick={save} disabled={saving}>
      {saving ? "Saving…" : "Save record"}
    </button>
  {/if}
</div>

<style>
  #scout-form { padding: 1rem 1.25rem 3rem; overflow-y: auto; height: 100%; max-width: 40rem; }
  .back { background: none; border: none; color: #9a7878; cursor: pointer; font: inherit; padding: 0.25rem 0; }
  .back:hover { color: #f0e8e8; }
  h1 { font-size: 1.3rem; font-weight: 700; color: #f0e8e8; margin: 0.25rem 0 1rem; }
  .slots { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem; }
  .slot {
    min-width: 3.5rem; padding: 0.5rem 0.6rem;
    border: 1px solid #2a1a1a; border-radius: 6px; background: #0a0a0a;
    font: inherit; font-weight: 700; cursor: pointer;
  }
  .slot.red { color: #c97070; }
  .slot.blue { color: #6090c9; }
  .slot.active { background: #1a0f0f; border-color: #cc2200; }
  .slot.scouted::after { content: " ✓"; color: #2f9f4f; }
  .scout-note { color: #9a7878; }
  .fields { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.25rem; }
  .field {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.6rem 0.8rem; background: #111111; border: 1px solid #2a1a1a; border-radius: 8px;
  }
  .field > span:first-child { color: #f0e8e8; }
  .field textarea {
    flex: 1; max-width: 60%; background: #0a0a0a; border: 1px solid #2a1a1a;
    border-radius: 5px; color: #f0e8e8; font: inherit; padding: 0.3rem 0.5rem;
  }
  .counter { display: flex; align-items: center; gap: 0.5rem; }
  .counter button, .rating button {
    width: 1.9rem; height: 1.9rem; border: 1px solid #2a1a1a; border-radius: 5px;
    background: #0a0a0a; color: #f0e8e8; font: inherit; cursor: pointer;
  }
  .counter strong { min-width: 1.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  .rating { display: flex; gap: 0.25rem; }
  .rating button.on { background: #cc2200; border-color: #cc2200; color: #fff; }
  .save { padding: 0.6rem 1.4rem; }
</style>
