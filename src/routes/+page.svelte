<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";
  import { app } from "$lib/stores/app.svelte";
  import { session } from "$lib/stores/identity.svelte";
  import { eventStore } from "$lib/stores/event.svelte";
  import { pickList } from "$lib/stores/picklist.svelte";
  import { scouting } from "$lib/stores/scouting.svelte";
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
  import ScoutForm from "$lib/components/ScoutForm.svelte";
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

  // Keep the shared pick-list and scouting stores pointed at the workspace's event.
  $effect(() => {
    if (!session.identity) return;
    void pickList.load(eventStore.currentEventKey);
    void scouting.load(eventStore.currentEventKey);
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

<svelte:head><title>Colosseum</title><meta name="description" content="Event scouting hub for FRC Teams 4143 and 4423 (MARS/WARS)" /></svelte:head>

<OrientationWarning />

{#if session.loading}
  <AppLoading />
{:else if !session.identity}
  <div class="gate">
    <p class="gate-title">{session.error ?? "You need to sign in to use Colosseum."}</p>
    <a class="btn-accent gate-btn" href="/api/auth/login">Sign in with Legion</a>
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
        {:else if app.screen === "scout" && app.scoutMatchKey}
          <ScoutForm
            matchKey={app.scoutMatchKey}
            team={app.scoutTeam}
            onNotice={notice}
            onBack={() => (app.screen = "schedule")}
          />
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }
  .gate-title { color: #f0e8e8; font-size: 1.05rem; }
  .gate-btn { padding: 0.75rem 1.5rem; text-decoration: none; }

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
