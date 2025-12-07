# Keyword Info

The Keyword Info page helps you understand what metadata gallery-dl can extract
from different sites. It's useful when you're creating filename patterns or just
want to see what information is available.

Under the hood, we're just running the
[gallery-dl options](https://github.com/mikf/gallery-dl/blob/master/docs/options.md)
`--extractor-info` and `--list-keywords`.

## What Is This Page For?

gallery-dl uses **keywords** to create filenames and organize downloads.
Keywords are placeholders that get replaced with real values.

For example, if the keywords below are available for an extractor:

- `{user}` becomes the username
- `{id}` becomes the ID
- `{date}` becomes the date

Different sites have different keywords available. This page shows you what's
available for each site.

## Understanding Keywords vs Extractors

**Extractors** are what gallery-dl uses to download from specific sites.
**Keywords** are the data points that extractor can extract.

Think of it like:

- Extractor = "the person who goes to Instagram and gets data"
- Keywords = "the different pieces of data they can view (username, post ID,
  caption, etc.)"

## Getting Started

### Step 1: Go to the Keyword Info Page

Click **Keyword Info** in the main menu.

### Step 2: Enter a URL

Paste a URL  
Example: `https://wallhaven.cc/w/e873x8`

### Step 3: Click the List Keywords button

You'll see everything the extractor is retrieving. These are the keywords you
can use in your configuration file.

## What You're Seeing

The output shows the actual data for that URL:

```
Keywords for directory names:
-----------------------------
category
  wallhaven
colors[N]
  0 #000000
  1 #ff9900
  2 #ffcc33
  3 #424153
  4 #663300
date
  2025-08-08 15:12:23
favorites
  226
file_size
  1072049
file_type
  image/png
```

And further down, there's a different section

```
Keywords for filenames and --filter:
------------------------------------
category
  wallhaven
colors[N]
  0 #000000
  1 #ff9900
  2 #ffcc33
  3 #424153
  4 #663300
date
  2025-08-08 15:12:23
extension
  png
favorites
  226
file_size
  1072049
file_type
  image/png
filename
  wallhaven-e873x8
```

Each line is a keyword you can use in your config file.

## Using Keywords in Your Config

```json
{
  "extractor": {
    "wallhaven": {
      "directory": "{category}",
      "filename": "{filename}.{extension}"
    }
  }
}
```

Now, in your `base-directory`, gallery-dl will create the following
directory/filename.

`wallhaven/wallhaven-e873x8.png`

Many times, keywords that are available for the directory name will also be
available for the filename, but not always. If you typo a Keyword or try to use
one that doesn't exist for the extractor, you'll see "none" used in its place.
An easy way to know there's something you need to fix.

## Running Extractor Info

**Extractor info** is another option, which shows two items:

- The default configuration for the extractor (supported site)
- Your custom configuration options for that extractor

**How to run it**:

Same as List Keywords, except click the Extractor Info button

### When to Use Extractor Info

After you've configured an extractor to view what you're expecting is matching
what gallery-dl will do. From the example above:

```
Category / Subcategory
  "wallhaven" / "image"

Filename format (custom):
  "{filename}.{extension}"
Filename format (default):
  "{category}_{id}_{resolution}.{extension}"

Directory format (custom):
  "{category}"
Directory format (default):
  ["{category}"]

Archive format (default):
  "{id}"

Request interval (custom):
  0
Request interval (default):
  1.4
```

What this tells us, is if we didn't configure the extractor in our config file,
gallery-dl would use the below for the filename.

`{category}_{id}_{resolution}.{extension}`

But because we did configure the extractor, gallery-dl will instead use

`{filename}.{extension}`

You can spot the differences with the notes `(default)` and `(custom)`

## Custom Extractors

If you've added custom extractors (through `module-sources` in your config), you
can test keywords the same way.
