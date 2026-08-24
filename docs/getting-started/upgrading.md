# Upgrading

This guide is for **existing installs** upgrading from gdluxx v0.15.0 or
earlier. It changes some default behavior around authentication, sessions, and
saved gallery-dl configs. If this is a fresh install, skip this page and go to
[Installation](./installation.md).

## Before You Upgrade

1.  **Back up your database.**

    gdluxx's database lives at `<data dir>/gdluxx.db` (default
    `./data/gdluxx.db`; in Docker that's the `/app/data` volume). Stop the
    container/app first, or use SQLite's `.backup` command, then copy the file
    somewhere safe.

2.  **Set `AUTH_SECRET`, if you haven't already.**

    `AUTH_SECRET` is now mandatory. If it's unset, empty, whitespace, or one of
    the known placeholder values, gdluxx refuses to start in production with an
    error telling you to set it; it does not fall back to an insecure default.
    The stock `docker-compose.yml` already enforces this before gdluxx even
    starts:

    ```yaml
    - 'AUTH_SECRET=${AUTH_SECRET:?AUTH_SECRET must be set - generate one with:
      openssl rand -hex 32}'
    ```

    Generate one and set it **before** deploying this version:

    ```bash
    openssl rand -hex 32
    ```

    ::: warning Setting/changing AUTH_SECRET logs everyone out  
    The session cookie is signed with `AUTH_SECRET`. Setting it for the first
    time or changing it invalidates every existing browser session, so everyone
    has to log in again.

    **API keys are not affected.** Key lookup doesn't depend on `AUTH_SECRET`,
    so the browser extension keeps working with its existing key; no re-pairing
    is needed.  
    :::

    If you already have `AUTH_SECRET` set from a previous install (and it isn't
    one of the placeholder values described above), you can leave it as-is;
    there's no need to rotate it just for this upgrade.

3.  **Double-check `ORIGIN`.**

    `ORIGIN` should already be set to the exact URL you use to reach gdluxx in
    your browser (scheme, host, and port). No change is required here, but it's
    worth confirming it's still correct before you upgrade.

4.  **Source builds that set `DISABLE_CSRF_CHECK`:** that variable no longer
    exists and has no effect, even if it's still in your `.env`. If you were
    relying on it, set a correct `ORIGIN` instead and rebuild. There is no
    supported way to weaken origin checking. Prebuilt-image users aren't
    affected by this.

5.  **Behind a reverse proxy?** See the new `TRUSTED_PROXY_HEADER` guidance in
    the [Reverse Proxy Guide](../advanced/reverse-proxy.md#trusted-proxy-header)
    before you upgrade, particularly if login rate limiting matters to you.

6.  **Bare metal, with downloads/archives outside the data directory?** Set
    `GDLUXX_CONFIG_PATH_ROOTS` in your `.env`; see
    [Custom path on bare metal](./installation.md#custom-path-on-bare-metal).
    This upgrade adds stricter checks on config paths; without it, a config
    pointing outside the data dir (or an existing `GDLUXX_CONFIG_PATH_ROOTS`
    root) will be blocked. See [After Upgrading](#after-upgrading) below for
    what that looks like.

## What Happens Automatically on First Start

All database migrations run automatically when gdluxx starts, before it accepts
any requests. They're additive and idempotent: safe to let run, and safe if the
container restarts partway through and runs them again:

- Schema creation/updates for any new tables and columns.
- A single-administrator unique index on the `user` table. If your database
  somehow already has more than one user row, boot **aborts** with a message
  telling you to inspect the `user` table and remove the extra account(s). This
  is an abnormal state that needs a manual look, not something the migration
  will silently resolve for you.
- An `apiKey` table migration.
- An API-key permission backfill, which fills in `NULL` permissions on existing
  keys. Existing keys' expiry is **not** touched; keys created before this
  upgrade continue to never expire. Keys created after this upgrade default to a
  365-day expiry, with an explicit "never expires" option available in the UI.

One case is destructive by design: if your database predates the session table's
`token` column (a very old install), that one table is recreated from scratch.
Everyone has to log back in, but `user`, `account`, and `verification` (where
your credentials actually live) are never touched or dropped.

If a migration fails, gdluxx logs the reason and aborts boot rather than serving
requests against a half-migrated database. **Don't loop-restart past this.**
Restore your backup and investigate the logged error instead. Don't downgrade to
the previous image either: reverting restores the vulnerabilities this release
fixes, so prefer fixing forward.

## After Upgrading

- **Log in again.** Setting/changing `AUTH_SECRET` invalidated existing
  sessions; this is expected, one time.
- **Sessions now expire after 7 days**, with no sliding renewal; being active
  doesn't push the expiry back. Periodic re-login is expected behavior going
  forward, not a bug.
- **The browser extension keeps working** with its existing API key. No
  re-pairing needed.
- **A pre-existing config, site rule, or schedule may now be blocked.** This
  upgrade prohibits `exec`/`python` gallery-dl post-processors, any
  `command`/`commands` key, the `option`/`postprocessor`/`postprocessor-option`
  CLI ids, and paths that resolve outside your data directory (or
  `DOWNLOAD_PATH`/`GDLUXX_CONFIG_PATH_ROOTS`, if set). Nothing already saved is
  modified or deleted by the upgrade itself, but it's blocked at launch time:
  - An interactive run shows an error like: _"The saved gallery-dl configuration
    contains a setting that is not permitted, so the job was not started."_ The
    same check is now surfaced directly in the Config Editor when you try to
    save.
  - A scheduled run records a `launch_failed` run and sends a notification
    instead of launching.

  **Fix:** open the
  [Config Editor](../user-guide/config-page.md#rejected-settings) (or the
  relevant site rule/schedule), remove the offending setting, and save.
  Save-time validation confirms the fix took.

- **Custom API clients:** an unauthenticated request to `/api/*` now gets a
  `401` JSON response instead of a `302` redirect to the login page. This only
  matters if you wrote your own client against gdluxx's API; the browser
  extension and web UI aren't affected.
