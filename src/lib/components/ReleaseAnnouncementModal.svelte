<script lang="ts">
  import Modal from "./Modal.svelte";
  import type { ReleaseAnnouncement } from "$lib/native/types";

  let { open, announcement, onDismiss, onClose }: { open: boolean; announcement: ReleaseAnnouncement | null; onDismiss: () => void; onClose: () => void } = $props();
</script>

<Modal
  {open}
  id="release-announcement-popup"
  layer="z-[99999]"
  title={announcement?.title ?? "New update available"}
  panelClass="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-between w-11/12 sm:w-3/4 md:w-2/3 lg:w-1/2 max-w-md bg-[#111111] border border-[#2a1a1a] rounded-[6px] overflow-hidden"
  {onClose}
>
  <div class="w-full pt-5 pb-4 px-6 bg-[#111111] border-b border-[#2a1a1a] flex items-center justify-between gap-3">
    <h2 id="release-announcement-title" class="text-base text-[#f0e8e8] font-semibold">
      {announcement?.title ?? "New update available"}
    </h2>
    <button
      id="release-announcement-close-btn"
      class="flex items-center justify-center w-8 h-8 rounded-[6px] bg-[#2a1a1a] hover:bg-[#2a1a1a] text-[#9a7878] hover:text-[#f0e8e8] transition-colors"
      onclick={onClose}
      aria-label="Close"
    >
      <i class="fas fa-times"></i>
    </button>
  </div>
  <div class="w-full p-6">
    <p id="release-announcement-message" class="text-[#b09a9a] text-sm sm:text-base leading-relaxed">
      {announcement?.message ?? "We shipped a new release with fixes and improvements."}
    </p>
  </div>
  <div class="flex w-full">
    <button
      id="release-announcement-dismiss-btn"
      class="w-1/2 text-center text-sm btn-danger p-4 border-t border-[#2a1a1a] rounded-none rounded-bl-[6px]"
      onclick={onDismiss}
    >
      Dismiss
    </button>
    <a
      id="release-announcement-cta-btn"
      class="w-1/2 text-center text-sm btn-secondary p-4 border-t border-l border-l-[#2a1a1a] border-[#2a1a1a] rounded-none rounded-br-[6px] flex items-center justify-center"
      href={announcement?.ctaUrl ?? "#"}
      target="_blank"
      rel="noreferrer"
      onclick={onClose}
    >
      {announcement?.ctaLabel || "View release notes"}
    </a>
  </div>
</Modal>
