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

## Run it locally

```sh
bun install
bun run tauri dev        # the real app: Tauri window + dev server on http://localhost:8005
```

`bun run tauri dev` needs a Rust toolchain (`rustup`, stable). It starts the Vite dev
server on **port 8005** (Colosseum's slot in the MARS/WARS `8000`–`8006` range) and opens
the desktop window against it.

```sh
bun run dev             # dev server only, on http://localhost:8005
```

`bun run dev` serves the UI in a plain browser, but the data layer (matches, whiteboard,
storage, TBA, Statbotics) runs in the Rust/Tauri backend, so in a browser those calls
fail and you only see the shell. Use it for styling work; use `tauri dev` to actually use
the app.

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

## Distributing

Colosseum is a desktop/mobile **application**, not a web service — unlike the sibling
apps it isn't served on a port behind the droplet's reverse proxy. `bun run tauri build`
produces installers under `src-tauri/target/release/bundle/` (`.AppImage` / `.deb` on
Linux, `.dmg` on macOS, `.msi` on Windows) to hand to team members. Port **8005** is only
the local dev server. The old `vercel.json` has been removed.

## Status / not yet wired

- **No Legion connection.** No SSO, no roster sync — deliberately, for local testing.
- **No online match sharing.** The upstream Firebase/Firestore "share via link" feature
  has been removed. Sharing is PNG / PDF / QR / copy-paste only.
- **Not a hosted web app.** The frontend depends on the Tauri backend for all data, so
  it can't be deployed to the droplet as a browser app without writing a non-Tauri data
  layer first.
