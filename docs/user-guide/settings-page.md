# App Settings

The Settings pages are for managing the _gdluxx_ application itself, not your
_gallery-dl_ configuration (that's on the [Config page](./config-page.md)).

### Version Manager

- **Check for Updates**: See your current _gallery-dl_ version and check that
  you have the latest one available.
- **Download/Update**: Click to automatically download _gallery-dl_ binary.

::: tip  
If a site that's been working, suddenly stops working, check if there's an
update. **mikf** and others are usually quick to resolve breakage. If you're on
the latest version, or updating doesn't fix it, peruse the
[_gallery-dl_ Issues](https://github.com/mikf/gallery-dl/issues). If you find
nothing, considering filing an issue yourself. Just be sure there's not a
problem on your end first.  
:::

### User Manager

- **Account Management**: View your account. Possibly more features to come.

### API Key Manager

- **Create API Keys**: Generate keys for the browser extension and external API
  access.
  - Multiple keys possible
  - Set expiration dates
  - Use as Bearer tokens: `Authorization: Bearer <api-key>`
- **Revoke API Keys**: Delete keys to remove access.

### Debug Manager

- **Log Level**: Adjust the verbosity of the application logs (this is still a
  work in progress).
  - Logs are not stored or saved (maybe there'll be a need in the future)
