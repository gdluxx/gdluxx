# The Run Page

This is where you start downloads. Paste URLs, add options, and let gallery-dl
do the work.

## How to Use

### 1. Enter Your URL(s)

Paste one or more URLs into the **URL(s) to process** field.

- **Single URL**: Just paste one link
- **Multiple URLs**: Add more than one URL by:
  - Pressing Enter between each URL (new line)
  - Separating them with spaces
  - Mixing both methods

Examples:

```
https://example.com/gallery1
https://example.com/gallery2
https://example.com/gallery3
```

Or on one line: `https://example.com/gallery1 https://example.com/gallery2`

### 2. Add Options if you like

The **Options** field lets you add gallery-dl command-line flags for this
specific job.

These are one-off settings that apply only to these URLs. Your site rules and
config still apply too.

**Common options**:

- `--range 1-10` - Download first 10 items only
- `--verbose` - Show detailed output (helpful for debugging)
- `--write-metadata` - Save metadata files alongside downloads
- `--no-skip` - Re-download even if files already exist

::: tip  
Not all gallery-dl options are available. Some are handled by gdluxx in other
ways, and some don't/won't work in the Docker environment.  

Example: `-i` and `-I` aren't needed since you can paste multiple URLs  
:::

### 3. Submit

Click **Run** to start your job(s).

If you submitted multiple URLs, each becomes a separate job in gdluxx.

## What Happens Next

A modal pops up showing the **first job's output**. You can:

- Watch it in real-time
- Close the modal and do something else
- Check the Jobs page anytime to see progress

Each URL becomes its own job, so you can monitor them individually on the Jobs
page.

::: info  
gdluxx is just using gallery-dl. So it will not work any quicker, slower, or
different from how gallery-dl works when you use it in a terminal  
:::

## Site Rules & Manual Options

If you have [Site Rules](./site-rules.md) set up:

- **Your manual options** take priority when they conflict
- **Site rule options** still apply for things you didn't manually specify

**Example**:

- Site rule for Instagram: `--wait 2 --range 1-100`
- You manually add: `--range 1-50`
- Result: Uses `--range 1-50` (your override), but still uses `--wait 2` (from
  site rule)

### Override Warnings

By default, you'll see a warning if your manual options might override a site
rule to help you catch unintended conflicts.

You can disable these warnings if you find them annoying:

   - Go to **Settings > General Manager**
   - Find **"Show site rule override warnings"**
   - Uncheck it

See [Site Rules](./site-rules.md) for more information.
