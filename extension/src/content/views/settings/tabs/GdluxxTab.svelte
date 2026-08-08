<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  import { onMount } from 'svelte';
  import browser from 'webextension-polyfill';
  import { Button, Info } from '#components/ui';
  import type { Settings } from '#utils/settings';
  import {
    EXTENSION_KNOWN_PROTOCOL_VERSION,
    getServerCompat,
    SERVER_COMPAT_STORAGE_KEY,
    type ServerCompat,
  } from '#src/shared/serverCompat';

  interface GdluxxTabProps {
    settings: Settings;
    serverUrlError: boolean;
    apiKeyError: boolean;
    isSavingSettings: boolean;
    isTestingConnection: boolean;
    onServerUrlInput: (value: string) => void;
    onApiKeyInput: (value: string) => void;
    onTest: () => void | Promise<void>;
    onSave: () => void | Promise<void>;
    onReset: () => void | Promise<void>;
  }

  const {
    settings = $bindable<Settings>(),
    serverUrlError,
    apiKeyError,
    isSavingSettings,
    isTestingConnection,
    onServerUrlInput,
    onApiKeyInput,
    onTest,
    onSave,
    onReset,
  }: GdluxxTabProps = $props();
  let serverCompat = $state<ServerCompat | null>(null);

  const showProtocolUpdateBanner = $derived(
    typeof serverCompat?.protocolVersion === 'number' &&
      serverCompat.protocolVersion > EXTENSION_KNOWN_PROTOCOL_VERSION,
  );

  async function refreshServerCompat(): Promise<void> {
    try {
      serverCompat = await getServerCompat();
    } catch (error) {
      console.error('Failed to load server compatibility record', error);
    }
  }

  onMount(() => {
    void refreshServerCompat();

    const handleStorageChange: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== 'local') return;
      if (SERVER_COMPAT_STORAGE_KEY in changes) {
        void refreshServerCompat();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  });
</script>

<div class="mx-2 my-4 max-w-[640px]">
  {#if showProtocolUpdateBanner}
    <Info
      variant="warning"
      soft
      class="mb-4"
    >
      The gdluxx server is running a newer protocol (v{serverCompat?.protocolVersion}) than this
      extension supports (v{EXTENSION_KNOWN_PROTOCOL_VERSION}). Update the gdluxx browser extension
      to get the latest features.
    </Info>
  {/if}
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Integration Settings</div>
      <label
        for="server-url"
        class="block"
      >
        <span class="text-base-content mx-2 mb-1.5 block text-sm font-medium">
          Server URL
          <span class="text-error">*</span>
        </span>
        <div class="relative">
          <input
            id="server-url"
            class={`input-bordered input focus:ring-primary/20 w-full pr-10 transition-all focus:ring-2 ${serverUrlError ? 'input-error focus:input-error' : 'focus:input-primary'} ${isSavingSettings || isTestingConnection ? 'input-disabled' : ''}`}
            placeholder="http://localhost:5173 or https://gdluxx.example.com"
            disabled={isSavingSettings || isTestingConnection}
            value={settings.serverUrl}
            oninput={(event) => onServerUrlInput((event.target as HTMLInputElement).value)}
          />
          {#if isSavingSettings || isTestingConnection}
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              <span class="loading loading-sm loading-spinner"></span>
            </div>
          {/if}
        </div>
        {#if serverUrlError}
          <p class="text-error mx-2 mt-1 text-sm">
            {settings.serverUrl ? 'Invalid URL format' : 'This field is required'}
          </p>
        {:else}
          <span class="text-base-content/60 mx-2 mt-1 block text-xs">
            Enter the full URL/port to your gdluxx server
          </span>
        {/if}
      </label>
      <div class="mb-4">
        <label
          for="api-key"
          class="block"
        >
          <span class="text-base-content mx-2 mb-1.5 block text-sm font-medium">
            API Key
            <span class="text-error">*</span>
          </span>
          <div class="relative">
            <input
              id="api-key"
              class={`input-bordered input focus:ring-primary/20 w-full pr-10 transition-all focus:ring-2 ${apiKeyError ? 'input-error focus:input-error' : 'focus:input-primary'} ${isSavingSettings || isTestingConnection ? 'input-disabled' : ''}`}
              type="password"
              placeholder="Enter your gdluxx API key"
              disabled={isSavingSettings || isTestingConnection}
              value={settings.apiKey}
              oninput={(event) => onApiKeyInput((event.target as HTMLInputElement).value)}
            />
            {#if isSavingSettings || isTestingConnection}
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <span class="loading loading-sm loading-spinner"></span>
              </div>
            {/if}
          </div>
          {#if apiKeyError}
            <p class="text-error mx-2 mt-1 text-sm">This field is required</p>
          {:else}
            <span class="text-base-content/60 mx-2 mt-1 block text-xs">
              Settings → API Keys in gdluxx
            </span>
          {/if}
        </label>
      </div>
      <div class="card-actions justify-end">
        <Button
          variant="secondary"
          onclick={onTest}
          disabled={isTestingConnection || isSavingSettings}
        >
          {#if isTestingConnection}
            <span class="loading loading-sm loading-spinner"></span>
            Testing...
          {:else}
            Test Connection
          {/if}
        </Button>
        <Button
          variant="primary"
          onclick={onSave}
          disabled={isSavingSettings || isTestingConnection}
        >
          {#if isSavingSettings}
            <span class="loading loading-sm loading-spinner"></span>
            Saving...
          {:else}
            Save Settings
          {/if}
        </Button>
        <Button
          variant="ghost"
          onclick={onReset}
        >
          Reset
        </Button>
      </div>
    </div>
  </div>
</div>
