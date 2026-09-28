<script lang="ts">
  import Modal from "./Modal.svelte";
  import { native } from "$lib/native/api";
  import type { TbaSimpleEvent } from "$lib/native/types";

  let { open, current, onSelect, onClose }: {
    open: boolean;
    current: string | null;
    onSelect: (eventKey: string) => void | Promise<void>;
    onClose: () => void;
  } = $props();

  const FIRST_YEAR = 2025;

  let events = $state<TbaSimpleEvent[]>([]);
  let search = $state("");
  let status = $state<{ message: string; isError: boolean } | null>(null);
  let loaded = false;

  const filtered = $derived(
    events.filter((event) =>
      `${event.name} ${event.location} ${event.key}`.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );

  $effect(() => {
    if (!open || loaded) return;
    loaded = true;
    void loadEvents();
  });

  async function loadEvents() {
    status = { message: "Loading events…", isError: false };
    try {
      const years: number[] = [];
      for (let year = Math.max(FIRST_YEAR, new Date().getFullYear()); year >= FIRST_YEAR; year--) years.push(year);
      const fetched = await Promise.all(
        years.map((year) => native.tba.events(year).then((list) => native.tba.simpleEvents(list))),
      );
      events = fetched.flat().sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
      status = null;
    } catch {
      status = { message: "Failed to load events.", isError: true };
    }
  }

  async function choose(event: TbaSimpleEvent) {
    await onSelect(event.key);
    onClose();
  }
</script>

<Modal
  {open}
  id="event-picker-container"
  layer=""
  title="Choose an event"
  panelClass="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col w-11/12 sm:w-3/4 md:w-2/3 lg:w-1/2 max-w-2xl bg-[#111111] border border-[#2a1a1a] rounded-[6px] max-h-[90vh] overflow-hidden"
  {onClose}
>
  <div class="w-full px-6 py-4 text-base text-center text-[#f0e8e8] font-semibold flex-shrink-0 bg-[#111111] border-b border-[#2a1a1a]">
    Choose an event
  </div>
  <div class="w-full flex-1 overflow-y-auto">
    <div class="w-full px-6 pt-4 pb-2">
      <input
        id="event-picker-search"
        placeholder="Search events…"
        class="w-full p-3 text-sm text-center text-[#f0e8e8] rounded-[6px] bg-[#0a0a0a] border border-[#2a1a1a] outline-0"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        bind:value={search}
      />
    </div>
    <div id="event-picker-list" class="flex flex-col px-6 pb-4">
      {#each filtered as event (event.key)}
        <div
          class="tba-dropdown-item"
          class:selected={current === event.key}
          role="button"
          tabindex="0"
          onclick={() => choose(event)}
          onkeydown={(keyEvent) => { if (keyEvent.key === "Enter") choose(event); }}
        >
          <div class="tba-event-name">{event.name}</div>
          <div class="tba-event-details">{event.location} • {event.date_range} • {event.year}</div>
        </div>
      {/each}
    </div>
    {#if status}
      <div id="event-picker-status" class="w-full px-8 pb-4 text-center {status.isError ? 'text-[#e0857a]' : 'text-[#9a7878]'}">
        {status.message}
      </div>
    {/if}
  </div>
  <div class="flex w-full flex-shrink-0">
    <button
      id="event-picker-cancel"
      class="w-full text-center text-sm btn-secondary p-4 border-t border-[#2a1a1a] rounded-none rounded-b-[6px]"
      onclick={onClose}
    >
      Cancel
    </button>
  </div>
</Modal>
