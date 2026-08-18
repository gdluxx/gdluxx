# Browser Extension Tour

A step-by-step look at the gdluxx browser extension's core screens — screenshots
are click to enlarge.

## 1. Main Overlay

Opening the overlay (via the toolbar popup, your configured hotkey, or the
right-click menu) extracts every image and link on the current page into
separate Images and URLs tabs, each showing a live count. From there you can
filter by keyword, select items individually or in bulk, and spot duplicate or
substitution-modified items via badges.

<div style="text-align: center;">

![Extension overlay main view](1.main.png){.screenshot}

</div>

## 2. Advanced Filtering

The Extraction panel controls exactly what gets pulled from the page: Range mode
restricts extraction to content between two CSS selectors, while Targeted mode
pulls images only, scoped by a CSS selector or string markers.

<div style="text-align: center;">

![Extraction panel with Range and Targeted modes](2.advanced-filtering.png){.screenshot}

</div>

## 3. String Substitution

URL Substitution Rules rewrite selected URLs with regex patterns before you
send, copy, or download them, with capture-group support, per-rule
global/ignore-case flags, and a live before/after preview.

<div style="text-align: center;">

![URL substitution rules with preview](3.string-substitution.png){.screenshot}

</div>

## 4. Preview

The Preview settings control inline thumbnails for items in the Images tab and
an optional hover preview that shows a larger floating image when you hover a
row.

<div style="text-align: center;">

![Preview settings](4.preview.png){.screenshot}

</div>

## 5. gdluxx Connection

The gdluxx Connection tab is where you enter your server URL and API key,
required before you can send URLs, sync extraction profiles, or use remote
profile backups, with a Test Connection button to verify them before saving.

<div style="text-align: center;">

![gdluxx server connection settings](5.gdluxx.png){.screenshot}

</div>

## 6. Appearance

Appearance settings switch the overlay between a modal or fullscreen display
mode and let you pick from the extension's own set of DaisyUI themes,
independent of the gdluxx web app's theme.

<div style="text-align: center;">

![Appearance settings](6.appearance.png){.screenshot}

</div>

## 7. Hotkeys

The Hotkeys tab configures the overlay toggle shortcut (Alt+L by default) and a
separate, independently configurable hotkey for sending the current tab directly
without opening the overlay.

<div style="text-align: center;">

![Hotkeys settings](7.hotkeys.png){.screenshot}

</div>
