<!--
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
-->

<script lang="ts">
  import browser, { Tabs } from 'webextension-polyfill';
  import { onDestroy, onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { loadSettings } from '#utils/settings';

  const ALL_URLS = '<all_urls>';
  const SUPPORTED_PERMISSION_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:']);
  const UNSUPPORTED_PAGE_MESSAGE = 'Overlay not supported on this page';

  type StatusKind = 'success' | 'error' | 'info';

  let currentUrl = $state<string>('');
  let permissionMessage = $state<string>('Overlay not permitted on this site yet.');

  let statusMessage = $state<string>('');
  let statusKind = $state<StatusKind>('info');
  let statusVisible = $state(false);

  let confirmVisible = $state(false);
  let confirmMessage = $state('');

  let allowCurrentVisible = $state(true);
  let allowAllVisible = $state(true);
  let revokeCurrentVisible = $state(false);
  let revokeAllVisible = $state(false);
  let managePermissionsVisible = $state(false);

  // Send current tab state
  let serverUrl = $state<string>('');
  let apiKey = $state<string>('');
  let isSending = $state(false);

  const statusClasses = $derived(() => {
    switch (statusKind) {
      case 'success':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-secondary-100 text-secondary-700 border border-secondary-200';
    }
  });

  const isConfigured = $derived(serverUrl.trim() !== '' && apiKey.trim() !== '');

  let statusTimeout: number | null = null;
  let pendingConfirm: (() => Promise<void> | void) | null = null;

  function showStatus(message: string, kind: StatusKind): void {
    statusMessage = message;
    statusKind = kind;
    statusVisible = true;

    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }

    statusTimeout = window.setTimeout(() => {
      statusVisible = false;
      statusTimeout = null;
    }, 4000);
  }

  function clearStatusTimer(): void {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
      statusTimeout = null;
    }
  }

  function showConfirmPrompt(message: string, onConfirm: () => Promise<void> | void): void {
    confirmMessage = message;
    confirmVisible = true;
    pendingConfirm = onConfirm;
  }

  function hideConfirmPrompt(): void {
    confirmVisible = false;
    pendingConfirm = null;
  }

  async function handleConfirmYes(): Promise<void> {
    const action = pendingConfirm;
    hideConfirmPrompt();
    if (!action) return;

    try {
      await action();
    } catch (error) {
      console.error('Permission confirmation action failed', error);
      const message = error instanceof Error ? error.message : String(error);
      showStatus(`Error: ${message}`, 'error');
    }
  }

  function handleConfirmNo(): void {
    hideConfirmPrompt();
    showStatus('Permission request cancelled', 'info');
  }

  async function getActiveTab(): Promise<Tabs.Tab | undefined> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  function formatOriginPattern(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (!SUPPORTED_PERMISSION_PROTOCOLS.has(parsed.protocol) || parsed.origin === 'null') {
        return null;
      }
      return `${parsed.origin}/*`;
    } catch {
      return null;
    }
  }

  async function syncOverlayRegistration(): Promise<void> {
    try {
      await browser.runtime.sendMessage({ action: 'syncOverlayRegistration' });
    } catch (error) {
      console.error('Failed to sync overlay registration', error);
    }
  }

  async function updatePermissionStatus(): Promise<void> {
    const tab = await getActiveTab();
    if (tab?.url) {
      currentUrl = `Current tab: ${tab.url}`;
    } else {
      currentUrl = '';
    }

    const grantedOrigins = new SvelteSet<string>();
    const permissions = await browser.permissions.getAll();
    for (const origin of permissions.origins ?? []) {
      grantedOrigins.add(origin);
    }

    const hasAllUrls = grantedOrigins.has(ALL_URLS);
    let hasCurrentSite = false;
    let message = 'Overlay not permitted on this site yet.';

    if (tab?.url) {
      const originPattern = formatOriginPattern(tab.url);
      if (originPattern && grantedOrigins.has(originPattern)) {
        hasCurrentSite = true;
        message = 'Overlay enabled for this site.';
      }
    }

    if (hasAllUrls) {
      message = 'Overlay enabled on all sites.';
    }

    permissionMessage = message;
    allowCurrentVisible = !(hasCurrentSite || hasAllUrls);
    allowAllVisible = !hasAllUrls;
    revokeCurrentVisible = hasCurrentSite && !hasAllUrls;
    revokeAllVisible = hasAllUrls;
    managePermissionsVisible = grantedOrigins.size > 0;
  }

  async function ensurePermission(origins: string[]): Promise<boolean> {
    try {
      const hasAccess = await browser.permissions.contains({ origins });
      if (hasAccess) {
        return true;
      }

      const granted = await browser.permissions.request({ origins });
      if (!granted) {
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        showStatus(
          isFirefox
            ? 'Permission denied. Check about:addons to manage permissions'
            : 'Permission denied. If you revoked permissions via chrome://extensions, re-enable them there first.',
          'error',
        );
      }
      return granted;
    } catch (error) {
      console.error('Permission request failed', error);
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
      const errorMsg = error instanceof Error ? error.message : String(error);
      showStatus(
        isFirefox
          ? `Permission request failed: ${errorMsg}`
          : 'Permission request failed. Check chrome://extensions if permissions were revoked there.',
        'error',
      );
      return false;
    }
  }

  async function injectOverlay(tabId: number): Promise<void> {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/overlay.js'],
      });
      await browser.tabs.sendMessage(tabId, { action: 'toggleOverlay' });
    } catch (error) {
      console.warn('Overlay injection failed', error);
    }
  }

  async function handleOpenOverlay(): Promise<void> {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url) {
      showStatus('No active tab detected', 'error');
      return;
    }

    const pattern = formatOriginPattern(tab.url);
    if (!pattern) {
      showStatus(UNSUPPORTED_PAGE_MESSAGE, 'error');
      return;
    }

    const hasPermission = await ensurePermission([pattern]);
    if (!hasPermission) return;

    await syncOverlayRegistration();
    try {
      await browser.tabs.sendMessage(tab.id, { action: 'toggleOverlay' });
    } catch {
      await injectOverlay(tab.id);
    }
    showStatus('Overlay command sent', 'success');
  }

  async function handleSendCurrentTab(): Promise<void> {
    if (isSending) return;

    const tab = await getActiveTab();
    if (!tab?.url) {
      showStatus('No active tab detected', 'error');
      return;
    }

    // Validate the tab URL is HTTP(S)
    const pattern = formatOriginPattern(tab.url);
    if (!pattern) {
      showStatus(UNSUPPORTED_PAGE_MESSAGE, 'error');
      return;
    }

    if (!isConfigured) {
      showStatus('Configure gdluxx URL and API key in the overlay settings first', 'info');
      return;
    }

    isSending = true;

    try {
      const response = (await browser.runtime.sendMessage({
        action: 'sendUrl',
        apiUrl: serverUrl,
        apiKey: apiKey,
        tabUrl: tab.url,
        tabTitle: tab.title,
      })) as { success: boolean; message: string };

      if (response && response.success) {
        showStatus(response.message, 'success');
      } else if (response) {
        showStatus(response.message || 'Failed to send URL', 'error');
      } else {
        showStatus('Extension error: No response from background script', 'error');
      }
    } catch (error) {
      let errorMessage = 'Failed to send URL';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      showStatus(`Error: ${errorMessage}`, 'error');
    } finally {
      isSending = false;
    }
  }

  async function handleAllowCurrent(): Promise<void> {
    const tab = await getActiveTab();
    if (!tab?.url) {
      showStatus('No active tab detected', 'error');
      return;
    }

    const pattern = formatOriginPattern(tab.url);
    if (!pattern) {
      showStatus(UNSUPPORTED_PAGE_MESSAGE, 'error');
      return;
    }

    const hasAccess = await browser.permissions.contains({ origins: [pattern] });
    if (hasAccess) {
      showStatus('Overlay already enabled for this site', 'info');
      await updatePermissionStatus();
      return;
    }

    const hostname = new URL(tab.url).hostname;
    showConfirmPrompt(
      `Grant permission to access ${hostname}? This allows the overlay to work on this site.`,
      async () => {
        try {
          const granted = await browser.permissions.request({ origins: [pattern] });
          if (granted) {
            showStatus('Overlay enabled for the current site', 'success');
            await syncOverlayRegistration();
            if (tab.id) {
              await injectOverlay(tab.id);
            }
            await updatePermissionStatus();
          } else {
            showStatus('Permission denied', 'error');
          }
        } catch (error) {
          console.error('Permission request error', error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          showStatus(`Error: ${errorMsg}`, 'error');
        }
      },
    );
  }

  async function handleAllowAll(): Promise<void> {
    const hasAccess = await browser.permissions.contains({ origins: [ALL_URLS] });
    if (hasAccess) {
      showStatus('Overlay already enabled for all sites', 'info');
      await updatePermissionStatus();
      return;
    }

    showConfirmPrompt(
      'Grant permission to access ALL websites? This allows the overlay to work on any site you visit.',
      async () => {
        try {
          const granted = await browser.permissions.request({ origins: [ALL_URLS] });
          if (granted) {
            showStatus('Overlay enabled for all sites', 'success');
            await syncOverlayRegistration();
            await updatePermissionStatus();
          } else {
            showStatus('Permission denied', 'error');
          }
        } catch (error) {
          console.error('Permission request error', error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          showStatus(`Error: ${errorMsg}`, 'error');
        }
      },
    );
  }

  async function handleRevokeCurrent(): Promise<void> {
    const tab = await getActiveTab();
    if (!tab?.url) {
      showStatus('No active tab detected', 'error');
      return;
    }

    const pattern = formatOriginPattern(tab.url);
    if (!pattern) {
      showStatus(UNSUPPORTED_PAGE_MESSAGE, 'error');
      return;
    }

    try {
      const removed = await browser.permissions.remove({ origins: [pattern] });
      if (removed) {
        showStatus('Overlay disabled for this site', 'success');
        await syncOverlayRegistration();
        await updatePermissionStatus();
      } else {
        showStatus('Failed to remove permission', 'error');
      }
    } catch (error) {
      console.error('Failed to revoke permission', error);
      showStatus('Failed to revoke permission', 'error');
    }
  }

  async function handleRevokeAll(): Promise<void> {
    const confirmed = window.confirm(
      'Remove overlay access from all sites? You will need to re-enable it manually.',
    );
    if (!confirmed) {
      return;
    }

    try {
      const removed = await browser.permissions.remove({ origins: [ALL_URLS] });
      if (removed) {
        showStatus('Overlay disabled on all sites', 'success');
        await syncOverlayRegistration();
        await updatePermissionStatus();
      } else {
        showStatus('Failed to remove permission', 'error');
      }
    } catch (error) {
      console.error('Failed to revoke all permissions', error);
      showStatus('Failed to revoke permissions', 'error');
    }
  }

  function handleManagePermissions(): void {
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    const url = isFirefox ? 'about:addons' : `chrome://extensions/?id=${browser.runtime.id}`;

    browser.tabs.create({ url }).catch(() => {
      showStatus('Open about:addons manually to manage permissions', 'info');
    });
  }

  onMount(() => {
    void updatePermissionStatus();

    void (async () => {
      try {
        const settings = await loadSettings();
        serverUrl = settings.serverUrl;
        apiKey = settings.apiKey;
      } catch (error) {
        console.error('Failed to load settings', error);
      }
    })();

    const handleStorageChange: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== 'local') return;
      const serverUrlChange = changes.gdluxx_server_url;
      if (serverUrlChange) {
        serverUrl = typeof serverUrlChange.newValue === 'string' ? serverUrlChange.newValue : '';
      }
      const apiKeyChange = changes.gdluxx_api_key;
      if (apiKeyChange) {
        apiKey = typeof apiKeyChange.newValue === 'string' ? apiKeyChange.newValue : '';
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  });

  onDestroy(() => {
    clearStatusTimer();
  });
</script>

<div class="space-y-4">
  <header class="flex items-center gap-3">
    <img
      src={new URL('../../public/icon/48.png', import.meta.url).href}
      alt="gdluxx"
      class="h-8 w-8"
    />
    <div>
      <h1 class="text-base-content text-lg font-semibold">gdluxx overlay</h1>
      <p class="text-base-content/70 text-xs">
        Control where the overlay runs and open it for this tab.
      </p>
    </div>
  </header>

  <section class="space-y-3">
    {#if !confirmVisible}
      <div class="space-y-3">
        <button
          class="btn btn-primary w-full"
          type="button"
          onclick={() => void handleOpenOverlay()}
        >
          Open overlay in this tab
        </button>

        <button
          class="btn btn-secondary w-full"
          type="button"
          disabled={isSending || !isConfigured}
          onclick={() => void handleSendCurrentTab()}
        >
          {isSending ? 'Sending...' : 'Send current tab to gdluxx'}
        </button>

        {#if !isConfigured}
          <div class="text-secondary-600 bg-secondary-100 rounded-lg p-2 text-xs">
            Configure gdluxx server URL and API key in the overlay settings to use this feature.
          </div>
        {/if}

        {#if allowCurrentVisible}
          <button
            class="btn btn-neutral w-full"
            type="button"
            onclick={() => void handleAllowCurrent()}
          >
            Enable on current site
          </button>
        {/if}

        {#if allowAllVisible}
          <button
            class="btn btn-neutral w-full"
            type="button"
            onclick={() => void handleAllowAll()}
          >
            Enable on all sites
          </button>
        {/if}

        {#if revokeCurrentVisible}
          <button
            class="btn btn-outline btn-error w-full"
            type="button"
            onclick={() => void handleRevokeCurrent()}
          >
            Disable on current site
          </button>
        {/if}

        {#if revokeAllVisible}
          <button
            class="btn btn-outline btn-error w-full"
            type="button"
            onclick={() => void handleRevokeAll()}
          >
            Disable on all sites
          </button>
        {/if}

        {#if managePermissionsVisible}
          <button
            class="btn btn-ghost btn-sm w-full"
            type="button"
            onclick={() => handleManagePermissions()}
          >
            Manage all permissions
          </button>
        {/if}
      </div>
    {:else}
      <div class="card bg-base-200 border-base-300 space-y-3 border p-4">
        <p class="text-base-content text-sm">{confirmMessage}</p>
        <div class="flex gap-2">
          <button
            class="btn btn-sm btn-primary flex-1"
            onclick={() => void handleConfirmYes()}
          >
            Grant Permission
          </button>
          <button
            class="btn btn-sm btn-ghost flex-1"
            onclick={() => handleConfirmNo()}
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}
  </section>

  <section class="text-base-content/70 space-y-2 text-xs">
    {#if currentUrl}
      <div class="break-all">{currentUrl}</div>
    {/if}
    <div class="text-base-content font-medium">{permissionMessage}</div>

    {#if statusVisible}
      <div class={`rounded-lg p-2 text-center text-sm ${statusClasses}`}>
        {statusMessage}
      </div>
    {/if}

    <details class="collapse-arrow bg-base-200 rounded-box collapse mt-3">
      <summary class="collapse-title text-xs font-medium"> Troubleshooting Permissions </summary>
      <div class="collapse-content space-y-2 text-xs">
        <p>
          <strong>Buttons not working?</strong> If you revoked permissions via
          <code class="bg-base-300 rounded px-1">chrome://extensions</code>, you need to re-enable
          them there first.
        </p>
        <p>
          <strong>To reset:</strong> Go to Chrome Extensions → gdluxx-extension → "Site access" → Choose
          "On all sites" or "On click"
        </p>
      </div>
    </details>
  </section>
</div>
