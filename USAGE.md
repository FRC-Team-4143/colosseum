# How to Use Colosseum

- [Opening Colosseum](#opening-colosseum)
- [Creating a new match](#creating-a-new-match)
- [Using the whiteboard](#using-the-whiteboard)
  - [Switching sections](#switching-sections)
  - [Toggling views](#toggling-views)
  - [Drawing](#drawing)
  - [Erasing](#erasing)
  - [Switching colors](#switching-colors)
  - [Checkboxes](#checkboxes)
- [Managing matches](#managing-matches)
- [Importing matches from TBA](#importing-matches-from-tba)
- [Exporting matches](#exporting-matches)
- [Importing from a QR code](#importing-from-a-qr-code)

## Opening Colosseum

Colosseum is a desktop/mobile app, not a website. Launch the installed **Colosseum**
app, or run `bun run tauri dev` from a checkout. The first launch asks for your team
number.

## Creating a new match

1. Click the green **New** button on the home screen.
2. Fill in the match details:
   - **Match Name** — a label for the match.
   - **Team Numbers** — the three red and three blue teams. The order you enter them is
     the order they appear on the whiteboard.
3. Click **Create**. The match appears on the home screen; click it to open the
   whiteboard.

## Using the whiteboard

### Switching sections

The whiteboard is split into sections for the parts of a match:

- Autonomous (**Auto**)
- Teleoperated (**Teleop**)
- **Transition**
- **Endgame**
- **Notes**

Auto, Teleop, Transition, and Endgame share the same field view (they are the same
fields for different parts of the match). **Notes** is a freeform section for anything
else, including ranking points. Switch sections with the buttons at the top of the
whiteboard; the active one is bold.

### Toggling views

Click the toggle-view button (top right) repeatedly to cycle through full field, red
alliance only, and blue alliance only.

### Drawing

Select the marker tool to draw strategy on the field. A stylus gives the best
precision, but mouse and touch work too.

### Erasing

Cycle the bottom-right tool button to the eraser to remove strokes.

### Switching colors

With the marker (or the checkbox tool in Notes) selected, open the color picker at the
bottom left to change the drawing color. The current color is shown there.

### Checkboxes

In the **Notes** section, cycle the bottom-right tool button to the checkbox tool.
Place checkboxes anywhere; click one again to mark it done.

## Managing matches

Click the three-dot menu on a match card for:

- **Edit** — change the name or team numbers.
- **Duplicate** — copy the match (name prefixed with "Copy of ").
- **Export PNG** / **Export QR** — see below.
- **Delete** — permanently removes the match. This cannot be undone.

**Clear** on the home toolbar deletes every match and all app data.

## Importing matches from TBA

1. Click the **TBA** button on the home toolbar.
2. Choose whether to use your own The Blue Alliance API key (recommended during
   competitions) — set `TBA_API_KEY`, or enter it in the dialog.
3. Type an event name and pick it from the list (past events and events within the next
   week are available).
4. Pick a team to import that team's matches, or scroll down and choose **All Matches**.
5. Click **Import**. The matches populate the home screen.

## Exporting matches

From a match's three-dot menu:

- **Export PNG** — saves the current whiteboard as an image.
- **Export QR** — encodes the whole match into one or more QR codes to hand off to
  another device.

From the whiteboard you can also export a **PDF** of the QR codes for printing.

There is no online "share link" — match data never leaves your device except through
these explicit exports.

## Importing from a QR code

Click **Import QR** on the home toolbar and scan the QR code(s) produced by another
device's **Export QR**. Camera access is requested the first time.
