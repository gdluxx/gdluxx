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
  import { clientLogger } from '$lib/client/logger';
  import type { ServerLoggingConfig } from '$lib/server/loggingManager';
  import type { ClientLogConfig } from '$lib/client/config/logger-config';
  import { Button, Toggle, Tooltip } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast';
  import { Icon } from '$lib/components';

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
  let isDockerEnvironment = $state(false);
  let pathPreview = $state<{
    path: string;
    wasTransformed: boolean;
    warnings: string[];
    errors: string[];
  } | null>(null);

  onMount(async () => {
    await loadConfigurations();
    await detectDockerEnvironment();
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
      toastStore.error('Configuration Load Failed', 'Failed to load logging configurations');
      clientLogger.error('Failed to load logging configurations:', error);
    } finally {
      loading = false;
    }
  }

  async function updateServerConfig() {
    const validation = validateServerConfig();
    if (!validation.valid) {
      toastStore.error('Validation Failed', validation.errors.join('; '));
      return;
    }

    try {
      loading = true;

      const response = await fetch('/api/settings/server-logging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverConfig),
      });

      if (response.ok) {
        toastStore.success('Server Configuration', 'Logging configuration updated successfully');
        clientLogger.info('Server logging configuration updated');
      } else {
        const errorData = await response.json();
        toastStore.error(
          'Server Configuration Failed',
          errorData.error ?? 'Failed to update server logging configuration'
        );
      }
    } catch (error) {
      toastStore.error(
        'Server Configuration Failed',
        'Failed to update server logging configuration'
      );
      clientLogger.error('Failed to update server logging configuration:', error);
    } finally {
      loading = false;
    }
  }

  function updateClientConfig() {
    try {
      clientLogger.updateConfig(clientConfig);
      toastStore.success('Client Configuration', 'Logging configuration updated successfully');
      clientLogger.info('Client logging configuration updated');
    } catch (error) {
      toastStore.error(
        'Client Configuration Failed',
        'Failed to update client logging configuration'
      );
      clientLogger.error('Failed to update client logging configuration:', error);
    }
  }

  async function detectDockerEnvironment() {
    try {
      const response = await fetch('/api/system/docker-status');
      if (response.ok) {
        const result = await response.json();
        isDockerEnvironment = result.isDocker;
      } else {
        clientLogger.warn('Failed to detect Docker environment');
        isDockerEnvironment = false;
      }
    } catch (error) {
      clientLogger.warn('Failed to detect Docker environment:', error);
      isDockerEnvironment = false;
    }
  }

  async function updatePathPreview(path: string) {
    if (!isDockerEnvironment || !path?.trim()) {
      pathPreview = null;
      return;
    }

    try {
      const response = await fetch('/api/system/transform-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, type: 'log' }),
      });

      if (response.ok) {
        const result = await response.json();
        pathPreview = {
          path: result.transformedPath,
          wasTransformed: result.wasTransformed,
          warnings: result.warnings ?? [],
          errors: result.errors ?? [],
        };
      } else {
        pathPreview = null;
      }
    } catch (error) {
      clientLogger.warn('Failed to get path preview:', error);
      pathPreview = null;
    }
  }

  // Effect to update path preview when fileDirectory changes
  $effect(() => {
    if (isDockerEnvironment && serverConfig.fileDirectory) {
      updatePathPreview(serverConfig.fileDirectory);
    } else {
      pathPreview = null;
    }
  });

  function validateServerConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (serverConfig.fileEnabled && !serverConfig.fileDirectory?.trim()) {
      errors.push('Log directory is required when file logging is enabled');
    }

    if (serverConfig.fileDirectory?.includes('..')) {
      errors.push('Path traversal not allowed in log directory');
    }

    if (serverConfig.fileDirectory && serverConfig.fileDirectory.length > 255) {
      errors.push('Log directory path too long (max 255 characters)');
    }

    if (serverConfig.slowQueryThreshold < 0) {
      errors.push('Slow query threshold must be a positive number');
    }

    // Additional validation for problematic characters
    if (serverConfig.fileDirectory) {
      const problematicChars = /[<>:"|?*]/;
      if (problematicChars.test(serverConfig.fileDirectory)) {
        errors.push('Log directory contains invalid characters');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  interface TooltipVars {
    server: Record<string, string>;
    client: Record<string, string>;
  }

  const tooltipVars: TooltipVars = {
    server: {
      enable: 'Enable/Disable server side logging',
      level: 'Minimum severity level for logs to be recorded',
      format: 'Simple for human-readable or JSON for structured formatting',
      console: 'Output server logs to console',
      file: 'Write server logs to files',
      directory: 'Server log file location',
      fileSize: 'Maximum size per log file ("10m" for 10 megabytes)',
      fileRetention: 'Log file retention policy ("7d" for 7 days)',
      performance: 'Enable detailed performance logging including database query timing',
      queryThreshold:
        'Minimum execution time in milliseconds for db queries to be logged as "slow" when performance logging is enabled',
    },
    client: {
      enable: 'Enable/disable client logging',
      level: 'Minimum severity level for logs',
      sendToServer:
        'Send batched client logs to the server via HTTP requests to centralize logging',
      includeUrl: 'Adds current page URL to each log entry for precise debugging',
      bufferSize:
        'Maximum number of log entries to keep in browser memory before sending to server (1-1000 entries)',
      batchInterval:
        'Frequency buffered client logs are sent to the server in milliseconds (1000-60000ms)',
      userAgent: 'Add browser information to log entries',
    },
  };
</script>

<svelte:head>
  <title>Log Settings - gdluxx</title>
</svelte:head>

<div class="container mx-auto max-w-4xl p-6 space-y-8">
  {#if loading}
    <div class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-strong"></div>
      <p class="mt-2 text-foreground">Loading...</p>
    </div>
  {:else}
    <!-- Server logging config -->
    <div
      class="content-panel"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="">
          Server Logging
        </h2>
        <Button
          onclick={updateServerConfig}
          disabled={loading}
          variant="outline-primary"
          size="sm"
        >
          Update Server Config
        </Button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <Toggle
            bind:checked={serverConfig.enabled}
            label="Enable Server Logging"
            tooltipContent={tooltipVars.server.enable}
            variant="primary"
            size="sm"
          />

          <div>
            <div class="flex flex-row gap-2 items-center">
              <label
                for="server-log-level"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Log Level
                <Tooltip
                  maxWidth="32rem"
                  class="!whitespace-normal !min-w-80"
                  content={tooltipVars.server.level}
                >
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
            </div>
            <select
              id="server-log-level"
              bind:value={serverConfig.level}
              class="form-select"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <div class="flex flex-row gap-2 items-center">
              <label
                for="server-format"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Log Format
                <Tooltip
                  maxWidth="32rem"
                  class="!whitespace-normal !min-w-80"
                  content={tooltipVars.server.format}
                >
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
            </div>
            <select
              id="server-format"
              bind:value={serverConfig.format}
              class="form-select"
            >
              <option value="simple">Simple</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <Toggle
            bind:checked={serverConfig.consoleEnabled}
            label="Console Output"
            tooltipContent={tooltipVars.server.console}
            variant="primary"
            size="sm"
          />
        </div>

        <div class="space-y-4">
          <Toggle
            bind:checked={serverConfig.fileEnabled}
            label="File Output"
            tooltipContent={tooltipVars.server.file}
            variant="primary"
            size="sm"
          />

          {#if serverConfig.fileEnabled}
            <div>
              <label
                for="server-file-directory"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Log Directory
                <Tooltip maxWidth="" content={tooltipVars.server.directory}>
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
              <input
                id="server-file-directory"
                type="text"
                bind:value={serverConfig.fileDirectory}
                class="form-input"
              />

              <!-- Docker path preview -->
              {#if isDockerEnvironment && pathPreview}
                <div
                  class="mt-2 p-3 bg-surface-elevated rounded-sm text-sm border-strong"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <Icon iconName="settings" size={16} class="text-foreground" />
                    <span class="text-foreground font-medium">
                      Docker Environment Detected
                    </span>
                  </div>

                  {#if pathPreview.wasTransformed}
                    <div class="ml-6">
                      <div class="text-info">
                        Transformed path: <code
                          class="font-mono bg-primary/10 px-1 py-0.5 rounded text-xs"
                        >
                          {pathPreview.path}
                        </code>
                      </div>

                      <!-- Warnings for special transformations -->
                      {#each pathPreview.warnings as warning, index (index)}
                        <div class="mt-1 text-warning flex items-start gap-1">
                          <Icon iconName="question" size={14} class="mt-0.5 flex-shrink-0" />
                          <span class="text-xs">{warning}</span>
                        </div>
                      {/each}

                      <!-- Errors if any -->
                      {#each pathPreview.errors as error, index (index)}
                        <div class="mt-1 text-error flex items-start gap-1">
                          <Icon iconName="close" size={14} class="mt-0.5 flex-shrink-0" />
                          <span class="text-xs">{error}</span>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="ml-6 text-foreground text-xs">
                      Path is already compatible with Docker environment
                    </div>
                  {/if}
                </div>
              {:else if isDockerEnvironment}
                <div
                  class="mt-2 p-2 bg-primary/10 rounded text-xs text-foreground border-strong"
                >
                  <Icon iconName="settings" size={14} class="inline mr-1" />
                  Docker environment detected - paths will be automatically transformed
                </div>
              {/if}
            </div>

            <div>
              <label
                for="server-file-max-size"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Max File Size
                <Tooltip
                  maxWidth="32rem"
                  class="!whitespace-normal !min-w-80"
                  content={tooltipVars.server.fileSize}
                >
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
              <input
                id="server-file-max-size"
                type="text"
                bind:value={serverConfig.fileMaxSize}
                placeholder="10m"
                class="form-input"
              />
            </div>

            <div>
              <label
                for="server-file-max-files"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Max Files to Keep
                <Tooltip
                  maxWidth="32rem"
                  class="!whitespace-normal !min-w-80"
                  content={tooltipVars.server.fileRetention}
                >
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
              <input
                id="server-file-max-files"
                type="text"
                bind:value={serverConfig.fileMaxFiles}
                placeholder="7d"
                class="form-input"
              />
            </div>
          {/if}

          <Toggle
            bind:checked={serverConfig.performanceLogging}
            label="Performance Logging"
            tooltipContent={tooltipVars.server.performance}
            variant="primary"
            size="sm"
          />

          {#if serverConfig.performanceLogging}
            <div>
              <label
                for="server-slow-query-threshold"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Slow Query Threshold (ms)
                <Tooltip
                  maxWidth="32rem"
                  class="!whitespace-normal !min-w-80"
                  content={tooltipVars.server.queryThreshold}
                >
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
              <input
                id="server-slow-query-threshold"
                type="number"
                bind:value={serverConfig.slowQueryThreshold}
                min="0"
                class="form-input"
              />
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Client log config -->
    <div
      class="content-panel"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="">
          Client Logging
        </h2>
        <Button onclick={updateClientConfig} variant="outline-primary" size="sm" class="">
          Update Client Config
        </Button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <Toggle
            bind:checked={clientConfig.enabled}
            label="Enable Client Logging"
            tooltipContent={tooltipVars.client.enable}
            variant="primary"
            size="sm"
          />

          <div>
            <label
              for="client-log-level"
              class="block text-sm font-medium text-muted-foreground mb-1"
              >Log Level</label
            >
            <select
              id="client-log-level"
              bind:value={clientConfig.level}
              class="form-select"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <Toggle
            bind:checked={clientConfig.sendToServer}
            label="Send Logs to Server"
            tooltipContent={tooltipVars.client.sendToServer}
            variant="primary"
            size="sm"
          />

          <Toggle
            bind:checked={clientConfig.includeUrl}
            label="Include URL in Logs"
            tooltipContent={tooltipVars.client.includeUrl}
            variant="primary"
            size="sm"
          />
        </div>

        <div class="space-y-4">
          {#if clientConfig.sendToServer}
            <div>
              <label
                for="client-buffer-size"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Buffer Size
                <Tooltip
                  maxWidth="32rem"
                  class="!whitespace-normal !min-w-80"
                  content={tooltipVars.client.bufferSize}
                >
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
              <input
                id="client-buffer-size"
                type="number"
                bind:value={clientConfig.bufferSize}
                min="1"
                max="1000"
                class="form-input"
              />
            </div>

            <div>
              <label
                for="client-batch-interval"
                class="block text-sm font-medium text-muted-foreground mb-1"
              >
                Batch Interval (ms)
                <Tooltip
                  maxWidth="32rem"
                  class="!whitespace-normal !min-w-80"
                  content={tooltipVars.client.batchInterval}
                >
                  <Icon iconName="question" size={20} class="text-muted-foreground" />
                </Tooltip>
              </label>
              <input
                id="client-batch-interval"
                type="number"
                bind:value={clientConfig.batchInterval}
                min="1000"
                max="60000"
                class="form-input"
              />
            </div>

            <Toggle
              bind:checked={clientConfig.includeUserAgent}
              label="Include User Agent"
              tooltipContent={tooltipVars.client.userAgent}
              variant="primary"
              size="sm"
            />
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
