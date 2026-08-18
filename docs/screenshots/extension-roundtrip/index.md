# Extension Round Trip

A walkthrough of connecting the browser extension to gdluxx and sending your
first download through it.

## 1. Create an API Key in gdluxx

In gdluxx, go to Settings > API Key Manager and create a new key with a
descriptive name. Copy it immediately — you won't be able to see it again once
you navigate away.

<div style="text-align: center;">

![API Key Created](1.api-key-created.png){.screenshot}

</div>

## 2. Connect the Extension to gdluxx

Open the extension's gdluxx Connection settings tab and paste in your server URL
and the API key you just created, then save. This connection is required before
you can send URLs, sync extraction profiles, or use remote backups.

<div style="text-align: center;">

![Extension Connection Tab](2.extension-connection-tab.png){.screenshot}

</div>

## 3. Test the Connection

Click Test Connection to verify the server URL and API key work before you rely
on them. A successful test confirms the extension can actually reach your gdluxx
server.

<div style="text-align: center;">

![Test Connection Success(3.test-connection-success.png){.screenshot}

</div>

## 4. Open the Overlay on a Page

Open the overlay on a page you want to pull content from — via the toolbar
popup, your configured hotkey, or the right-click menu. It immediately extracts
the page's images and links into separate Images and URLs tabs.

<div style="text-align: center;">

![Overlay Opened](4.overlay-opened.png){.screenshot}

</div>

## 5. Select What to Send

Filter or browse the extracted items, then select the ones you want using the
Selection dropdown (All, None, or Invert) or by clicking individual rows. The
status bar tracks how many items are visible and how many are currently
selected.

<div style="text-align: center;">

![Overlay Selection](5.overlay-selection.png){.screenshot}

</div>

## 6. Send to gdluxx

Click Send to gdluxx in the action bar to send your selected items as jobs. A
confirmation dialog shows the count before anything actually sends, and up to 25
URLs can go in a single request.

<div style="text-align: center;">

![Send to gdluxx](6.send-to-gdluxx.png){.screenshot}

</div>

## 7. Check the Jobs List

Back in gdluxx, the Jobs page shows each sent URL as its own job, so you can
watch them download and check their status the same way as jobs started from the
Run page.

<div style="text-align: center;">

![Jobs List from Extension](7.jobs-list-from-extension.png){.screenshot}

</div>

## 8. Sync Cookies for Login-Gated Sites

For sites that require you to be signed in, open the overlay's Cookies settings
tab and click Sync cookies for current site. gdluxx then applies your synced
session automatically to any job matching that domain — no manual `--cookies`
option needed.

<div style="text-align: center;">

![Cookie Sync Tab](8.cookie-sync-tab.png){.screenshot}

</div>
