# The Config Page

_gdluxx_ includes a built-in editor for your _gallery-dl_ `config.json` file.
This is where you customize how gallery-dl behaves across all your downloads.

Use the config file to set:

- Download directories and filename patterns
- Site-specific settings (cookies, logins, rate limits)
- File naming conventions
- Any other gallery-dl options

## Editor Features

### Syntax Highlighting & Validation

The editor shows:

- **Color-coded syntax**: Different colors for keys, values, strings, etc.
- **Error markers**: Red line numbers indicate JSON problems
- **Real-time validation**: Problems show as you type

### Save Your Changes

Click the **Save** button to apply your config changes. They take effect
immediately on your next download.

::: warning Structural errors

Malformed JSON, a non-object root, and excessive nesting are rejected when you
save. These structural checks always apply in Restricted and Unrestricted mode.
gdluxx does not determine whether every valid JSON option is supported by the
installed gallery-dl version.

:::

### Full-Screen Editor Mode

To help prevent having to scroll as much, you can "full screen" the editor

1. Look for the **"Full screen"** button (the top-right)
2. Click it to expand the editor to fill your browser window
3. Click the button again to exit full-screen

::: info  
It is not actual full screen It just fills up your browser window. It doesn't
affect the browser, taskbar, or anything of the sort  
:::

### Import an Existing Config File

If you already have a gallery-dl `config.json` file

1. Click the **"Import"** button at the top
2. Select your `config.json` file
3. The file is loaded into the editor
4. Review it and click Save to apply

This replaces your current gallery-dl config if you already had one other than
the default in gdluxx, so make sure you want to do this!

::: danger There is no going back!  
If you overwrite your gallery-dl config file, there is no recovery. If for
whatever reason you want to keep the existing gallery-dl config already in
gdluxx, you can export it first.  
:::

### Export an Existing Config File

You can export your gallery-dl `config.json` file out of gdluxx

1. Click the **"Export"** button at the top
2. You'll see a download in your browser
3. You should be able to see it where ever your browser saves files by default

## Automatic Path Handling

_gdluxx_ automatically rewrites certain file paths in your config to work with
Docker. This path transform still applies in Restricted and Unrestricted mode.

When you save, these paths are automatically rewritten:

- Downloads → `/app/data/downloads/`
- Logs → `/app/data/logs/`
- Archives → `/app/data/archives/`
- Cookies → `/app/data/cookies/`
- Binaries → `/app/data/bin/`

This happens automatically so you don't have to worry about Docker container
paths vs your host machine. Everything "just works". (famous last words)

::: info Custom download location  
If you've set the `DOWNLOAD_PATH` environment variable (see
[install guide](../getting-started/installation.md#custom-download-location)),
downloads and part-directory get rewritten to that location instead of
`/app/data/downloads`. Paths already pointing somewhere under your configured
`DOWNLOAD_PATH` are left untouched, so you won't see them rewritten again.  
:::

### Examples

You set the below

```json
{
  "extractor": {
    "base-directory": "/gallery-dl/downloads"
  }
}
```

Once you save your config file, gdluxx will re-write it like so

```json
{
  "extractor": {
    "base-directory": "/app/data/gallery-dl/downloads"
  }
}
```

If you want `/app/data/downloads` as your `base-directory`, you can either set
it like so

```json
{
  "extractor": {
    "base-directory": "/app/data/downloads"
  }
}
```

Or like this:

```json
{
  "extractor": {
    "base-directory": "downloads"
  }
}
```

And once you save the config file, gdluxx will rewrite it to
`/app/data/downloads`. You will not see this immediately update, you'll have to
navigate away and back. It's on the list to see it update live.

::: info Organization  
In an effort to help in keeping things organized on your disk, gdluxx will
rewrite certain paths differently as previously mentioned.

```
- Downloads → `/app/data/downloads/`
- Logs → `/app/data/logs/`
- Archives → `/app/data/archives/`
- Cookies → `/app/data/cookies/`
- Binaries → `/app/data/bin/`
```

:::

## Configuration Basics

### Simple Config Example

```json
{
  "output": {
    "directory": ["/app/data/downloads/{category}/{user}"],
    "filename": "{date}_{id}.{extension}"
  },
  "extractor": {
    "flickr": {
      "api-key": "YOUR_API_KEY"
    }
  }
}
```

This tells gallery-dl to:

- Save downloads to `/app/data/downloads/{category}/{user}/`
- Name files as `{date}_{id}.jpg`
- Use your Flickr API key

### Common Configuration Sections

**Output**: Where files go and what to name them

```json
"output": {
  "directory": ["{category}"],
  "filename": "{date}_{id}"
}
```

**Extractor Settings**: Site-specific options (like API keys)

```json
"extractor": {
  "flickr": {
    "api-key": "your_key_here"
  }
}
```

**Cookies & Authentication**: For sites requiring login

```json
"cookies": {
  "domain.com": [{"name": "session", "value": "..."}]
}
```

::: tip  
Instead of hand-editing cookies into your config, the browser extension can sync
them for you and gdluxx will apply them automatically at job time - into the
same `/app/data/cookies/` directory mentioned above. See
[Cookie Sync](./cookies.md).  
:::

## Validation and gallery-dl policy

gdluxx separates structural validation from its policy checks. Structural
validation rejects malformed JSON, a root value that is not an object, and
excessive nesting in both modes.

Restricted mode also applies gdluxx's command and path restrictions. It rejects
command-bearing `command` and `commands` keys, `exec` and `python`
post-processors, and configured paths that are not confined to the allowed
roots. Unrestricted mode removes these restrictions. The Docker path transform
still runs before path handling in both modes.

The structured `--exec` and `--exec-after` options run arbitrary commands and
are available only in Unrestricted mode. See the
[installation guide](../getting-started/installation.md#gallery-dl-policy) for
the policy setting and its risks.

Restricted mode is a guardrail, not a sandbox. Anyone who can edit gallery-dl
configuration or options should still be treated as a trusted administrator.

## Policy Checks in Restricted Mode

Since gallery-dl runs with whatever `config.json` you save, gdluxx rejects a few
settings that would let the config file itself run arbitrary code or write
outside your data directory:

- **`exec`/`python` post-processors**, and any `command`/`commands` key,
  anywhere in the file. These run a shell command or import a Python module when
  a job finishes.
- **Paths that resolve outside your data directory.** `base-directory`,
  `part-directory`, `archive`, `path`, `cookies` (when given as a file path),
  and `cache.file` must stay under gdluxx's data directory (or your
  `DOWNLOAD_PATH`, if set. See the
  [install guide](../getting-started/installation.md#custom-download-location)).
  Values starting with `~` or containing `$`/`%` are also rejected, since
  gallery-dl would expand those after gdluxx has already validated the path.

A save that trips either policy check in Restricted mode is rejected with a 400
and nothing is written. A `config.json` already on disk that trips a check (for
example, one hand edited on the mounted volume) blocks every job until you fix
and re-save it. gdluxx never silently rewrites or deletes it. In Unrestricted
mode, these policy findings do not block saves or launches.

::: info Bare-metal downloads on a separate drive  
If you're not running in Docker and your downloads or archives live outside
gdluxx's data directory (a second drive, a NAS mount), set
`GDLUXX_CONFIG_PATH_ROOTS` (see `.env.example`) to the absolute root(s) you want
allowed, colon-separated. This only takes effect via the process environment, so
it can't be set from the config editor or an API request.  
:::

## More Info

For complete documentation, see gallery-dl docs:

- **Configuration reference**:
  [gallery-dl docs](https://github.com/mikf/gallery-dl/blob/master/docs/configuration.rst)
- **Supported sites**:
  [List of all supported sites](https://github.com/mikf/gallery-dl/blob/master/docs/supportedsites.md)
- **Keyword info**: Use gdluxx's [Keyword Info page](./keyword-info.md) to
  explore available options for each site
