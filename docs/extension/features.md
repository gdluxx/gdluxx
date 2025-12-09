# Extension Features

The extension gives you multiple ways to send URLs to gdluxx without leaving
your browser.

## Sending URLs from Your Current Tab

The quickest way to send a URL.

### Using the Popup

1. Click the extension icon in your toolbar
2. Your current page's URL appears in the popup
3. Click **Send URL**
4. You'll see a success message
5. A new job starts in gdluxx

### Using the Keyboard Shortcut

1. Press your hotkey (default: **Alt+L**)
2. The overlay appears on your page
3. Click **Send URL** or just close the overlay if you only needed to verify
   it's working

::: warning  
This feature is can be especially dangerous. In that you'll be able to process
so many URLs. _It's wild._  
:::

## Using the Overlay UI

The overlay is the extension's main interface. It appears when you press your
keyboard shortcut or click the `Open overlay` button in the extension popup.

### What You See

- **Current page URL** displayed at the top
- **Send URL** button to submit immediately
- **Settings button** to adjust configuration (API key, server, hotkey)
- **Close button** to dismiss the overlay

### Why Use It?

- Send URLs without clicking the toolbar icon
- Keep browsing while the overlay is open
- Keyboard-friendly workflow

### Customizing the Overlay

The overlay automatically adapts to your theme selection (see [Themes](#themes)
below).

## Sending Individual Images

Right-click any image on a webpage to send just that image directly to gdluxx.

### How It Works

1. Right-click on any image
2. A context menu appears
3. Click **"Send Image to gdluxx"**
4. The image URL is sent as a job

This is perfect for downloading a single image without processing the whole
page.

### When to Use It

- You see one cool image you want
- You're browsing a site with lots of content but only want specific images
- You want to skip the job creation form entirely

## Batch URL Sending

Need to send multiple URLs at once? The overlay supports batch sending.

### How to Batch Send

1. Open the overlay (press your hotkey)
2. In the URL field, you can paste multiple URLs
3. Separate them by:
   - New lines (press Enter between URLs)
   - Spaces
4. Click **Send**
5. Each URL becomes a separate job in gdluxx

### Practical Examples

```
https://example.com/gallery1
https://example.com/gallery2
https://example.com/gallery3
```

Or on one line with spaces:

```
https://example.com/gallery1 https://example.com/gallery2 https://example.com/gallery3
```

Both work the same way.

## URL Substitution

Sometimes a URL works better in a different form. URL substitution automatically
rewrites URLs before sending them to gdluxx.

### What It Does

Let's say you're on a mobile site but want desktop URLs. You can create a rule:

- When you see: `https://mobile.example.com/...`
- Replace with: `https://www.example.com/...`

The extension rewrites the URL before sending it.

### Creating a Substitution Rule

1. Open the extension popup
2. Go to **Settings > URL Substitution** (if the tab exists in your version)
3. Click **Add Rule**
4. Enter the pattern to match (what you want to find)
5. Enter the replacement (what you want to replace it with)
6. Save

### Pattern Matching

Patterns use simple find-and-replace logic:

- `mobile.` → finds "mobile."
- `.com` → finds ".com"
- Just enter the exact text you want to find

### Common Uses

- **Mobile to desktop**: `mobile.twitter.com` → `twitter.com`
- **www variations**: `www.example.com` → `example.com`
- **Protocol changes**: `http://` → `https://`

## CLI Options Through the Extension

Want to add gallery-dl options for this specific send? The extension lets you
add CLI flags without leaving your browser.

### How It Works

1. Open the overlay (press your hotkey)
2. Look for a **"CLI Options"** field (if available)
3. Enter gallery-dl flags like you would on the command line:
   - `--range 1-10` (download first 10 items)
   - `--verbose` (more detailed output)
   - `--write-metadata` (save metadata files)
4. Click **Send**

These options apply only to this job.

### Common Options

- `--range 1-10` - Limit to first 10 items
- `--verbose` - Show detailed output
- `--write-metadata` - Save metadata alongside downloads
- `--no-skip` - Re-download even if files exist

See the [Run Page documentation](../user-guide/run-page.md) for more options.

## Custom Download Directories

You can specify where downloads go for each job sent through the extension.

### How to Set a Custom Directory

1. Open the overlay (press your hotkey)
2. Look for a **"Download To"** field (if available)
3. Enter a path (relative to your default download location)
4. The download goes there instead of your default directory

### Example

If your downloads normally go to `/app/data/downloads/`, entering
`special-project/` would save to `/app/data/downloads/special-project/`.

> **Note**: This feature might not be available in all versions. Check your
> extension's overlay UI.

## Themes

Match the extension's appearance to your preference.

### Changing Themes

1. Open the extension popup
2. Go to **Settings > Appearance** (or **Themes**)
3. Choose from available themes
4. Changes apply immediately

### Available Themes

The extension includes 30+ DaisyUI themes:

- **Basic**: light, dark
- **Colorful**: cupcake, emerald, corporate, retro, valentine, garden, aqua,
  pastel, fantasy
- **Dark**: cyberpunk, halloween, forest, black, luxury, dracula, business,
  night, coffee, dim
- **Professional**: wireframe, cmyk, autumn
- **Fun**: acid, lemonade, winter, nord, sunset

Pick whichever matches your style.

## Keyboard Navigation

The overlay supports keyboard navigation for power users.

### Keyboard Shortcuts (in overlay)

- **Tab** - Move between fields
- **Enter** - Submit (send URL)
- **Escape** - Close overlay
- **Alt+L** (or your custom hotkey) - Toggle overlay

No mouse required if you prefer keyboard control.

## Tips & Tricks

### Workflow: Browsing & Sending

1. Encounter a site you want to download
2. Press your hotkey
3. Verify the URL is correct
4. Press Enter (or click Send)
5. Continue browsing immediately

### Workflow: Bulk Downloading

1. Keep multiple interesting URLs
2. Open overlay when you have a list
3. Paste all URLs at once
4. Send them as batch

### Workflow: Image Hunting

1. Right-click any image you find
2. "Send Image to gdluxx" - one click
3. Move to next image
4. Repeat as much as you want

### Pro Tip: Save Your Settings

Once configured, the extension remembers everything:

- Server URL
- API key
- Hotkey preference
- Theme choice
- Substitution rules

You only configure it once.
