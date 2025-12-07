# Setup & Configuration

Once you've installed the extension, you need to tell it where to find your
gdluxx server and how to authenticate.

## Initial Configuration

### Step 1: Open the Popup

Click the gdluxx extension icon in your browser toolbar. A small popup appears.

### Step 2: Get Your API Key

You'll need an API key from gdluxx. In your gdluxx web interface:

1. Go to **Settings > API Key Manager**
2. Click **Create New Key**
3. Give it a name (e.g., "Chrome Extension" or "My Browser")
4. Optionally set an expiration date (or leave it blank for no expiration)
5. Click **Create**
6. Copy the key that appears (you'll only see it once)

### Step 3: Configure the Extension

Back in the extension popup:

1. **Server URL**: Enter where your gdluxx instance is running
   - Local: `http://localhost:7755`
   - Network: `http://192.168.1.100:7755`
   - Reverse proxy: `https://my-gdluxx.example.com`
2. **API Key**: Paste the key you copied from step 2
3. Click **Save Settings**

### Step 4: Test It Works

Navigate to any webpage and click the extension icon. If connected, you'll see
the current page's URL. Try sending it—you should see a job appear in gdluxx.

## Keyboard Shortcuts

The extension has a default keyboard shortcut (`Alt+L`) that opens the overlay UI
without leaving your current page.

### Changing Your Hotkey

1. Click the extension icon in your toolbar
2. Go to **Settings > Hotkeys**
3. You can:
   - **Disable the hotkey** by unchecking the toggle
   - **Edit the hotkey** by clicking the current key combination and pressing
     your preferred keys
4. Changes save automatically

### Platform Differences

- **Windows/Linux**: `Alt+L` works as expected
- **Mac**: Option+L (I've read `Option` is Mac's Alt equivalent)

### Avoiding Conflicts

If `Alt+L` conflicts with something else (a website shortcut, another extension,
etc.), you can change it. Just make sure it doesn't interfere with common
shortcuts like `Ctrl+C`, `Ctrl+V`, `Ctrl+S`, etc.

## Permissions

The extension needs certain permissions to work.

| Permission           | Why?                                                |
|:---------------------|:----------------------------------------------------|
| **Read tab URL**     | To send the current page's URL to gdluxx            |
| **Inject overlay**   | To show the overlay UI when you press your hotkey   |
| **Storage**          | To save your settings (server URL, API key, hotkey) |
| **Access all sites** | To work on any website you visit                    |
| **Context menu**     | To show "Send Image to gdluxx" when you right-click |

::: info  
Alternatively, you can enable gdluxx permissions for sites on an individual/specific basis.   
:::

### Granting Permissions

**First time on a site:**

- The extension might ask for permission on that specific site
- Click **Allow** to grant access
- Or click **Always allow on this site** if you prefer

**All sites at once:**

- In the extension popup, you can grant access to all sites
- This lets you send URLs from anywhere without being asked each time

### Revoking Permissions

Browser settings let you revoke extension permissions. Check your browser's
extension management page if you want to remove access.
