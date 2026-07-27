# Cookie Sync

Cookie Sync lets gdluxx use your browser's login session when downloading from
sites that require you to be signed in. Instead of manually copying cookies
into your gallery-dl config, you sync them once from the browser extension and
gdluxx applies them automatically to any job that matches.

## What Cookie Sync Does

- **Captures cookies from your browser** for the site you're currently on,
  through the extension.
- **Stores them per domain** on the gdluxx server, scoped to the API key that
  synced them.
- **Applies them automatically** at job start, for any job whose URL matches a
  synced domain - no need to add `--cookies` yourself.

Syncing one site never touches another. If you sync `example.com`, your
cookies for `another-site.com` (or any other previously synced domain) are
left exactly as they were.

## Syncing Cookies from the Extension

1. Open the overlay on the site you want to sync (hotkey, popup, or
   right-click).
2. Click the settings icon and go to the **Cookies** tab.
3. Click **Sync cookies for current site** (the button shows the actual
   domain, e.g. **Sync cookies for example.com**).

::: info  
The first time you sync on a given site, your browser asks for a one-time
permission to read that site's cookies. This is the same on-demand permission
model the extension already uses for host access - see
[Permissions](../extension/setup.md#permissions).  
:::

Once synced, the Cookies tab shows the domain's cookie count and when it was
last updated. There's no separate "restore" step - if a session expires or you
log in again, just sync again to refresh it.

::: tip  
Cookie values are never sent back to the extension or shown anywhere in
gdluxx once synced. Syncing is write-only by design, so the only way to
"check" what's stored is the cookie count and expiry shown in the tab.  
:::

## How Synced Cookies Are Applied to Downloads

### Domain Matching

When a job starts, gdluxx checks the job's URL against your synced domains,
starting with the most specific match and working up:

- A job for `example.com` uses cookies synced for `example.com`.
- A job for `sub.example.com` uses cookies synced for `sub.example.com` if you
  synced that subdomain specifically, otherwise it falls back to cookies
  synced for `example.com`.

If a match is found, gdluxx writes a Netscape-format `cookies.txt` file (into
the same `/app/data/cookies/` directory used for manually configured cookie
files - see [The Config Page](./config-page.md#automatic-path-handling)) and
adds `--cookies <path>` to the gallery-dl command for you. Expired cookies are
left out of that file automatically.

### Precedence

An explicit `--cookies` option always wins over an auto-injected one, whether
it comes from the Run page or a [site rule](./site-rules.md):

- You manually add `--cookies /path/to/mine.txt` on the Run page: your file is
  used, auto-injection is skipped.
- A site rule for the URL specifies `--cookies`: the rule's file is used,
  auto-injection is skipped.
- Neither is set, and the URL matches a synced domain: gdluxx injects the
  synced cookies for you.

This lets you fall back on Cookie Sync everywhere, and only override it on the
sites where you need something different.

## Managing Synced Cookies

Go to **Settings > Cookies** to view and manage what's been synced. Since
cookies are stored per API key, pick the key you want to inspect from the
dropdown - this is the same key used by the browser extension that synced
them.

From there you can:

- **View synced domains** - cookie count, expired count, earliest expiry, and
  who last synced each one.
- **Delete a domain** - removes that domain's cookies. Downloads for that site
  stop using them until you sync again from the extension.
- **Delete all** - clears every synced domain for the selected API key.

Deleting an API key also deletes its entire cookie backup and any cached
cookie files, same as it does for extraction profile backups.

::: warning Security Note  
Cookies are session-equivalent secrets. gdluxx stores them as plain text in
the database and in the cookie files it writes for gallery-dl - there's no
encryption at rest. **Treat your gdluxx data directory with the same care as
your browser's own cookie store.** Cookie values are never shown or returned
by the API once synced, and the `--cookies` option is marked sensitive, so its
value is redacted if it ever shows up in gdluxx's logs.  
:::
