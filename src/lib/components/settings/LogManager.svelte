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
  import { onMount, untrack } from 'svelte';
  import { clientLogger } from '$lib/client/logger';
  import {
    DEFAULT_SERVER_LOGGING_UI_CONFIG,
    LOG_FORMAT_LABELS,
    LOG_FORMATS,
    LOG_LEVEL_LABELS,
    LOG_LEVELS,
    validateServerLoggingConfig,
    type LogTailResult,
    type ServerLoggingConfig,
    type ServerLoggingFieldErrors,
  } from '$lib/logging';
  import type { ClientLogConfig } from '$lib/client/config/logger-config';
  import { Button, Field, Toggle } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast';
  import { Icon } from '$lib/components';

  interface LoggingPageData {
    success: boolean;
    serverConfig: ServerLoggingConfig | null;
    error?: string;
  }

  interface Props {
    data: LoggingPageData;
  }

  const { data }: Props = $props();

  let serverConfig = $state<ServerLoggingConfig>(
    untrack(() => ({
      ...(data.success && data.serverConfig ? data.serverConfig : DEFAULT_SERVER_LOGGING_UI_CONFIG),
    })),
  );

  let serverErrors = $state<ServerLoggingFieldErrors>({});
  let savingServer = $state(false);

  const storedConfigWarning: string | null = (() => {
    if (!data.success || !data.serverConfig) {
      return null;
    }
    const result = validateServerLoggingConfig({ ...data.serverConfig });
    if (result.valid) {
      return null;
    }
    const fields = Object.values(result.fieldErrors);
    return fields.length > 0
      ? fields.join(' ')
      : 'The stored logging configuration does not match the current rules.';
  })();

  let clientConfig = $state({
    enabled: false,
    level: 'info',
    sendToServer: false,
    bufferSize: 100,
    batchInterval: 10000,
    includeUserAgent: false,
    includeUrl: true,
  } as ClientLogConfig);

  let clientSaved = $state(false);
  let clientSavedTimer: ReturnType<typeof setTimeout> | undefined;

  let isDockerEnvironment = $state(false);
  let pathPreviewTimer: ReturnType<typeof setTimeout> | undefined;
  let pathPreview = $state<{
    path: string;
    wasTransformed: boolean;
    warnings: string[];
    errors: string[];
  } | null>(null);

  let tail = $state<LogTailResult | null>(null);
  let tailLoading = $state(false);
  let tailError = $state<string | null>(null);

  const tailReasonMessages: Record<NonNullable<LogTailResult['reason']>, string> = {
    'file-logging-disabled': 'File output is off. Turn it on and save to start writing log files.',
    'invalid-directory': 'The saved log directory is not valid. Correct it above and save.',
    'directory-missing':
      'The log directory does not exist yet. It is created when the first line is written.',
    unreadable: 'The log directory could not be read. Check its permissions on the server.',
    'no-log-files': 'No gdluxx log files have been written to the log directory yet.',
  };

  const tailMessage = $derived(
    tail && !tail.available && tail.reason ? tailReasonMessages[tail.reason] : null,
  );

  onMount(() => {
    if (!data.success) {
      toastStore.error(
        'Configuration Load Failed',
        data.error ?? 'Failed to load logging configurations',
      );
    }

    clientConfig = clientLogger.getConfig();

    void detectDockerEnvironment().then(() => {
      if (serverConfig.fileEnabled) {
        schedulePathPreview(serverConfig.fileDirectory, 0);
      }
    });
    void loadTail();

    return () => {
      clearTimeout(clientSavedTimer);
      clearTimeout(pathPreviewTimer);
    };
  });

  function buildServerPayload(): ServerLoggingConfig {
    return {
      enabled: serverConfig.enabled,
      level: serverConfig.level,
      format: serverConfig.format,
      consoleEnabled: serverConfig.consoleEnabled,
      fileEnabled: serverConfig.fileEnabled,
      fileDirectory: serverConfig.fileDirectory,
      fileMaxSize: serverConfig.fileMaxSize,
      fileMaxFiles: serverConfig.fileMaxFiles,
      performanceLogging: serverConfig.performanceLogging,
      slowQueryThreshold: serverConfig.slowQueryThreshold,
    };
  }

  async function saveServerConfig() {
    const payload = buildServerPayload();
    const validation = validateServerLoggingConfig(payload);

    if (!validation.valid) {
      serverErrors = validation.fieldErrors;
      toastStore.error('Validation Failed', 'Fix the highlighted fields and try again.');
      return;
    }

    serverErrors = {};

    try {
      savingServer = true;

      const response = await fetch('/api/settings/server-logging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const result: { success: boolean; data?: ServerLoggingConfig; error?: string } =
        await response.json();

      if (response.ok && result.success && result.data) {
        serverConfig = { ...result.data };
        schedulePathPreview(serverConfig.fileDirectory, 0);
        toastStore.success('Server Logging', 'Configuration saved.');
        clientLogger.info('Server logging configuration updated');
        await loadTail();
      } else {
        toastStore.error(
          'Save Failed',
          result.error ?? 'Failed to update server logging configuration',
        );
      }
    } catch (error) {
      toastStore.error('Save Failed', 'Failed to update server logging configuration');
      clientLogger.error('Failed to update server logging configuration:', error);
    } finally {
      savingServer = false;
    }
  }

  function saveClientConfig() {
    try {
      clientLogger.updateConfig(clientConfig);
      clientSaved = true;
      clearTimeout(clientSavedTimer);
      clientSavedTimer = setTimeout(() => {
        clientSaved = false;
      }, 2500);
      clientLogger.info('Browser logging configuration updated');
    } catch (error) {
      toastStore.error('Save Failed', 'Failed to update browser logging configuration');
      clientLogger.error('Failed to update browser logging configuration:', error);
    }
  }

  async function loadTail() {
    try {
      tailLoading = true;
      tailError = null;

      const response = await fetch('/api/logging/tail');
      const result: { success: boolean; data?: LogTailResult; error?: string } =
        await response.json();

      if (response.ok && result.success && result.data) {
        tail = result.data;
      } else {
        tail = null;
        tailError = result.error ?? 'Failed to read the log file';
      }
    } catch (error) {
      tail = null;
      tailError = 'Failed to read the log file';
      clientLogger.warn('Failed to load log tail:', error);
    } finally {
      tailLoading = false;
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

  function schedulePathPreview(path: string, delay = 400) {
    clearTimeout(pathPreviewTimer);

    if (!isDockerEnvironment || !path?.trim()) {
      pathPreview = null;
      return;
    }

    pathPreviewTimer = setTimeout(() => {
      void updatePathPreview(path);
    }, delay);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<svelte:head>
  <title>Logging - gdluxx</title>
</svelte:head>

<div class="container mx-auto max-w-4xl space-y-8 p-6">
  <!-- Server logging config -->
  <section class="content-panel">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="mb-1">Server logging</h2>
        <p class="text-sm text-muted-foreground">
          Stored on the server. Applies to the gdluxx service and every user.
        </p>
      </div>
      <Button
        onclick={saveServerConfig}
        disabled={savingServer}
        loading={savingServer}
        variant="outline-primary"
        size="sm"
      >
        Save
      </Button>
    </div>

    {#if storedConfigWarning}
      <div
        class="mb-4 rounded-surface border border-warning bg-warning/10 p-3 text-sm text-foreground"
        role="status"
      >
        <span class="font-medium">Saved settings need attention:</span>
        {storedConfigWarning} They will be corrected the next time you save.
      </div>
    {/if}

    <div class="space-y-6">
      <div class="space-y-4">
        <h3>General</h3>

        <Toggle
          bind:checked={serverConfig.enabled}
          label="Enable server logging"
          description="Master switch. When off, nothing is written to the console or to log files."
          variant="primary"
          size="sm"
        />

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Log level"
            description="Minimum severity that gets recorded. Debug is the most verbose."
            error={serverErrors.level}
          >
            {#snippet control({ id, describedBy, invalid })}
              <select
                {id}
                bind:value={serverConfig.level}
                class="form-select"
                class:form-input-error={invalid}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {#each LOG_LEVELS as level (level)}
                  <option value={level}>{LOG_LEVEL_LABELS[level]}</option>
                {/each}
              </select>
            {/snippet}
          </Field>

          <Field
            label="Format"
            description="Console output format. File output is always JSON."
            error={serverErrors.format}
          >
            {#snippet control({ id, describedBy, invalid })}
              <select
                {id}
                bind:value={serverConfig.format}
                class="form-select"
                class:form-input-error={invalid}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {#each LOG_FORMATS as format (format)}
                  <option value={format}>{LOG_FORMAT_LABELS[format]}</option>
                {/each}
              </select>
            {/snippet}
          </Field>
        </div>

        <Toggle
          bind:checked={serverConfig.consoleEnabled}
          label="Console output"
          description="Write server logs to the container/process console."
          variant="primary"
          size="sm"
        />
      </div>

      <div class="space-y-4">
        <h3>File output</h3>

        <Toggle
          bind:checked={serverConfig.fileEnabled}
          label="Write logs to files"
          description="Required for the log viewer below. Files rotate daily."
          variant="primary"
          size="sm"
          onchange={(checked) => {
            if (checked) {
              schedulePathPreview(serverConfig.fileDirectory, 0);
            } else {
              schedulePathPreview('', 0);
            }
          }}
        />

        {#if serverConfig.fileEnabled}
          <Field
            label="Log directory"
            description="Directory on the server where log files are written."
            error={serverErrors.fileDirectory}
          >
            {#snippet control({ id, describedBy, invalid })}
              <input
                {id}
                type="text"
                bind:value={serverConfig.fileDirectory}
                oninput={(event) => schedulePathPreview(event.currentTarget.value)}
                placeholder="./logs"
                class="form-input"
                class:form-input-error={invalid}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            {/snippet}
          </Field>

          {#if isDockerEnvironment}
            <div class="rounded-surface border-strong bg-surface-elevated p-3 text-sm">
              <div class="mb-1 flex items-center gap-2">
                <Icon
                  iconName="settings"
                  size={16}
                  class="text-foreground"
                />
                <span class="font-medium text-foreground">Docker environment detected</span>
              </div>

              {#if pathPreview}
                <div class="ml-6">
                  <div class="text-foreground">
                    Effective path on the server:
                    <code
                      class="rounded-surface bg-primary/10 px-1 py-0.5 font-mono text-xs break-all"
                    >
                      {pathPreview.path}
                    </code>
                  </div>

                  {#if pathPreview.wasTransformed}
                    <p class="mt-1 text-xs text-muted-foreground">
                      The saved value is rewritten for the container, and it is the rewritten path
                      that is stored.
                    </p>
                  {/if}

                  {#each pathPreview.warnings as warning, index (index)}
                    <div class="mt-1 flex items-start gap-1 text-warning">
                      <Icon
                        iconName="question"
                        size={14}
                        class="mt-0.5 flex-shrink-0"
                      />
                      <span class="text-xs">{warning}</span>
                    </div>
                  {/each}

                  {#each pathPreview.errors as error, index (index)}
                    <div class="mt-1 flex items-start gap-1 text-error">
                      <Icon
                        iconName="close"
                        size={14}
                        class="mt-0.5 flex-shrink-0"
                      />
                      <span class="text-xs">{error}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="ml-6 text-xs text-muted-foreground">
                  Paths are rewritten for the container. Enter a directory to see the effective
                  path.
                </p>
              {/if}
            </div>
          {/if}

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Max file size"
              description="Number with unit: k, m, or g — e.g. 10m"
              error={serverErrors.fileMaxSize}
            >
              {#snippet control({ id, describedBy, invalid })}
                <input
                  {id}
                  type="text"
                  bind:value={serverConfig.fileMaxSize}
                  placeholder="10m"
                  class="form-input"
                  class:form-input-error={invalid}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              {/snippet}
            </Field>

            <Field
              label="Retention"
              description="Days with a 'd' suffix (7d) or a file count (14)"
              error={serverErrors.fileMaxFiles}
            >
              {#snippet control({ id, describedBy, invalid })}
                <input
                  {id}
                  type="text"
                  bind:value={serverConfig.fileMaxFiles}
                  placeholder="7d"
                  class="form-input"
                  class:form-input-error={invalid}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              {/snippet}
            </Field>
          </div>
        {/if}
      </div>

      <div class="space-y-4">
        <h3>Performance</h3>

        <Toggle
          bind:checked={serverConfig.performanceLogging}
          label="Performance logging"
          description="Records operation timings, including database query duration."
          variant="primary"
          size="sm"
        />

        {#if serverConfig.performanceLogging}
          <Field
            label="Slow query threshold (ms)"
            description="Operations slower than this are logged as slow. 0 logs everything."
            error={serverErrors.slowQueryThreshold}
            class="md:max-w-xs"
          >
            {#snippet control({ id, describedBy, invalid })}
              <input
                {id}
                type="number"
                bind:value={serverConfig.slowQueryThreshold}
                min="0"
                max="600000"
                step="1"
                class="form-input"
                class:form-input-error={invalid}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            {/snippet}
          </Field>
        {/if}
      </div>
    </div>
  </section>

  <!-- Log viewer -->
  <section class="content-panel">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="mb-1">Recent log output</h2>
        <p class="text-sm text-muted-foreground">
          The last 200 lines of the newest server log file. Read-only, and only refreshed when you
          ask for it.
        </p>
      </div>
      <Button
        onclick={loadTail}
        disabled={tailLoading}
        loading={tailLoading}
        variant="outline-primary"
        size="sm"
      >
        Refresh
      </Button>
    </div>

    {#if tailError}
      <p
        class="rounded-surface border border-error bg-error/10 p-3 text-sm text-foreground"
        role="alert"
      >
        {tailError}
      </p>
    {:else if tail && !tail.available}
      <p
        class="rounded-surface bg-surface-elevated p-3 text-sm text-muted-foreground border-strong"
      >
        {tailMessage}
      </p>
    {:else if tail}
      {#if !tail.loggingEnabled}
        <p
          class="mb-3 rounded-surface border border-warning bg-warning/10 p-3 text-sm text-foreground"
          role="status"
        >
          Server logging is disabled; showing the last output that was written.
        </p>
      {/if}

      <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>File: <span class="font-mono">{tail.file}</span></span>
        {#if tail.modifiedAt}
          <span>Modified: {new Date(tail.modifiedAt).toLocaleString()}</span>
        {/if}
        <span>Size: {formatBytes(tail.sizeBytes)}</span>
        <span>{tail.lineCount} lines</span>
        {#if tail.truncated}
          <span class="text-warning">Truncated — older output is not shown</span>
        {/if}
      </div>

      {#if tail.lines.length === 0}
        <p
          class="rounded-surface bg-surface-elevated p-3 text-sm text-muted-foreground border-strong"
        >
          The log file is empty.
        </p>
      {:else}
        <pre
          class="max-h-96 overflow-x-auto overflow-y-auto rounded-surface bg-surface-sunken p-3 font-mono text-xs text-foreground border-strong"><code
            >{tail.lines.join('\n')}</code
          ></pre>
      {/if}
    {:else if !tailLoading}
      <p
        class="rounded-surface bg-surface-elevated p-3 text-sm text-muted-foreground border-strong"
      >
        No log output loaded.
      </p>
    {/if}
  </section>

  <!-- Browser log config -->
  <section class="content-panel">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="mb-1">Browser logging</h2>
        <p class="text-sm text-muted-foreground">
          Stored in this browser only. Applies to you, on this device.
        </p>
      </div>
      <div class="flex items-center gap-2">
        {#if clientSaved}
          <span
            class="text-sm text-success"
            role="status">Saved</span
          >
        {/if}
        <Button
          onclick={saveClientConfig}
          variant="outline-primary"
          size="sm"
        >
          Save
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="space-y-4">
        <Toggle
          bind:checked={clientConfig.enabled}
          label="Enable browser logging"
          description="Collects log output from the gdluxx web UI running in this browser."
          variant="primary"
          size="sm"
        />

        <Field
          label="Log level"
          description="Minimum severity recorded in this browser."
        >
          {#snippet control({ id, describedBy, invalid })}
            <select
              {id}
              bind:value={clientConfig.level}
              class="form-select"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            >
              {#each LOG_LEVELS as level (level)}
                <option value={level}>{LOG_LEVEL_LABELS[level]}</option>
              {/each}
            </select>
          {/snippet}
        </Field>

        <Toggle
          bind:checked={clientConfig.sendToServer}
          label="Send logs to the server"
          description="Batches browser logs and posts them to the server so everything lands in one place."
          variant="primary"
          size="sm"
        />

        <Toggle
          bind:checked={clientConfig.includeUrl}
          label="Include page URL"
          description="Adds the current page URL to each entry."
          variant="primary"
          size="sm"
        />
      </div>

      <div class="space-y-4">
        {#if clientConfig.sendToServer}
          <Field
            label="Buffer size"
            description="Entries kept in memory before a batch is sent (1-1000)."
          >
            {#snippet control({ id, describedBy, invalid })}
              <input
                {id}
                type="number"
                bind:value={clientConfig.bufferSize}
                min="1"
                max="1000"
                class="form-input"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            {/snippet}
          </Field>

          <Field
            label="Batch interval (ms)"
            description="How often buffered entries are sent (1000-60000)."
          >
            {#snippet control({ id, describedBy, invalid })}
              <input
                {id}
                type="number"
                bind:value={clientConfig.batchInterval}
                min="1000"
                max="60000"
                class="form-input"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            {/snippet}
          </Field>

          <Toggle
            bind:checked={clientConfig.includeUserAgent}
            label="Include user agent"
            description="Adds browser and platform information to each entry."
            variant="primary"
            size="sm"
          />
        {/if}
      </div>
    </div>
  </section>
</div>
