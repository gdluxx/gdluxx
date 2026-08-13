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
  import { loadSiteDirectory } from '#utils/persistence';
  import { isValidSiteDirectory } from '#utils/validation';
  import { ALL_URLS, formatOriginPattern } from '#src/shared/originPattern';

  const UNSUPPORTED_PAGE_MESSAGE = 'Overlay not supported on this page';
  const REVOKE_ALL_REMOVES_INDIVIDUAL_GRANTS = !import.meta.env.FIREFOX;
  const MANIFEST_ORIGINS = new Set(browser.runtime.getManifest().host_permissions ?? []);

  type StatusKind = 'success' | 'error' | 'info';

  let currentUrl = $state<string>('');
  let permissionMessage = $state<string>('Overlay not permitted on this site yet.');

  let statusMessage = $state<string>('');
  let statusKind = $state<StatusKind>('info');
  let statusVisible = $state(false);

  let allowCurrentVisible = $state(true);
  let allowAllVisible = $state(true);
  let revokeCurrentVisible = $state(false);
  let revokeAllVisible = $state(false);
  let revokeAllConfirmVisible = $state(false);
  let individualOriginCount = $state(0);
  let managePermissionsVisible = $state(false);
  let cookiesGranted = $state(false);

  // Send current tab state
  let serverUrl = $state<string>('');
  let apiKey = $state<string>('');
  let isSending = $state(false);

  const statusClasses = $derived.by(() => {
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

  const revokeAllIsLossy = $derived(
    REVOKE_ALL_REMOVES_INDIVIDUAL_GRANTS && individualOriginCount > 0,
  );

  const revokeAllConfirmMessage = $derived(
    individualOriginCount === 1
      ? "This also removes the one site you enabled individually. You'll need to re-add it."
      : `This also removes the ${individualOriginCount} sites you enabled individually. You'll need to re-add them one at a time.`,
  );

  let statusTimeout: number | null = null;
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

  async function getActiveTab(): Promise<Tabs.Tab | undefined> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
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

    let individualCount = 0;
    for (const origin of grantedOrigins) {
      if (origin !== ALL_URLS && !MANIFEST_ORIGINS.has(origin)) {
        individualCount += 1;
      }
    }

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

    try {
      cookiesGranted = await browser.permissions.contains({ permissions: ['cookies'] });
    } catch (error) {
      console.error('Failed to read cookie permission state', error);
      cookiesGranted = false;
    }

    permissionMessage = message;
    allowCurrentVisible = !(hasCurrentSite || hasAllUrls);
    allowAllVisible = !hasAllUrls;
    revokeCurrentVisible = hasCurrentSite && !hasAllUrls;
    revokeAllVisible = hasAllUrls;

    if (!revokeAllVisible) {
      revokeAllConfirmVisible = false;
    }
    individualOriginCount = individualCount;
    managePermissionsVisible = grantedOrigins.size > 0;
  }

  async function openPermissionPage(params: Record<string, string>): Promise<void> {
    try {
      const query = new URLSearchParams(params);
      const url = browser.runtime.getURL(`/grant-permission.html?${query.toString()}`);
      await browser.tabs.create({ url });
      window.close();
    } catch (error) {
      console.error('Failed to open permission page', error);
      showStatus('Failed to open the permission request page', 'error');
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

    const hasPermission = await browser.permissions.contains({ origins: [pattern] });
    if (!hasPermission) {
      await openPermissionPage({
        kind: 'site',
        origin: pattern,
        label: new URL(tab.url).hostname,
        tabId: String(tab.id),
      });
      return;
    }

    try {
      await browser.runtime.sendMessage({ action: 'openOverlay', tabId: tab.id });
      window.close();
    } catch (error) {
      console.error('Failed to open overlay', error);
      showStatus('Failed to open the overlay in this tab', 'error');
    }
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
      let siteDirectory: string | undefined;
      try {
        const siteDir = await loadSiteDirectory();
        const hostname = new URL(tab.url).hostname;
        siteDirectory = siteDir.enabled && isValidSiteDirectory(hostname) ? hostname : undefined;
      } catch (error) {
        console.error('Failed to resolve site directory', error);
      }

      const response = (await browser.runtime.sendMessage({
        action: 'sendUrl',
        apiUrl: serverUrl,
        apiKey: apiKey,
        tabUrl: tab.url,
        tabTitle: tab.title,
        ...(siteDirectory ? { siteDirectory } : {}),
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

    const params: Record<string, string> = {
      kind: 'site',
      origin: pattern,
      label: new URL(tab.url).hostname,
    };

    if (tab.id !== undefined) {
      params.tabId = String(tab.id);
    }
    await openPermissionPage(params);
  }

  async function handleAllowAll(): Promise<void> {
    const hasAccess = await browser.permissions.contains({ origins: [ALL_URLS] });
    if (hasAccess) {
      showStatus('Overlay already enabled for all sites', 'info');
      await updatePermissionStatus();
      return;
    }

    const tab = await getActiveTab();
    const params: Record<string, string> = { kind: 'all' };
    if (tab?.id !== undefined) {
      params.tabId = String(tab.id);
    }
    await openPermissionPage(params);
  }

  async function handleAllowCookies(): Promise<void> {
    const hasAccess = await browser.permissions.contains({ permissions: ['cookies'] });
    if (hasAccess) {
      showStatus('Cookie sync already enabled', 'info');
      await updatePermissionStatus();
      return;
    }

    await openPermissionPage({ kind: 'cookies' });
  }

  async function handleRevokeCookies(): Promise<void> {
    try {
      const removed = await browser.permissions.remove({ permissions: ['cookies'] });
      if (removed) {
        showStatus('Cookie sync disabled', 'success');
        await updatePermissionStatus();
      } else {
        showStatus('Failed to remove permission', 'error');
      }
    } catch (error) {
      console.error('Failed to revoke cookie permission', error);
      showStatus('Failed to revoke permission', 'error');
    }
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

  function handleRevokeAllClick(): void {
    if (revokeAllIsLossy) {
      revokeAllConfirmVisible = true;
      return;
    }
    void performRevokeAll();
  }

  function cancelRevokeAll(): void {
    revokeAllConfirmVisible = false;
  }

  function revokeAllSuccessMessage(individualCount: number): string {
    if (individualCount === 0) {
      return 'Overlay disabled on all sites';
    }

    if (REVOKE_ALL_REMOVES_INDIVIDUAL_GRANTS) {
      return individualCount === 1
        ? 'Overlay disabled on all sites, plus the one site you enabled individually'
        : `Overlay disabled on all sites, plus ${individualCount} sites you enabled individually`;
    }

    return individualCount === 1
      ? 'Overlay disabled on all sites — the one site you enabled individually stays enabled'
      : `Overlay disabled on all sites — ${individualCount} individually enabled sites stay enabled`;
  }

  async function performRevokeAll(): Promise<void> {
    const individualCount = individualOriginCount;
    revokeAllConfirmVisible = false;

    try {
      const removed = await browser.permissions.remove({ origins: [ALL_URLS] });
      if (removed) {
        showStatus(revokeAllSuccessMessage(individualCount), 'success');
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
    const url = import.meta.env.FIREFOX
      ? 'about:addons'
      : `chrome://extensions/?id=${browser.runtime.id}`;

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
        {#if revokeAllConfirmVisible}
          <div class="card bg-base-200 border-base-300 space-y-3 border p-4">
            <p class="text-base-content text-sm font-medium">Disable the overlay everywhere?</p>
            <p class="text-base-content/70 text-xs">{revokeAllConfirmMessage}</p>
            <div class="flex gap-2">
              <button
                class="btn btn-sm btn-error flex-1"
                type="button"
                onclick={() => void performRevokeAll()}
              >
                Disable everywhere
              </button>
              <button
                class="btn btn-sm btn-ghost flex-1"
                type="button"
                onclick={() => cancelRevokeAll()}
              >
                Cancel
              </button>
            </div>
          </div>
        {:else}
          <button
            class="btn btn-outline btn-error w-full"
            type="button"
            onclick={() => handleRevokeAllClick()}
          >
            Disable on all sites
          </button>
        {/if}
      {/if}

      {#if !cookiesGranted}
        <button
          class="btn btn-neutral w-full"
          type="button"
          onclick={() => void handleAllowCookies()}
        >
          Enable cookie sync
        </button>
      {:else}
        <button
          class="btn btn-outline btn-error w-full"
          type="button"
          onclick={() => void handleRevokeCookies()}
        >
          Disable cookie sync
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
