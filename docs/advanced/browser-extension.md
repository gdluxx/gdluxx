# Browser Extension

The browser extension sends the URL of the current tab from your browser to
_gdluxx_.

## Installation

The extension isn't available on browser stores yet (hopefully soon). You'll
need to install it manually.

### Chrome (and Chromium based variants)

1. Download the latest `gdluxx-browser-chrome.zip` from the
   [releases page](https://github.com/gdluxx/gdluxx-browser/releases)
2. Extract the zip file to a folder on your computer
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (toggle in the top right)
5. Click "Load unpacked" and select the extracted folder
6. The extension should now appear in your browser toolbar

### Firefox (and variants)

1. Download the latest `gdluxx-browser-firefox.zip` from the
   [releases page](https://github.com/gdluxx/gdluxx-browser/releases)
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on"
5. Select the downloaded zip file (don't extract it)
6. The extension will be loaded temporarily until you restart Firefox

Note: For permanent installation in Firefox, you'll need to
[sign the extension](https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox)
or use Firefox Developer Edition.

## How to Use

1. Make sure you have _gdluxx_ running and accessible
2. Click the extension icon in your browser toolbar
3. In the popup, enter:
   - Your _gdluxx_ server URL (e.g., `https://my-cool-domain.com` or
     `http://localhost:7755`)
   - Your API key from _gdluxx_
4. Click "Save Settings"
5. Navigate to any webpage you want to download with _gallery-dl_
6. Click the extension icon and hit "Send URL"
7. _gdluxx_ will receive the URL and start downloading
