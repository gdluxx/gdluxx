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
  import browser from 'webextension-polyfill';
  import { onDestroy } from 'svelte';
  import { originUrlFromPattern } from '#src/shared/originPattern';

  type GrantState = 'ready' | 'requesting' | 'granted' | 'denied' | 'error';
  type PermissionRequest = Parameters<typeof browser.permissions.request>[0];

  interface GrantConfig {
    title: string;
    description: string;
    buttonLabel: string;
    request: PermissionRequest;
    tabId?: number;
  }

  const query = new URLSearchParams(window.location.search);
  const iconUrl = browser.runtime.getURL('/icon/48.png');

  function parseTabId(raw: string | null): number | undefined {
    if (raw === null) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  function getConfig(): GrantConfig | null {
    switch (query.get('kind')) {
      case 'site': {
        const origin = query.get('origin');
        const label = query.get('label');
        if (!origin || !label || originUrlFromPattern(origin) === null) return null;
        return {
          title: `Enable gdluxx on ${label}`,
          description: 'Allow gdluxx to display and control its download overlay on this website.',
          buttonLabel: 'Grant site access',
          request: { origins: [origin] },
          tabId: parseTabId(query.get('tabId')),
        };
      }
      case 'all':
        return {
          title: 'Enable gdluxx on all sites',
          description:
            'Allow gdluxx to display and control its download overlay on any website you visit.',
          buttonLabel: 'Grant access to all sites',
          request: { origins: ['<all_urls>'] },
          tabId: parseTabId(query.get('tabId')),
        };
      case 'cookies':
        return {
          title: 'Enable cookie sync',
          description:
            'Allow gdluxx to read cookies for sites where you enabled the overlay. This lets gallery-dl use your logged-in session for private content.',
          buttonLabel: 'Grant cookie access',
          request: { permissions: ['cookies'] },
        };
      default:
        return null;
    }
  }

  const config = getConfig();
  let grantState = $state<GrantState>(config ? 'ready' : 'error');
  let errorMessage = $state(config ? '' : 'This permission request is invalid or incomplete.');
  let closeTimeout: number | null = null;

  async function closePage(): Promise<void> {
    try {
      const tab = await browser.tabs.getCurrent();
      if (tab?.id !== undefined) {
        await browser.tabs.remove(tab.id);
        return;
      }
    } catch (error) {
      console.error('Failed to close permission tab', error);
    }
    window.close();
  }

  async function requestPermission(): Promise<void> {
    if (!config || grantState === 'requesting') return;

    grantState = 'requesting';
    errorMessage = '';
    try {
      const granted = await browser.permissions.request(config.request);
      if (!granted) {
        grantState = 'denied';
        return;
      }

      grantState = 'granted';

      if (config.tabId !== undefined) {
        try {
          await browser.runtime.sendMessage({ action: 'openOverlay', tabId: config.tabId });
        } catch (error) {
          console.error('Failed to request overlay open', error);
        }
      }

      closeTimeout = window.setTimeout(() => void closePage(), 900);
    } catch (error) {
      console.error('Permission request failed', error);
      grantState = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  onDestroy(() => {
    if (closeTimeout !== null) window.clearTimeout(closeTimeout);
  });
</script>

<main class="bg-base-200 flex min-h-screen items-center justify-center p-6">
  <section class="card card-border bg-base-100 w-full max-w-xl shadow-lg">
    <div class="card-body gap-5">
      <header class="flex items-center gap-3">
        <img
          src={iconUrl}
          alt=""
          class="h-10 w-10"
        />
        <div>
          <p class="text-base-content/60 text-sm">gdluxx extension</p>
          <h1 class="card-title">{config?.title ?? 'Permission request unavailable'}</h1>
        </div>
      </header>

      <p class="text-base-content/80">{config?.description ?? errorMessage}</p>

      {#if grantState === 'requesting'}
        <div
          class="alert alert-info"
          role="status"
        >
          <span class="loading loading-spinner loading-sm"></span>
          <span>Waiting for the browser permission prompt…</span>
        </div>
      {:else if grantState === 'granted'}
        <div
          class="alert alert-success"
          role="status"
        >
          Permission granted. This tab will close automatically.
        </div>
      {:else if grantState === 'denied'}
        <div
          class="alert alert-warning"
          role="status"
        >
          Permission was not granted. You can try again or close this tab.
        </div>
      {:else if grantState === 'error'}
        <div
          class="alert alert-error"
          role="alert"
        >
          {errorMessage}
        </div>
      {/if}

      <div class="card-actions justify-end">
        <button
          class="btn btn-ghost"
          type="button"
          onclick={() => void closePage()}
        >
          {grantState === 'granted' ? 'Close now' : 'Cancel'}
        </button>
        {#if config && grantState !== 'granted'}
          <button
            class="btn btn-primary"
            type="button"
            disabled={grantState === 'requesting'}
            onclick={() => void requestPermission()}
          >
            {grantState === 'requesting' ? 'Waiting…' : config.buttonLabel}
          </button>
        {/if}
      </div>
    </div>
  </section>
</main>
