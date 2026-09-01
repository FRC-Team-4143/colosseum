# Colosseum

The digital strategy whiteboard for **FRC Team 4143 (MARS/WARS)**.

Colosseum is a local-first desktop/mobile app for planning matches: a match list, a
drawing whiteboard per match (auto / teleop / transition / endgame / notes) with robot
tokens and checkboxes, The Blue Alliance import, a Statbotics panel, and PNG / PDF / QR
export. It is a sibling to the team's other apps (Legion, Tempus, Munus, …) but is
built on SvelteKit + Tauri rather than the Python stack, and currently runs **fully
standalone** — there is no Legion sign-in or roster sync yet.

Adapted from the open-source [Strategy Board](https://github.com/pranavgundu/Strategy-Board)
by Pranav Gundu (MIT). See `LICENSE`.

## Develop

```sh
bun install
bun run tauri dev        # desktop app (SvelteKit dev server + Tauri shell)
bun run dev              # browser-only, no native layer
```

Checks and tests:

```sh
bun run check            # svelte-check / typecheck
bun run test             # vitest
cargo test --manifest-path src-tauri/Cargo.toml
```

### Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

## Optional configuration

- `TBA_API_KEY` — a personal [The Blue Alliance](https://www.thebluealliance.com/account)
  read API key for the TBA import. Without it, TBA import is disabled; the app works
  without it. Can also be entered in-app.

## Mobile

Generate both native mobile projects on macOS (regenerates `src-tauri/gen/`, which is
still keyed to the pre-rename project name until you do):

```sh
bun run mobile:init
```

Build the Android and iOS release artifacts:

```sh
bun run mobile:build
```

Android builds require the Android SDK/NDK; iOS builds require macOS, Xcode, CocoaPods,
and Apple signing for a distributable IPA.

## Status / not yet wired

- **No Legion connection.** No SSO, no roster sync — deliberately, for local testing.
- **No online match sharing.** The upstream Firebase/Firestore "share via link" feature
  has been removed. Sharing is PNG / PDF / QR / copy-paste only.
