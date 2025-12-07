# App Settings

The Settings section manages gdluxx itself, not your downloads or config, but
the application. You'll find tabs for different types of settings here.

## General Manager

- Go to **Settings > General Manager**

### Command Form

### Site Rule Override Warnings

gdluxx can warn you when your manual options conflict with a site rule. It's a
simple on/off toggle

You can turn them back on anytime. See [Site Rules](./site-rules.md) for more
info about how this works.

Having a conflict does not mean you can't still run jobs.

- [See Site Rules & Manual Options](/user-guide/run-page#site-rules-manual-options)

### Theme Selection

1.  Click your preferred theme
2.  Changes apply immediately

For details on available themes, see [Themes](./themes.md).

## Version Manager

This manages the _gallery-dl_ binary that does the actual downloading.

### Check Current Version

1.  Go to **Settings > Version Manager**
2.  You'll see:
    - Your current gallery-dl version
    - The latest available version on GitHub (after clicking "Check for
      Updates")
    - Whether you're up to date

### Update gallery-dl

To download a new version is available:

1.  Click **Check for Updates**
2.  If an update exists, click **Download** or **Update**
3.  The new binary is downloaded and installed automatically
4.  No restart needed, it's ready once you receive the notification "Update
    completed successfully"

### Why Update?

Site support breaks sometimes (sites change their HTML, add authentication,
etc.). The gallery-dl maintainers usually fix these quickly.

If downloads suddenly stop working:

1. Update gallery-dl first
2. Try the download again
3. If it still fails, check the gallery-dl
   [GitHub issues](https://github.com/mikf/gallery-dl/issues) to see if others
   are experiencing the problem

## User Manager

Currently, shows your account information. More features may be added in the
future.

{#api-keys}

## API Key Manager

This is where you create and manage API keys for external access (browser
extension, scripts, or anything else you dream up).

### Creating an API Key

1. Go to **Settings > API Key Manager**
2. Give it a name (e.g., "Chrome Extension", "Mobile Script")
3. Optionally set an expiration date
   - Toggle off "Never expires?"
   - Choose a date/time for expiration
4. Click **Generate Key**
5. **Copy the key immediately** as you'll only see it once

::: warning There is no recovering an API key  
If you lose track of your API key, or it becomes otherwise compromised, **delete
it**. You can easily generate a new key. Treat them like you would a password.
It shouldn't matter too much, because you're not
[exposing gdluxx to the internet, right?](/advanced/reverse-proxy)  
:::

### Using Your API Key

Use it in API requests:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"urlToProcess": "https://example.com"}' \
  https://your-gdluxx-url/api/extension/external
```

An API key is necessary to use the browser extension.

### Managing Keys

- **View all keys**: The Key Manager lists all of your active keys
- **See when they expire**: Each key shows its expiration date (if set)
- **Revoke a key**: Click delete/trash icon to immediately revoke access
- **Create multiple keys**: You can have as many keys as you want

Useful for:

- Separate keys for extension and scripts
- Revoking old keys when you lose track of them
- Expiring keys regularly for security

### API Limits

Theoretical limits on API requests:

- **Max URLs per request**: 200 (in single batch)
  - I've not stress tested gdluxx. Perhaps it'll crash at a mere 100 URLs or
    maybe it could handle 2000. This is merely a precaution

::: tip Note  
While you can go wild with gdluxx, be mindful some sites may rate limit,
temporarily ban, or outright ban you if you hammer their site.

Be respectful, be smart  
:::

## Log Manager

Configure if, where, and how gdluxx logs its activity.

::: tip Note  
There are two parts to the Log Manager, Server and Client. They're exactly what
they sound like.

- Client: Browser UI
- Server: Backend magic

If you're wanting to view logs in the console and not a file, make note of the
below.

- Client console: Is your browser console, `F12` should get you there on all
  browsers (except maybe Safari, I know less about Macs than I do Windows)
- Server console: Available in your docker logs

:::

### Server Logging

#### Log Levels

You can adjust how verbose logging is:

- **Debug**: Detailed debugging information
- **Info**: Standard information (default)
- **Error**: Only show errors
- **Warn**: Show warnings and errors

Debug mode shows more details but creates larger log files.

#### Log Format

- Simple = Single line logs
- JSON = JSON formatted logs

#### Enable Logging to File

When logging is enabled, by default, logs go to console only. To save logs to a
file:

1. Go to **Settings > Log Manager**
2. Toggle on "File Output"
3. Enter a path where logs should be saved (e.g., `/app/data/logs/`)
4. Save

#### Log Directory

Defaults to `logs/` in your docker bind mount location.

Additional settings

- Max File Size (before creating a new file)
- Max number of days to keep log files before deleting
  - Old log files will be deleted

### Client Logging

#### Log Levels

Same as Server Logging above

### Send Logs to Server

By default, the logs will only print to the browser console. You can opt to send
them to the server if you want them written to file. There are a couple of
additional settings for doing this.

- Buffer size: How many log lines before the logs are sent to the server
- Batch Interval: Minimum time between sending logs to the server

- You can opt to include the URL and/or the User Agent in logs as well (it's not
  by default)

### When to Enable Logging

Enable file logging if:

- You're troubleshooting download issues
- You want to review what happened during jobs
- You're debugging configuration problems
- You need a record of all activity

You can disable it later if you don't need logs anymore.

::: warning Security Note  
In general, logs can contain sensitive information. API keys, URLs, and User
Agent are left out of gdluxx logs by default. You can opt to add URLs and User
Agent to logs, but not API keys.

**Keep your logs private!** Don't share them on public forums without reviewing
them first. Better safe than sorry

gdluxx tries to sanitize logs (redacting passwords), but you should still be
cautious.  
:::
