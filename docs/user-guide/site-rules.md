# Site Rules

Site Rules let you automatically apply specific
[gallery-dl options](https://github.com/mikf/gallery-dl/blob/master/docs/options.md)
based on the website URL. Instead of manually adding options every time you
download from Instagram, you can create a rule that applies your Instagram
settings automatically.

## What Are Site Rules?

A site rule is a pattern + settings combination:

- **Pattern**: "Match URLs that look like this..." (e.g., all Instagram URLs)
- **Settings**: "...and apply these gallery-dl options automatically"

### Why Use Them?

Different sites need different settings. For example:

- **Instagram**: You might want smaller image size, rate limiting
- **Twitter**: You might want to skip retweets, only get original content
- **Etsy**: You might want a specific naming pattern for files

Without site rules, you'd add these options manually every time. Or to your
config file. This feature also allows you to easily disable the rule.

## Viewing Supported Sites

Before creating a rule, you can see what sites gallery-dl supports.

### How to View

1. Go to **Site Rules** in the main navigation
2. Click "Refresh Sites"
   - gdluxx will retrieve the current list of supported sites from gallery-dl
3. Click "Add Rule"
4. Start typing the site name in the "Site Pattern" box

::: info  
gdluxx is nothing without gallery-dl. If gallery-dl doesn't support a site,
gdluxx won't work on it.  
:::

### What You'll See

For each site:

- **Site name** (e.g., "instagram", "twitter")
- **URL patterns** (e.g., "instagram.com/...")
- **Extract types** (what it can download: photos, videos, albums, etc.)

This helps you understand which patterns to use when creating your rules.

## Creating a Site Rule

### Step 1: Navigate to Site Rules

Click **Site Rules** in the main menu.

### Step 2: Click "Add Rule"

Find and click the button to add a new rule. A form appears.

### Step 3: Choose Your Site

1. Select the site from a dropdown or search
2. The URL pattern for that site appears automatically
3. Example: `instagram.com` or `twitter.com`

### Step 4: Add Your Options

In the **CLI Options** field, add gallery-dl command-line options:

```
--range 1-50 --write-metadata
```

These are the same options you'd use on the Run page, but they'll now apply
automatically to this site.

### Step 5: Save

Click **Save Rule**. It's now active.

## Understanding URL Patterns

Site rule patterns tell gdluxx which URLs to match.

### Simple Patterns

Most patterns are straightforward:

- `instagram.com` - Matches any Instagram URL
- `twitter.com` - Matches any Twitter URL
- `reddit.com` - Matches any Reddit URL

### Sub-domain Patterns

Some sites use subdomains:

- `pixiv.net` - Matches pixiv.net and any subdomain
- `deviantart.com` - Matches deviantart and any subdomain

gdluxx handles this automatically when you select the site.

### What You Don't Need

You typically don't need to write complex patterns. The pattern is generated for
you when you pick a site from the list. Just pick the site and you're good.

### Exception

You can use an `*` if you want to match, for example, all subdomains. Or you
could use `*` for the Site Pattern to apply a rule to all sites, such as
`--write-metadata`

## Common Site Rule Examples

### Example 1: Instagram with Rate Limiting

**Site**: Instagram **Options**: `--range 1-100 --wait 2`

This limits to 100 images per gallery and waits 2 seconds between requests
(polite to Instagram).

### Example 2: Reddit - Save Metadata

**Site**: Reddit **Options**: `--write-metadata`

Saves metadata to a separate JSON file.

## Managing Your Rules

Once created, you can view, edit, and delete rules.

### Viewing Rules

1. Go to **Site Rules**
2. You'll see a list of all your existing rules
3. Each shows:
   - The site display name
   - The number of options being applied
   - The pattern to match
   - Buttons to edit, delete, or disable/enable

### Editing a Rule

1. Click the **Edit** button on a rule
2. Change the options
3. Click **Save**

Changes apply to future downloads immediately.

### Deleting a Rule

1. Click the **Delete** button (trash icon) on a rule
2. Confirm the deletion
3. The rule is removed

Future downloads won't use those options anymore.

### Enabling/Disabling Rules

You can disable a rule temporarily without deleting it:

1. Find the rule in your list
2. Toggle the **Enable/Disable** switch
3. When disabled, the rule won't apply
4. When re-enabled, it works again

Great for testing or temporarily changing behavior.

## How Rules Interact with Manual Options

If you add manual options on the Run page AND a site rule applies to the URL:

- **Your manual options take priority**
- **The site rule still applies** for any options you didn't manually specify

Example:

- Site rule says: `--wait 2 --range 1-100`
- You manually add: `--range 1-50`
- Result: Uses `--range 1-50` (your setting), and `--wait 2` (from rule)

This lets you fine-tune without recreating rules.

### Override Warnings

By default, gdluxx warns you when your manual options might override a site
rule. This helps you notice conflicts.

If you find these warnings annoying:

1. Go to **Settings > General Manager**
2. Find **"Show site rule override warnings"**
3. Uncheck it
4. You won't see warnings anymore (but rules still apply)

You can turn them back on anytime.
