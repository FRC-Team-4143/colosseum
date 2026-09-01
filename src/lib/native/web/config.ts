import type { WebCommandHandler } from "./index";

/**
 * Browser port of `config_current` (src-tauri/src/helpers/config.rs +
 * commands.rs). All values are static; the only environment input is the shared
 * TBA key, which the Rust build reads from `TBA_API_KEY` / `VITE_TBA_API_KEY`
 * and the web build reads from Vite's `VITE_TBA_API_KEY` (empty string when
 * unset, matching the Rust default — never null).
 */
function sharedTbaApiKey(): string {
  const fromEnv = (import.meta.env as Record<string, string | undefined>).VITE_TBA_API_KEY;
  return fromEnv && fromEnv.length > 0 ? fromEnv : "";
}

function configCurrent() {
  return {
    fieldPngPixelWidth: 3510,
    fieldPngPixelHeight: 1610,
    fieldRealWidthInches: 690.875,
    fieldRealHeightInches: 317.0,
    redOneStationX: 3575.0,
    redOneStationY: 455.0,
    redTwoStationX: 3575.0,
    redTwoStationY: 805.0,
    redThreeStationX: 3575.0,
    redThreeStationY: 1155.0,
    blueOneStationX: -65.0,
    blueOneStationY: 455.0,
    blueTwoStationX: -65.0,
    blueTwoStationY: 805.0,
    blueThreeStationX: -65.0,
    blueThreeStationY: 1155.0,
    sharedTbaApiKey: sharedTbaApiKey(),
    releaseAnnouncement: {
      enabled: false,
      id: "release-2026-2-0",
      title: "New update available",
      message: "We shipped a new release with fixes and improvements.",
      ctaLabel: "View release notes",
      ctaUrl: "https://github.com/FRC-Team-4143/colosseum/releases",
      showOnce: true,
    },
  };
}

export const configCommands: Record<string, WebCommandHandler> = {
  config_current: () => configCurrent(),
};
