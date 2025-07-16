# The Config Editor

_gdluxx_ has built-in editor for your _gallery-dl_ `config.json` file. Use it to
set options that apply to all downloads.

The config file is where you customize how _gallery-dl_ behaves; such as
download directories, filename patterns, authentication credentials for sites,
and extractor-specific settings.

### Editor Features

- **Syntax Highlighting & Validation**: Helps you write valid JSON and avoid
  errors. It will show a red marker next to lines with problems.
- **Save**: Click the save button to apply your changes.
- **Upload Config**: Use the `Upload Config` button at the top to upload an
  existing `config.json` file.

For a full list of what you can put in the config file, see the
[official gallery-dl configuration docs](https://github.com/mikf/gallery-dl/blob/master/docs/configuration.rst).

::: info Important!  
Your configuration file will be modified, as outlined below, once you save it.

_gdluxx_ has an opinionated approach in regard to configuration file paths to
accommodate Docker bind mounts. The intention here is to alleviate the need for
you to consider the paths between the container and your host.

- Downloads -> `/app/data/downloads/`
- Logs -> `/app/data/logs/`
- Archives -> `/app/data/archives/`
- Cookies -> `/app/data/cookies/`
- Binaries -> `/app/data/bin/`

The `/app/data` portion gets us out of the container and then continues on to
logical organization.  
:::
