<!--
  Copyright (C) 2025 jsouthgb

  This file is part of gdluxx.

  gdluxx is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License version 2 (GPL-2.0),
  as published by the Free Software Foundation.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { clientLogger } from '$lib/client/logger';
  import type { ServerLoggingConfig } from '$lib/server/loggingManager';
  import type { ClientLogConfig } from '$lib/client/config/logger-config';
  import { Button, Info } from '$lib/components/ui';
  import { loggingStore } from '../debug/lib';

  let serverConfig = $state({
    enabled: true,
    level: 'info',
    format: 'json',
    consoleEnabled: true,
    fileEnabled: false,
    fileDirectory: './logs',
    fileMaxSize: '10m',
    fileMaxFiles: '7d',
    performanceLogging: true,
    slowQueryThreshold: 1000,
  } as ServerLoggingConfig);

  let clientConfig = $state({
    enabled: false,
    level: 'info',
    sendToServer: false,
    bufferSize: 100,
    batchInterval: 10000,
    includeUserAgent: false,
    includeUrl: true,
  } as ClientLogConfig);

  let loading = $state(false);
  let message = $state('');

  onMount(async () => {
    await loadConfigurations();
  });

  async function loadConfigurations() {
    try {
      loading = true;

      const serverResponse = await fetch('/api/settings/server-logging');
      if (serverResponse.ok) {
        serverConfig = await serverResponse.json();
      }

      clientConfig = clientLogger.getConfig();
    } catch (error) {
      message = 'Failed to load logging configurations';
      clientLogger.error('Failed to load logging configurations:', error);
    } finally {
      loading = false;
    }
  }

  async function updateServerConfig() {
    try {
      loading = true;
      message = '';

      const response = await fetch('/api/settings/server-logging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverConfig),
      });

      if (response.ok) {
        message = 'Server logging configuration updated successfully';
        clientLogger.info('Server logging configuration updated');
      } else {
        const errorData = await response.json();
        message = errorData.error ?? 'Failed to update server logging configuration';
      }
    } catch (error) {
      message = 'Failed to update server logging configuration';
      clientLogger.error('Failed to update server logging configuration:', error);
    } finally {
      loading = false;
    }
  }

  function updateClientConfig() {
    try {
      clientLogger.updateConfig(clientConfig);
      message = 'Client logging configuration updated successfully';
      clientLogger.info('Client logging configuration updated');
    } catch (error) {
      message = 'Failed to update client logging configuration';
      clientLogger.error('Failed to update client logging configuration:', error);
    }
  }
</script>

<svelte:head>
  <title>Log Settings - gdluxx</title>
</svelte:head>

<div class="container mx-auto max-w-4xl p-6 space-y-8">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-bold dark:text-gray-900 text-gray-100">Log Settings</h1>
  </div>

  {#if message}
    <Info variant={`${message.includes('success') ? 'success' : 'warning'}`} dismissible={true}>
      {message}
    </Info>
  {/if}

  {#if loading}
    <div class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  {:else}
    <!-- Server logging config -->
    <div
      class="bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold dark:text-gray-900 text-gray-100">Server Logging</h2>
        <Button
          onclick={updateServerConfig}
          disabled={loading}
          variant="primary"
          size="sm"
          class=""
        >
          Update Server Config
        </Button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={serverConfig.enabled}
              class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span class="text-sm font-medium dark:text-gray-700 text-gray-300"
              >Enable Server Logging</span
            >
          </label>

          <div>
            <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
              >Log Level</label
            >
            <select
              bind:value={serverConfig.level}
              class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
              >Format</label
            >
            <select
              bind:value={serverConfig.format}
              class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
            >
              <option value="simple">Simple</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={serverConfig.consoleEnabled}
              class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span class="text-sm font-medium dark:text-gray-700 text-gray-300">Console Output</span>
          </label>
        </div>

        <div class="space-y-4">
          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={serverConfig.fileEnabled}
              class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span class="text-sm font-medium dark:text-gray-700 text-gray-300">File Output</span>
          </label>

          {#if serverConfig.fileEnabled}
            <div>
              <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
                >Log Directory</label
              >
              <input
                type="text"
                bind:value={serverConfig.fileDirectory}
                class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
              />
            </div>

            <div>
              <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
                >Max File Size</label
              >
              <input
                type="text"
                bind:value={serverConfig.fileMaxSize}
                placeholder="10m"
                class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
              />
            </div>

            <div>
              <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
                >Max Files to Keep</label
              >
              <input
                type="text"
                bind:value={serverConfig.fileMaxFiles}
                placeholder="7d"
                class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
              />
            </div>
          {/if}

          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={serverConfig.performanceLogging}
              class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span class="text-sm font-medium dark:text-gray-700 text-gray-300"
              >Performance Logging</span
            >
          </label>

          {#if serverConfig.performanceLogging}
            <div>
              <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
                >Slow Query Threshold (ms)</label
              >
              <input
                type="number"
                bind:value={serverConfig.slowQueryThreshold}
                min="0"
                class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
              />
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Client log config -->
    <div
      class="bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold dark:text-gray-900 text-gray-100">Client Logging</h2>
        <Button onclick={updateClientConfig} variant="primary" size="sm" class="">
          Update Client Config
        </Button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={clientConfig.enabled}
              class="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span class="text-sm font-medium dark:text-gray-700 text-gray-300"
              >Enable Client Logging</span
            >
          </label>

          <div>
            <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
              >Log Level</label
            >
            <select
              bind:value={clientConfig.level}
              class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={clientConfig.sendToServer}
              class="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span class="text-sm font-medium dark:text-gray-700 text-gray-300"
              >Send Logs to Server</span
            >
          </label>

          <label class="flex items-center space-x-3">
            <input
              type="checkbox"
              bind:checked={clientConfig.includeUrl}
              class="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span class="text-sm font-medium dark:text-gray-700 text-gray-300"
              >Include URL in Logs</span
            >
          </label>
        </div>

        <div class="space-y-4">
          {#if clientConfig.sendToServer}
            <div>
              <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
                >Buffer Size</label
              >
              <input
                type="number"
                bind:value={clientConfig.bufferSize}
                min="1"
                max="1000"
                class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
              />
            </div>

            <div>
              <label class="block text-sm font-medium dark:text-gray-700 text-gray-300 mb-1"
                >Batch Interval (ms)</label
              >
              <input
                type="number"
                bind:value={clientConfig.batchInterval}
                min="1000"
                max="60000"
                class="w-full px-3 py-2 border dark:border-gray-300 border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-900 text-gray-100"
              />
            </div>

            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={clientConfig.includeUserAgent}
                class="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
              />
              <span class="text-sm font-medium dark:text-gray-700 text-gray-300"
                >Include User Agent</span
              >
            </label>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
