<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";
  import { app } from "$lib/stores/app.svelte";
  import { session } from "$lib/stores/identity.svelte";
  import { eventStore } from "$lib/stores/event.svelte";
  import { pickList } from "$lib/stores/picklist.svelte";
  import { toast } from "$lib/stores/toast.svelte";
  import { native } from "$lib/native/api";
  import { clonePacket, dismissRelease, isReleaseDismissed } from "$lib/features";
  import AppLoading from "$lib/components/AppLoading.svelte";
  import AppNav from "$lib/components/AppNav.svelte";
  import EventPickerModal from "$lib/components/EventPickerModal.svelte";
  import MatchEditorModal from "$lib/components/MatchEditorModal.svelte";
  import MatchList from "$lib/components/MatchList.svelte";
  import OrientationWarning from "$lib/components/OrientationWarning.svelte";
  import PickList from "$lib/components/PickList.svelte";
  import QrExportModal from "$lib/components/QrExportModal.svelte";
  import ReleaseAnnouncementModal from "$lib/components/ReleaseAnnouncementModal.svelte";
  import ScheduleView from "$lib/components/ScheduleView.svelte";
  import TeamDetail from "$lib/components/TeamDetail.svelte";
  import TeamsTable from "$lib/components/TeamsTable.svelte";
  import WhiteboardScreen from "$lib/components/WhiteboardScreen.svelte";
  import type { Match, MatchFormValues } from "$lib/components/types";
  import type { MatchPacket, ReleaseAnnouncement, StrategyMatch } from "$lib/native/types";

  let createOpen = $state(false);
  let pickerOpen = $state(false);
  let releaseOpen = $state(false);
  let editing = $state<Match | null>(null);
  let qrMatch = $state<Match | null>(null);
  let toastText = $state("");
  let pngRequest = $state(0);
  let refreshing = $state(false);
  let releaseAnnouncement = $state<ReleaseAnnouncement | null>(null);

  function asMatch(match: StrategyMatch): Match {
    return {
      id: match.id, matchName: match.matchName,
      redOne: match.red[0], redTwo: match.red[1], redThree: match.red[2],
      blueOne: match.blue[0], blueTwo: match.blue[1], blueThree: match.blue[2],
      tbaMatchKey: match.tbaMatchKey,
    };
  }
  const matches = $derived(app.matches.map(asMatch));
  const eventName = $derived((eventStore.event.data?.name as string | undefined) ?? null);

  // Keep the shared pick-list store pointed at the workspace's event.
  $effect(() => {
    if (!session.identity) return;
    void pickList.load(eventStore.currentEventKey);
  });

  onMount(() => {
    let active = true;
    void (async () => {
      await session.load();
      if (!active || !session.identity) return;
      await Promise.all([app.init(), eventStore.init()]);
      const config = await native.config.current().catch(() => null);
      if (!active) return;
      const announcement = config?.releaseAnnouncement;
      if (announcement?.enabled && !(await isReleaseDismissed(announcement.id, announcement.showOnce))) {
        releaseAnnouncement = announcement;
        releaseOpen = true;
      }
    })().catch(() => notice("Some startup services could not be loaded."));
    return () => { active = false; };
  });

  function notice(message: string) {
    toastText = message;
    window.setTimeout(() => { if (toastText === message) toastText = ""; }, 3500);
  }

  async function create(values: MatchFormValues) {
    try {
      await app.createBasicMatch(values.matchName.trim() || "Untitled match", [values.redOne, values.redTwo, values.redThree], [values.blueOne, values.blueTwo, values.blueThree]);
      createOpen = false;
    } catch {
      notice("Could not create this match.");
    }
  }

  async function save(values: MatchFormValues) {
    if (!editing) return;
    const found = app.matches.find((match) => match.id === editing?.id)?.packet;
    const packet = found ? (clonePacket(found) as MatchPacket) : undefined;
    if (!packet) return;
    packet[0] = values.matchName.trim() || "Untitled match";
    packet[1] = values.redOne; packet[2] = values.redTwo; packet[3] = values.redThree;
    packet[4] = values.blueOne; packet[5] = values.blueTwo; packet[6] = values.blueThree;
    try {
      await app.commitPacket(packet);
      editing = null;
    } catch {
      notice("Could not save your changes.");
    }
  }

  async function selectEvent(eventKey: string) {
    try {
      await eventStore.setEvent(eventKey);
      app.screen = "schedule";
    } catch {
      notice("Could not switch to that event.");
    }
  }

  async function refresh() {
    refreshing = true;
    try {
      await eventStore.refresh();
    } catch {
      notice("Could not refresh from The Blue Alliance.");
    } finally {
      refreshing = false;
    }
  }

  async function dismissAnnouncement() {
    if (releaseAnnouncement) await dismissRelease(releaseAnnouncement.id, releaseAnnouncement.showOnce);
    releaseOpen = false;
  }

  async function addToPicklist(team: number) {
    const eventKey = eventStore.currentEventKey;
    if (!eventKey) {
      notice("Choose an event first.");
      return;
    }
    try {
      await pickList.add(eventKey, team);
      notice(`Added ${team} to the pick list.`);
    } catch {
      notice("Could not add to the pick list.");
    }
  }
</script>

<svelte:head><title>Colosseum</title><meta name="description" content="Event data and match-planning hub for FRC Teams 4143 and 4423 (MARS/WARS)" /></svelte:head>

<OrientationWarning />

{#if session.loading}
  <AppLoading />
{:else if !session.identity}
  <!-- Same sign-in card as every MARS/WARS app: apps-infra/design/README.md#sign-in -->
  <div class="gate">
    <div class="gate-card">
      <h1 class="gate-title">Colosseum</h1>
      <p class="gate-sub">Sign in with your Legion account.</p>
      {#if session.error}<p class="gate-notice">{session.error}</p>{/if}
      <a class="btn-accent gate-btn" href="/api/auth/login">
        <!-- Bootstrap Icons "slack" (MIT), apps-infra/design/slack.svg -->
        <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111.756 8.43 1.68 8.43h1.682zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68zM5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682zm6.749 1.682c0-.926.755-1.682 1.68-1.682S16 4.964 16 5.889s-.756 1.681-1.68 1.681h-1.681zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68zm-1.681 6.748c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682h1.68zm0-.847c-.924 0-1.68-.755-1.68-1.68s.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681z"/></svg>
        Sign in with Legion
      </a>
    </div>
  </div>
{:else}
  {#if app.screen !== "whiteboard"}
    <div id="hub-container">
      <AppNav
        screen={app.screen}
        teamNumber={session.identity.teamNumber}
        memberName={session.identity.name}
        {eventName}
        {refreshing}
        onNavigate={(next) => (app.screen = next)}
        onChangeEvent={() => (pickerOpen = true)}
        onRefresh={refresh}
        onNewMatch={() => (createOpen = true)}
        onLogout={() => session.logout()}
      />

      <div class="hub-body">
        {#if app.screen === "schedule"}
          <ScheduleView workspace={session.identity.teamNumber} onNotice={notice} onChangeEvent={() => (pickerOpen = true)} />
          {#if matches.length}
            <div class="saved-boards">
              <div class="saved-boards-head">Your saved boards</div>
              <div class="saved-boards-list">
                <MatchList
                  {matches}
                  onOpen={(match) => app.openMatch(match.id)}
                  onEdit={(match) => (editing = match)}
                  onDuplicate={(match) => app.duplicateMatch(match.id)}
                  onExportPng={(match) => { app.openMatch(match.id); pngRequest += 1; }}
                  onExportQr={(match) => (qrMatch = match)}
                  onDelete={(match) => app.deleteMatch(match.id)}
                />
              </div>
            </div>
          {/if}
        {:else if app.screen === "teams"}
          <TeamsTable onAddToPicklist={addToPicklist} />
        {:else if app.screen === "team" && app.selectedTeam !== null}
          <TeamDetail
            team={app.selectedTeam}
            onNotice={notice}
            onBack={() => (app.screen = "teams")}
            onAddToPicklist={addToPicklist}
          />
        {:else if app.screen === "picklist"}
          <PickList onNotice={notice} />
        {/if}
      </div>
    </div>
  {/if}

  <WhiteboardScreen {pngRequest} onNotice={notice} />
  <MatchEditorModal open={createOpen} onSave={create} onClose={() => (createOpen = false)} />
  <MatchEditorModal open={editing !== null} match={editing} onSave={save} onClose={() => (editing = null)} />
  <EventPickerModal open={pickerOpen} current={eventStore.currentEventKey} onSelect={selectEvent} onClose={() => (pickerOpen = false)} />
  <QrExportModal open={qrMatch !== null} packet={qrMatch ? app.matches.find((match) => match.id === qrMatch?.id)?.packet ?? null : null} matchName={qrMatch?.matchName || "this match"} onNotice={notice} onClose={() => (qrMatch = null)} />
  <ReleaseAnnouncementModal open={releaseOpen} announcement={releaseAnnouncement} onDismiss={dismissAnnouncement} onClose={() => (releaseOpen = false)} />
{/if}

{#if toastText}<button class="toast" onclick={() => (toastText = "")} aria-live="polite">{toastText}</button>{/if}
{#each toast.messages as message (message.id)}
  <button class="toast toast-{message.kind}" onclick={() => toast.dismiss(message.id)}>{message.text}</button>
{/each}

<style>
  #hub-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
  .hub-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background: #0a0a0a;
  }
  .saved-boards {
    border-top: 1px solid #2a1a1a;
    display: flex;
    flex-direction: column;
  }
  .saved-boards-head {
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9a7878;
  }
  .saved-boards-list {
    height: 38vh;
    display: flex;
    flex-direction: column;
  }
  .gate {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1rem;
  }
  .gate-card {
    width: 360px;
    max-width: 100%;
    padding: 1.5rem;
    background: #111111;
    border: 1px solid #2a1a1a;
    border-radius: 10px;
    text-align: center;
  }
  .gate-title { color: #cc2200; font-style: italic; font-weight: 700; font-size: 2.5rem; margin: 0 0 0.25rem; }
  .gate-sub { color: #9a7878; margin: 0 0 1.5rem; }
  .gate-notice {
    color: #f0e8e8; background: #2c0b0e; border: 1px solid #842029; border-radius: 6px;
    padding: 0.5rem 0.75rem; margin: 0 0 1rem; text-align: left; font-size: 0.95rem;
  }
  .gate-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    width: 100%; padding: 0.55rem 1rem; text-decoration: none;
  }

  .toast {
    position: fixed;
    bottom: max(1.25rem, env(safe-area-inset-bottom));
    left: 50%;
    z-index: 99998;
    max-width: calc(100vw - 2rem);
    padding: 0.75rem 1.25rem;
    transform: translateX(-50%);
    color: #f0e8e8;
    border: 1px solid #2a1a1a;
    border-radius: 6px;
    background: #111111;
    font-family: inherit;
    font-size: 1rem;
  }
  .toast-warning { border-color: #7a5a1a; }
  .toast-error { border-color: #7a2a1a; }
  /* Stack store toasts above the transient one. */
  .toast + .toast { bottom: calc(max(1.25rem, env(safe-area-inset-bottom)) + 3.5rem); }
</style>
