# Data, Backups & Recovery

## Where Your Data Lives

gdluxx keeps its data in `<data dir>` (default `./data`; in Docker that's the
`/app/data` volume). The SQLite database at `<data dir>/gdluxx.db` holds your
admin account, sessions, API keys, jobs history, site rules, schedules, and
extension backups. Your saved gallery-dl config lives beside it as a separate
file, `<data dir>/config.json`, with snapshots in `<data dir>/config-history/`,
and synced browser cookies are stored as Netscape-format text files under
`<data dir>/cookies/`.

::: danger  
In Docker, `/app/data` **must** be a persistent bind mount or volume. If it
isn't, everything above, your account, API keys, schedules, config, jobs, is
lost the moment the container is recreated.  
:::

## Protect the Data Directory

gdluxx does not encrypt anything at rest. The database stores session tokens in
plaintext and API keys as unsalted SHA-256 hashes. The `cookies/` directory
holds your synced site cookies as plaintext text files, directly usable by
anyone who reads them. None of this needs to be decrypted or cracked, reading
the files is enough.

Treat the data directory like you would a browser's cookie store:

- Keep it owner-only: `chmod 700 data`, files `600`, owned by uid `1000` for
  Docker (the container runs as `1000:1000`, not root).
- Never expose it via a network share, a web root, or a world-readable bind
  mount.

## Backups

Back up the whole data directory before every upgrade, see the
[Upgrading guide](../getting-started/upgrading.md). `gdluxx.db` needs a bit of
care since it can be open and being written to; the rest is just files:

- **App stopped:** copy the entire data directory, `gdluxx.db` included.
- **App running:** use SQLite's own backup command to get a consistent snapshot
  of the database instead of a half-written copy, then copy the rest of the
  directory (`config.json`, `config-history/`, `cookies/`) alongside it:

  ```bash
  sqlite3 gdluxx.db ".backup 'backup.db'"
  ```

To restore, stop the app, replace the data directory's contents with the backup,
and start it again. A restored backup brings back sessions and API keys exactly
as they were at backup time, anything created or revoked after that point is
gone.

## Recovering a Lost Admin Password {#recovering-a-lost-admin-password}

There's no email-based password reset, and editing the stored password hash
directly is not a supported path. The supported recovery is a full account
reset: delete the one user row and go through first-run setup again.

::: warning This deletes API keys, schedules, sessions, and extension backups  
Because `user` cascades to `account`, `session`, `apiKey`, and `schedules`, this
procedure removes all of those, along with the synced extension cookie and
extraction backups that hang off your API keys. Your API keys stop working, so
the browser extension needs to be re-paired with a new key. The cached cookie
text files under `<data dir>/cookies/` are **not** removed by this SQL delete,
only deleting a key through the UI cleans those up, so remove them by hand
afterward if you want them gone. Jobs history, your saved gallery-dl config,
site rules, and supported-site data are **not** touched.  
:::

1.  **Stop gdluxx.**

    ```bash
    docker compose stop
    ```

2.  **Back up `gdluxx.db` first.** This is a destructive procedure, don't skip
    this. See [Backups](#backups) above.

3.  **Delete the user row.** Run this against `gdluxx.db` with the `sqlite3`
    CLI. If you're running in Docker, do this on the host against
    `./data/gdluxx.db`, the host side of your bind mount, so you don't need
    `sqlite3` inside the container at all. On bare metal, run it against your
    data directory's `gdluxx.db` the same way.

    ```sql
    PRAGMA foreign_keys = ON;
    DELETE FROM user;
    ```

    The pragma matters: the `sqlite3` CLI defaults foreign-key enforcement off,
    and without it the dependent `account`, `session`, `apiKey`, and `schedules`
    rows are left behind instead of cascading.

    ::: danger The instance is claimable while the user table is empty  
    From the moment this delete runs until you finish first-run setup, gdluxx
    has zero users, and anyone who can reach it can complete setup and claim the
    admin account instead of you, exactly the window this release closed for
    normal operation. If the instance is reachable beyond localhost, block
    outside access first (stop the reverse proxy, or firewall the port) before
    you run the delete, and only restore access after your new account exists.  
    :::

4.  **Start gdluxx and finish setup immediately.**

    ```bash
    docker compose up -d
    ```

    With zero users, gdluxx redirects to `/auth/setup`. Create a new admin
    account there right away, same as
    [First Run Setup](../getting-started/first-run.md).

::: tip Changing `AUTH_SECRET` is not a recovery mechanism  
Rotating `AUTH_SECRET` invalidates browser sessions, but it doesn't touch your
password, and API keys are unaffected by it either way. It's not a substitute
for the steps above.  
:::
