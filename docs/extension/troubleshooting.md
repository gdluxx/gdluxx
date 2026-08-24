# Extension Troubleshooting

Common issues and how to solve them.

## Extension Won't Connect to gdluxx

**Symptom**: You see "Cannot connect" or a connection error in the extension
popup.

### Checklist

1. **Is gdluxx running?**
   - Try accessing your gdluxx URL directly in a new browser tab
   - If you can't load it, gdluxx isn't running or is at the wrong address

2. **Is the server URL correct?**
   - Check for typos (copy/paste from address bar if unsure)
   - Include the protocol: `http://` or `https://`
   - Include the port if needed: `http://localhost:7755`
   - No trailing slash: `http://localhost:7755` not `http://localhost:7755/`

3. **Is the API key correct?**
   - Regenerate a new key in gdluxx Settings > API Key Manager
   - Copy it exactly (no extra spaces)
   - Paste it into the extension settings and save

4. **Can you reach gdluxx from other devices?**
   - Try opening gdluxx in a different browser or device
   - If that works but the extension can't connect, it's likely a permission
     issue (see below)

5. **Is there a CORS issue?**
   - Open your browser's Developer Tools (F12)
   - Go to the Console tab
   - Click the extension icon and try to send a URL
   - If you see a red message about "CORS", see [CORS Errors](#cors-errors)
     below

### CORS Errors

CORS (Cross-Origin Resource Sharing) means your browser is blocking the
extension from talking to gdluxx for security reasons.

**The Error**: Something like
`Access to XMLHttpRequest at 'http://localhost:7755/...' from origin 'chrome-extension://...' has been blocked by CORS policy`

**The Fix**: This is a gdluxx configuration issue, not your browser. Check the
installation documentation about the `ORIGIN` setting
[here](/getting-started/installation#quick-start).

**Temporary Workaround** (for localhost):

- Make sure your `ORIGIN` environment variable in gdluxx is set correctly
- For local testing: `ORIGIN=http://localhost:7755`
- Restart the gdluxx container

## Overlay Not Appearing

**Symptom**: You press your hotkey but nothing happens.

::: tip Reload the page after an extension update! If you just updated your
extension. You will need to reload the page. Hotkeys won't work until you do.

Same goes if you had the overlay or lightbox (gallery) open during the update,
they will "freeze". Reloading the page will fix it.  
:::

### Checklist

1. **Did you set a hotkey?**
   - Open the extension popup
   - Go to Settings > Hotkeys
   - Make sure the toggle is ON
   - Make sure a hotkey is actually set (not blank)

2. **Is your hotkey conflicting?**
   - Try a different key combination
   - Some websites capture Alt+L for their own purposes
   - Try something like Ctrl+Shift+U instead

3. **Are permissions granted?**
   - Open your browser's extension management page
   - `chrome://extensions` (Chrome) or `about:addons` (Firefox)
   - Find gdluxx
   - Check that "Access all sites" or similar permission is granted
   - If not, grant it

4. **Does the extension have an error?**
   - Open Developer Tools (F12)
   - Look for red error messages in the Console
   - If you see JavaScript errors, try uninstalling and reinstalling the
     extension

5. **Try a different website**
   - Sometimes a website blocks overlays (security policy)
   - Go to google.com and try your hotkey there
   - If it works on google.com but not your original site, that site is blocking
     it

### Fixing Permission Issues

**Chrome/Chromium**:

1. Go to `chrome://extensions`
2. Find gdluxx
3. Click "Details"
4. Scroll to "Permissions"
5. If "All sites" or similar isn't shown as granted, click the permission
   request popup at the top of the extension detail page

**Firefox**:

1. Go to `about:addons`
2. Click gdluxx-extension
3. Open the "Permissions and data" tab
4. Under Optional permissions, toggle "Access your data for all websites" on (or
   the per-site entries for the sites you use)

## "Invalid API Key" Error

**Symptom**: "Invalid API key" appears when you try to send a URL.

### Quick Fix

1. Go to gdluxx Settings > API Key Manager
2. Create a NEW key (not the old one)
3. Copy the new key
4. Go back to extension settings
5. Paste the new key and save
6. Try again

### Why?

- The API key was deleted from gdluxx
- The key expired. Keys default to a 1-year expiry unless set to "Never
  expires?".
- There was a typo when entering it (and kudos for typing it, but try
  copy/paste)

## Context Menu Missing

**Symptom**: Right-clicking an image doesn't show "Send to gdluxx" option.

### Checklist

1. **Are you right-clicking the right thing?**
   - "gdluxx: send image" only appears when you right-click an image
   - "gdluxx: send URL" only appears when you right-click a link
   - When several options apply, they nest under a "gdluxx-extension" submenu —
     hover it to expand

2. **Is the extension enabled?**
   - Check your browser's extension management
   - Make sure gdluxx isn't disabled

3. **Try a different image**
   - Right-click an image on google.com
   - If it works there, the original site might be special

4. **Reload the page**
   - Sometimes permissions don't take effect until you reload
   - Press F5 or Cmd+R to refresh

## Overlay Appears But Won't Send URLs

**Symptom**: The overlay shows up, but clicking "Send URL" doesn't work.

### Checklist

1. **Are you connected to gdluxx?**
   - You have to fill in the Server URL and API Key with a successful "Test
     Connection"
     - Try [this first](/extension/setup#initial-configuration), if you haven't
       already
   - Check the extension settings are correct (see
     [Connection Issues](#extension-wont-connect-to-gdluxx))

2. **Is there an error message?**
   - Look for red text or error notifications
   - Screenshot it if you see one and need help

3. **Check the browser console**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Try to send again
   - Look for red error messages

## URLs Sending But Jobs Don't Appear

**Symptom**: The extension says "Sent successfully!" but no job shows up in
gdluxx.

### Checklist

1. **Refresh gdluxx**
   - Go to gdluxx in another tab and refresh (F5)
   - Sometimes jobs take a moment to appear

2. **Check your API key**
   - Create a new API key (see [Invalid API Key](#invalid-api-key-error))
   - Update the extension and try again

3. **Is gdluxx actually processing jobs?**
   - Try creating a job directly in gdluxx (not through extension)
   - If that works, it's likely an extension issue
   - If that doesn't work, gdluxx might not be running properly

4. **Check the browser console**
   - Open Developer Tools (F12)
   - Console tab
   - Look for network errors or other messages
   - Screenshot if confused

## Cookie Sync Issues

**Symptom**: "Permission denied. Cannot read cookies for this site." when you
click "Sync cookies" in the overlay's Cookies tab.

### Checklist

1. **Did you enable the permission prompt?**
   1. Click the gdluxx icon
   2. Click the "Enable cookie sync" button
   3. A new tab will open asking you to confirm, click "Grant cookie access"
   4. You should now be able to sync cookies

2. **Are you connected to gdluxx?**
   - The Cookies tab needs a server URL and API key configured first, same as
     everywhere else in the extension (see
     [Connection Issues](#extension-wont-connect-to-gdluxx))

3. **Check cookie access in the extension popup**
   - Open the gdluxx popup and look for the **Enable cookie sync** button
   - If you see it, cookie access isn't granted yet — click it and accept the
     browser's prompt
   - This permission is browser-wide, and neither Chrome nor Firefox lists it in
     their own extension settings pages — the popup is the only place to see and
     manage it

**Symptom**: You synced cookies, but a job for that site still fails or looks
like you're not logged in.

### Checklist

1. **Did you add a manual `--cookies` option?**
   - A `--cookies` value on the Run page or in a site rule always overrides
     synced cookies - see
     [Cookies & Authenticated Downloads](../user-guide/run-page.md#cookies-authenticated-downloads)

2. **Are your cookies expired?**
   - Sessions expire. Open the Cookies tab and check the expired count for the
     domain, then sync again after logging back in on that site

3. **Did you sync the right domain?**
   - Cookies synced for `example.com` also cover `sub.example.com`, but not the
     other way around unless you sync the subdomain directly - see
     [Cookie Sync](../user-guide/cookies.md#domain-matching)

## Browser-Specific Issues

### Chrome/Chromium Service Worker Issues

Chrome extensions use "service workers" which can be terminated if unused. If
the extension stops responding after a while:

1. Go to `chrome://extensions` and find gdluxx
2. Click "Inspect views: service worker" to wake it up (or use
   `chrome://serviceworker-internals`)
3. Try the extension again

### Firefox Temporary Add-on Expires

If you installed a temporary add-on on Firefox, it only lasts until you close
the browser.

1. Reinstall from the Firefox Add-ons store (permanent)
2. Or reinstall temporarily each session

## Still Having Issues?

If you've tried everything above:

1. **Disable and reinstall** the extension
   - Sometimes a clean install fixes weird issues
2. **Check your browser's developer console** (F12 > Console)
   - Copy any error messages
   - These often tell you exactly what's wrong
3. **Try a different browser**
   - If it works in Firefox but not Chrome, it's likely browser-specific
   - Helps narrow down the problem
4. **Check gdluxx logs**
   - Go to gdluxx Settings > Log Manager
   - Enable logging to file
   - Look for errors about the API request

For further help, check the
[GitHub issues page](https://github.com/gdluxx/gdluxx/issues).
