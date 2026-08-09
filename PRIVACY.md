## Privacy Policy

**gdluxx** is a self‑hosted browser application and companion browser extension
(collectively, "Software").

### Our Privacy Promise

- **No data is collected or stored by us**, ever.
- **We never receive, transmit, log, or access any user data**. Not crash logs,
  usage stats, telemetry, IPs, or identifiers.
- **All your data stays on your device**. User accounts, configuration, job
  history, and settings are stored locally in your device's database.

### Authentication & User Data

- **Local accounts only**: Email addresses and passwords are used solely for
  creating accounts and logging into your self-hosted instance.
- **Never transmitted to us**: Your login credentials are stored locally on your
  device and never sent to our servers.
- **Your database, your control**: All user data is stored in your local SQLite
  database - you have complete control over it.

### Network Activity

- **Nothing is ever sent to us**. Every request goes either to your own
  self-hosted gdluxx instance or to a site you asked gallery-dl to download
  from.
- **You control what leaves your browser**: URLs, cookies, and downloads are
  transmitted only when you initiate them.
- **One automatic request**: once a server URL and API key are configured, the
  extension periodically asks _your own_ gdluxx instance which features its
  version supports. It runs at browser startup and roughly every six hours,
  sends nothing but your API key, and does not run at all while the extension is
  unconfigured.
- **Update checks**: When checking for updates, only version information is
  requested from GitHub's public API.
- **Content downloads**: gallery-dl communicates directly with target websites.
  We don't monitor or log these interactions.

### Browser Extension

- **Same privacy principles**: The extension follows the same
  zero-data-collection policy.
- **API key authentication**: Extension uses locally-generated API keys to
  communicate with your self-hosted instance.
- **Limited permissions**: The extension can read all URLs of sites you visit
  while active, it does nothing with the URL unless you instruct it to. At which
  time the URL is sent to YOUR self-hosted gdluxx instance and nowhere else.

### Data Location

- **Everything is local**: User accounts, API keys, job history, configuration,
  and all application data is stored on your device.
- **No cloud storage**: gdluxx never uploads your data to external servers.

### Transparency

- No tracking, no analytics, no ads, period.
- Any changes to this policy will be posted **here**.
- **Contact**: Post an issue in the repo for questions or concerns.
