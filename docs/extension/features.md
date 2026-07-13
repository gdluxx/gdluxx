# Extension Features

The extension gives you multiple ways to send URLs to gdluxx without leaving
your browser, plus a full toolkit for extracting, filtering, rewriting, and
previewing media on the page you're viewing.

## Opening the Overlay

There are three ways to bring up the overlay:

1. **Toolbar popup** — click the extension icon, then **Open overlay in this
   tab**.
2. **Keyboard shortcut** — press your configured hotkey (see
   [Hotkeys](#hotkeys)).
3. **Right-click menu** — right-click anywhere on the page and choose **Open
   gdluxx**.

The overlay renders inside a Shadow DOM modal (or fullscreen, depending on your
[display mode](#appearance)) and immediately extracts images and links from the
current page.

### Sending the Current Tab Without Opening the Overlay

If you just want to send the page you're on, you don't need to open the overlay
at all:

- **From the popup**: click **Send current tab to gdluxx**.
- **From the keyboard**: enable the "send current tab" hotkey in **Settings >
  Hotkeys** and press it. This sends the tab's URL directly, no overlay
  required.

Both require a server URL and API key to already be configured (see
[gdluxx Connection](#gdluxx-connection)).

### Sending Individual Images or Links via Right-Click

Right-click any image or link on a page for a direct shortcut:

- **gdluxx: send image** — appears when you right-click an image; sends that
  image's URL.
- **gdluxx: send URL** — appears when you right-click a link; sends the linked
  URL (HTTP/HTTPS only).

Both send immediately without opening the overlay, and show a browser
notification when the job is created.

## The Main View

Once open, the overlay extracts every image and link on the page and splits them
into **Images** and **URLs** tabs, each showing a live count.

- **Filter by keyword** — the search field above the list narrows results by
  substring match as you type.
- **Selection dropdown** — select **All**, **None**, or **Invert** across the
  currently visible (filtered) items.
- **Compact rows** — toggle in the status bar at the bottom to switch to a
  denser table layout.
- **Duplicate counts** — items that appear more than once on the page show a
  `×N` badge.
- **Modified badge** — items rewritten by an active substitution rule show a
  "Modified" badge; hovering it reveals the original URL.

Click any row to toggle its selection; the status bar tracks how many items are
visible and how many are currently selected.

## Sending, Copying, and Downloading Selections

Once you've selected one or more images or links, the action bar (visible once
your gdluxx connection is configured) gives you three ways to act on them:

- **Send to gdluxx** — sends the selected URLs as jobs. A confirmation dialog
  shows the count before sending. Up to 25 URLs can be sent per request.
- **Copy** — copies the selected URLs to your clipboard, newline-separated.
- **Download** — saves the selected URLs to a local `.txt` file.

### Site Directory

Click the earth icon in the action bar to toggle **Site Directory**. When
enabled, the extension reads the hostname of the current page (e.g.
`example.com`) and passes it to gdluxx as a subdirectory, so downloads from that
send land inside a folder matching the hostname, under the `base-directory` set
in your gallery-dl config. The button shows the current hostname while active,
and the toggle state is remembered between sessions.

### Custom Folder

Click **Custom folder** to reveal a text field for a folder name; downloads from
that send go into that subfolder instead of (or in combination with) Site
Directory:

| Site Directory | Custom Folder  | Result                      |
|----------------|----------------|-----------------------------|
| `example.com`  | _(not set)_    | `example.com/`              |
| `example.com`  | `photos`       | `example.com/photos/`       |
| `example.com`  | `archive-2025` | `example.com/archive-2025/` |

This mirrors the way gallery-dl's own config organizes downloads by site.

## Extraction: Range and Targeted Modes

Click the filter icon in the header to open the **Extraction** panel, which
controls exactly what gets pulled from the page. It has two modes:

- **Range** — restrict extraction to content between two CSS selectors (**Start
  selector** / **End selector**). Leave both empty to scan the entire page. A
  live hint reports whether each selector was found and how many links/images
  fell inside the range.
- **Targeted** — extracts images only (the URLs tab is empty in this mode).
  Configure:
  - **Container via**: **Page body**, **CSS Selector**, or **String Markers**
    (begin/end text markers) to scope the search area.
  - **Images via**: **CSS Selector** (with a configurable attribute, default
    `src`) or **String Markers**.

Both modes have **Apply** and **Reset** buttons; selector inputs are validated
as you type.

## URL Substitution Rules

Below the extraction controls, the same panel lets you add regex-based
substitution rules that rewrite selected URLs before you send, copy, or download
them:

- Each rule has a **regex pattern** field and a **substitution text** field (use
  `$1`, `$2`, etc. for capture groups).
- Toggle a rule **On**/**Off**, reorder rules with the up/down arrows, or delete
  them. Rules run in order from top to bottom.
- Flag checkboxes per rule: **global** (replace all matches) and **ignore
  case**.
- **Add Rule** — add another rule, up to 20 per profile.
- **Apply substitutions** — rewrites the currently selected URLs.
- **Reset URLs** — restores originals for anything currently modified.
- A **Preview** section shows before/after for up to 5 selected URLs before you
  apply anything.
- A **Regex help** button opens a cheat sheet with common patterns, example
  substitutions, and flag explanations.

### Auto-Applying Saved Rules

If you've saved an extraction/substitution profile for the current host, origin,
or path (see below), it's applied automatically the moment the overlay opens on
a matching page — including running its substitution rules against the freshly
extracted URLs. You don't need to reapply it manually each visit.

## Extraction Profiles

Settings and profile management for the extraction/substitution rules above
lives in **Settings > Extraction Profiles**:

- **Save Profile** / **Update Profile** — saves the current extraction config
  and rules, scoped to **Host**, **Origin**, or **Path** (a help button explains
  the difference). Saved profiles for the current site show "In sync" or
  "Unsaved changes", and auto-applied ones are flagged "Auto-applied".
- **Delete** — removes the active profile.
- **Ignore** — stops an auto-applied profile from reapplying for the rest of the
  session (available only when a profile was auto-applied).
- **Apply to previews** — a checkbox controlling whether substitution results
  also affect the image preview thumbnails, not just the sent URLs.
- **Quick apply** — a dropdown of saved profiles for the current host, for
  applying one without matching by scope.
- **Manage extraction profiles** — **Refresh**, **Export** (downloads a JSON
  file of all saved profiles), **Import** (paste exported JSON; profiles merge
  with existing entries), and **Clear All**.
- **Saved profiles list** — search by host/scope/name, apply or delete any saved
  profile, and give it an optional display name.
- **Gallery display defaults** — global defaults for the floating gallery (see
  below): thumbnail sizes, grid gap, modal border width, and button corner.
  These can be overridden per saved profile.

### Syncing Profiles to gdluxx

If you've configured your gdluxx server URL and API key, the same tab lets you
back up your saved profiles server-side:

- **Save to gdluxx** — uploads all saved profiles as a backup.
- **Restore from gdluxx** — fetches the remote backup and shows a preview of
  what will be added/overwritten/skipped before you confirm.
- **Check remote status** — reports the last backup time and who saved it.
- **Clear remote backup** — deletes the server-side backup.

These backups can also be managed directly on the gdluxx server at **Settings >
Extension Profiles**.

## The Floating Gallery (Gallerized)

Independent of the overlay, a small floating button appears on every permitted
page (position configurable via the gallery display defaults above). Clicking
**🖼 Gallery** opens a grid of every image discovered on the page using your
current extraction/targeted-mode settings and substitution rules.

- A thumbnail-size button (⊞) next to the gallery button lets you pick between
  the small/default/large sizes configured in Gallery display defaults.
- Click any thumbnail to open the **Lightbox**, a full-size viewer with
  Previous/Next navigation and a counter (`3 / 42`). Arrow keys navigate, Escape
  closes.
- The gallery badge shows the current image count once discovered.

## Settings

Settings are organized into five tabs, opened via the settings icon in the
overlay header.

### Preview

- **Image Preview** — show inline thumbnails for image results in the Images
  tab.
- **Hover Preview** — a floating preview shown when hovering an image row, with
  size options: **off**, **small**, **medium**, **large**.

### gdluxx Connection

- **Server URL** and **API Key** — required to send URLs, sync extraction
  profiles, or use remote backups.
- **Test Connection** — verifies the server URL/API key before saving.
- **Save Settings** / **Reset**.

### Appearance

- **Display Mode** — switch between the modal overlay and a fullscreen overlay.
- **Theme Selection** — the extension ships with 29 DaisyUI themes: `light`,
  `dark`, `cupcake`, `emerald`, `corporate`, `retro`, `valentine`, `garden`,
  `aqua`, `pastel`, `fantasy`, `cyberpunk`, `halloween`, `forest`, `black`,
  `luxury`, `dracula`, `business`, `night`, `coffee`, `dim`, `wireframe`,
  `cmyk`, `autumn`, `acid`, `lemonade`, `winter`, `nord`, and `sunset`.
  Selecting one applies it immediately. These are the extension's own themes and
  are independent of the gdluxx web app's theme.

### Hotkeys

- **Enable overlay hotkey** — toggle whether the hotkey opens/closes the overlay
  (default **Alt+L**); takes effect on next page load.
- **Enable "send current tab" hotkey** — a separate, independently configurable
  hotkey that sends the current page's URL to gdluxx directly, without opening
  the overlay.

Click either hotkey's display to record a new combination; a hotkey must include
at least one modifier (Ctrl/Alt/Shift/Meta) plus a key.

### Extraction Profiles

Covered above under [Extraction Profiles](#extraction-profiles).

## Permissions

The extension only runs where you've granted it access. From the popup you can:

- **Enable on current site** / **Enable on all sites** — grant host permissions
  (each requires a confirmation).
- **Disable on current site** / **Disable on all sites** — revoke them.
- **Manage all permissions** — opens your browser's extension permissions page
  directly.

The popup also shows the current tab's URL and whether the overlay is currently
permitted on it.

## Keyboard Navigation

- **Tab** - move between fields in the overlay
- **Escape** - close the overlay, or close the lightbox/gallery if open
- **Ctrl+Enter** - apply extraction selectors while focused in a selector field
- Your configured overlay hotkey (default **Alt+L**) toggles the overlay from
  anywhere on the page
- Arrow keys navigate the gallery lightbox

## Tips & Tricks

### Workflow: Browsing & Sending

1. Encounter a page with content you want
2. Open the overlay (hotkey, popup, or right-click)
3. Select the images/links you want, or use **Selection > All**
4. Click **Send to gdluxx**
5. Continue browsing immediately

### Workflow: One-Off Sends

1. Right-click a single image or link
2. Choose **gdluxx: send image** or **gdluxx: send URL**
3. Move on — no overlay needed

### Workflow: Recurring Sites

1. Set up Range or Targeted extraction plus any substitution rules for a site
   you visit often
2. Save it as an Extraction Profile scoped to Host or Origin
3. It auto-applies (and auto-rewrites URLs) every time you open the overlay
   there afterward

### Pro Tip: Back Up Your Profiles

Once you've built up several extraction profiles, use **Save to gdluxx** in the
Extraction Profiles tab so they're recoverable if you switch browsers or
reinstall the extension.
