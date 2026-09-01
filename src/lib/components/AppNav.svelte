<script lang="ts">
  import type { Screen } from "$lib/stores/app.svelte";

  let {
    screen,
    teamNumber,
    memberName,
    eventName,
    refreshing = false,
    onNavigate,
    onChangeEvent,
    onRefresh,
    onNewMatch,
    onLogout,
  }: {
    screen: Screen;
    teamNumber: number;
    memberName: string;
    eventName: string | null;
    refreshing?: boolean;
    onNavigate: (screen: Screen) => void;
    onChangeEvent: () => void;
    onRefresh: () => void;
    onNewMatch: () => void;
    onLogout: () => void;
  } = $props();

  const tabs: { id: Screen; label: string }[] = [
    { id: "schedule", label: "Schedule" },
    { id: "teams", label: "Teams" },
    { id: "picklist", label: "Pick List" },
  ];
</script>

<header id="app-nav">
  <div class="nav-left">
    <span class="wordmark">Colosseum</span>
    <span class="team-badge">{teamNumber}</span>
  </div>

  <nav class="nav-tabs">
    {#each tabs as tab (tab.id)}
      <button
        class="nav-tab"
        class:active={screen === tab.id || (tab.id === "teams" && screen === "team")}
        onclick={() => onNavigate(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <div class="nav-right">
    <button class="nav-event" onclick={onChangeEvent} title="Change event">
      <span class="nav-event-name">{eventName ?? "No event"}</span>
      <span class="nav-event-change">Change</span>
    </button>
    <button class="nav-icon" onclick={onRefresh} disabled={refreshing} title="Refresh from The Blue Alliance">
      {refreshing ? "…" : "↻"}
    </button>
    <button class="nav-icon" onclick={onNewMatch} title="New match / whiteboard">＋</button>
    <button class="nav-user" onclick={onLogout} title="Sign out">{memberName}</button>
  </div>
</header>

<style>
  #app-nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.6rem 1rem;
    background: #111111;
    border-bottom: 1px solid #2a1a1a;
    color: #f0e8e8;
    font-size: 0.95rem;
  }
  .nav-left { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }
  .wordmark { font-weight: 800; color: #cc2200; letter-spacing: 0.02em; }
  .team-badge {
    font-weight: 700;
    font-size: 0.8rem;
    padding: 0.1rem 0.5rem;
    border: 1px solid #2a1a1a;
    border-radius: 999px;
    background: #0a0a0a;
    color: #9a7878;
  }
  .nav-tabs { display: flex; gap: 0.25rem; }
  .nav-tab {
    padding: 0.4rem 0.9rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: #9a7878;
    font: inherit;
    cursor: pointer;
  }
  .nav-tab:hover { color: #f0e8e8; }
  .nav-tab.active {
    color: #f0e8e8;
    background: #0a0a0a;
    border-color: #2a1a1a;
  }
  .nav-right { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; flex-wrap: wrap; }
  .nav-event {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    max-width: 16rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid #2a1a1a;
    border-radius: 6px;
    background: #0a0a0a;
    color: #f0e8e8;
    font: inherit;
    cursor: pointer;
  }
  .nav-event-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-event-change { font-size: 0.75rem; color: #9a7878; flex-shrink: 0; }
  .nav-icon {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #2a1a1a;
    border-radius: 6px;
    background: #0a0a0a;
    color: #f0e8e8;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .nav-icon:disabled { opacity: 0.4; cursor: default; }
  .nav-user {
    padding: 0.35rem 0.7rem;
    border: 1px solid #2a1a1a;
    border-radius: 6px;
    background: #0a0a0a;
    color: #9a7878;
    font: inherit;
    cursor: pointer;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nav-user:hover { color: #f0e8e8; }
</style>
