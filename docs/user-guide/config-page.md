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

::: warning Syntax Errors  
You can proceed with saving a config file with syntax errors. This is to allow
you to return to it later, however, you will not be able to run any jobs. You
will see a warning on the Run page if there are syntax errors.

gdluxx does not detect if all of your config options are compatible and/or valid
for gallery-dl, it's only checking for proper JSON formatting.  
:::

### Full-Screen Editor Mode

To help prevent having to scroll as much, you can "full screen" the editor

1. Look for the **"Full screen"** button (the top-right)
2. Click it to expand the editor to fill your browser window
3. Click the button again to exit full-screen

::: info  
It is not actual full screen It just fills up your browser window. It
doesn't affect the browser, taskbar, or anything of the sort  
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
Docker.

When you save, these paths are automatically rewritten:

- Downloads → `/app/data/downloads/`
- Logs → `/app/data/logs/`
- Archives → `/app/data/archives/`
- Cookies → `/app/data/cookies/`
- Binaries → `/app/data/bin/`

This happens automatically so you don't have to worry about Docker container
paths vs your host machine. Everything "just works". (famous last words)

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

## More Info

For complete documentation, see gallery-dl docs:

- **Configuration reference**:
  [gallery-dl docs](https://github.com/mikf/gallery-dl/blob/master/docs/configuration.rst)
- **Supported sites**:
  [List of all supported sites](https://github.com/mikf/gallery-dl/blob/master/docs/supportedsites.md)
- **Keyword info**: Use gdluxx's [Keyword Info page](./keyword-info.md) to
  explore available options for each site
