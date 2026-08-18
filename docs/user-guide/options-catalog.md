# Options Catalog

The Options Catalog is a searchable reference for every _gallery-dl_
configuration option and is generated straight from gallery-dl's own
_configuration.rst_ file. On its own, the _configuration.rst_ file is over
**11,000** lines long. And while technically detailed, it's not the friendliest
when it comes to human readability.

Find it under **Configuration > Options Catalog**.

## Searching

Type in the search box to filter options by name, description, or site. Press
**/** anywhere on the page to jump to the search box.

## Filtering by Type

The colored bar near the top shows the breakdown of option value types (boolean,
string, number, array, object, custom) across the whole catalog. Click a
segment, or its label below the bar, to filter to just that type. Click it again
to clear it. You can combine a type filter with search and the other filters
below.

## Filtering by Section

Below the search box, a row of chips (buttons) lets you jump to a specific
documentation section: Extractor, Site-specific, Downloader, Output,
Post-processing, Misc, API Tokens; or clear back to **All**. Each chip shows how
many options live in that section.

## Filtering by Site

The site picker (next to the search box) narrows the list to options relevant to
a single site. Type to filter the list by site name or key.

::: tip  
Selecting a site also surfaces options that apply to its whole family. For
example, picking a Danbooru based site shows both that site's own options and
the shared options documented once for every Danbooru family site.  
:::

## Reading an Option Row

Each row shows an option's full dotted name, its value type(s) as small badges,
and, if there's room, a preview of its default value. Click a row to expand it
and see:

- The full description
- Accepted values, when the option has a fixed set (with per-value explanations
  where gallery-dl's docs provide them)
- The default value, either a literal, or, for options that default differently
  per site, a table of value → sites
- Any documented examples, shown verbatim
- Notes, when gallery-dl's docs call out extra behavior
- A ready-to-copy JSON snippet for adding the option to your config

## Adding an Option to Your Config

Every expanded option ends with an **Add to config.json** snippet. The correctly
nested JSON for that option, using its parsed default or a type-appropriate
placeholder when the default is prose rather than a literal value. Two buttons
sit above it:

- **Add to config**: writes the option directly into your `config.json` on the
  server, without opening the Config Editor. Comments and gallery-dl's `"#"`
  pseudo-comment keys elsewhere in the file are left untouched, only the
  option's own value is added or changed.
- **Copy**: copies the snippet to your clipboard instead, if you'd rather paste
  it into the [Config Editor](./config-page.md) and merge it in by hand.

::: warning Overwriting an existing value  
If the option is already set in your config, **Add to config** shows a
confirmation dialog with the current value before doing anything, so you can
back out instead of silently overwriting it.  
:::

After a successful add, the button flips to **Added** and a toast reminds you to
reload the Config Editor if you have it open in another tab, otherwise you'd
overwrite the change on your next save there.

::: info Placeholder values  
Some options don't have a literal default gallery-dl's docs can express, the
snippet uses `"…"` for those. Adding one of these still writes it to your
config, but you'll need to edit the value afterward; it isn't valid on its
own.  
:::

## Config Backups

Every time gdluxx writes your `config.json`, including from **Add to config**,
saving in the Config Editor, or importing a file, the previous version is
snapshotted first, and the write itself is atomic (no risk of a half-written
file). Snapshots live in `config-history/` next to your `config.json`
(`./data/config-history/` by default), and only the 5 most recent are kept —
older ones are pruned automatically.

There's no restore button yet. To roll back, copy a snapshot from
`config-history/` over `config.json` yourself.

## Generated From gallery-dl vX.XX.X

Near the top of the page, a line reads **Generated from gallery-dl vX.XX.X**,
the gallery-dl release the catalog's data was pulled from. If that version
differs from the gallery-dl binary you currently have installed (see
[Version Manager](./settings-page.md#version-manager)), you'll see a mismatch
warning. That just means some options may have changed, been added, or been
removed since the catalog was generated. Check the
[upstream gallery-dl changelog](https://github.com/mikf/gallery-dl/blob/master/CHANGELOG.md)
if something looks off.

## More Info

For the option list this page is built from, see gallery-dl's own documentation:

- **Configuration reference**:
  [gallery-dl docs](https://github.com/mikf/gallery-dl/blob/master/docs/configuration.rst)
- **Supported sites**:
  [List of all supported sites](https://github.com/mikf/gallery-dl/blob/master/docs/supportedsites.md)
