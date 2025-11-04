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
  import { hasJsonLintErrors } from '$lib/stores/lint';
  import { clientLogger as logger } from '$lib/client/logger';
  import { Button, Chip, Info } from '$lib/components/ui';
  import optionsData from '$lib/assets/options.json';
  import type { Option, OptionsData } from '$lib/types/options';
  import type { OptionWithSource, SiteConfigData } from '$lib/types/command-form';
  import { browser } from '$app/environment';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import OptionsManager from './OptionsManager.svelte';

  const typedOptionsData = optionsData as OptionsData;

  interface FormResult {
    overallSuccess: boolean;
    results?: Array<{
      url: string;
      success: boolean;
      jobId?: string;
      error?: string;
      message?: string;
    }>;
    error?: string;
  }

  interface Conflict {
    optionId: string;
    userValue: string | number | boolean;
    siteRuleValue: string | number | boolean;
    sitePattern: string;
    configName?: string;
  }

  let commandUrlsInput = $state('');
  let isLoading = $state(false);
  let formError = $state<string | null>(null);
  let selectedOptions = $state(new Map<string, OptionWithSource>());
  let siteConfigData = $state<SiteConfigData[]>([]);
  let conflictWarnings = $state(new Map<string, string>());
  let userWarningSetting = $state(false);
  let showConflictWarning = $state(false);
  let detectedConflicts = $state<Conflict[]>([]);

  const allOptions: Option[] = Object.values(typedOptionsData).flatMap(
    (category) => category.options as Option[],
  );

  onMount(async () => {
    await checkConfigFileForErrors();

    if (browser) {
      const savedUrls = localStorage.getItem('commandForm_urls');
      if (savedUrls) {
        commandUrlsInput = savedUrls;
      }
    }

    // Fetch user warning setting
    try {
      const response = await fetch('/api/settings/user');
      if (response.ok) {
        const { data } = await response.json();
        userWarningSetting = data.warnOnSiteRuleOverride;
      }
    } catch (error) {
      logger.error('Failed to fetch user settings:', error);
      // Set false if fetch fails
      userWarningSetting = false;
    }
  });

  $effect(() => {
    if (browser && commandUrlsInput.trim()) {
      localStorage.setItem('commandForm_urls', commandUrlsInput);
    }
  });

  function getOptionById(optionId: string): Option | undefined {
    return allOptions.find((opt) => opt.id === optionId);
  }

  async function checkConfigFileForErrors() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();

      if (data.success) {
        try {
          const content = data.data?.content ?? data.content;
          JSON.parse(content);
          hasJsonLintErrors.set(false);
        } catch (parseError) {
          logger.error('Config file parsing error:', parseError);
          hasJsonLintErrors.set(true);
        }
      } else {
        logger.error('Failed to read config:', data.error);
      }
    } catch (fetchError) {
      logger.error('Failed to fetch config:', fetchError);
    }
  }

  function extractUrlsFromInput(input: string): string[] {
    return input
      .split(/[\s\n]+/)
      .map((url) => url.trim())
      .filter((url) => url !== '');
  }

  function mergeSiteConfigsWithUserOptions(siteConfigs: SiteConfigData[]) {
    const userOptions = new Map(selectedOptions);

    selectedOptions.clear();
    conflictWarnings.clear();

    // First add site config options
    for (const config of siteConfigs) {
      const optionsEntries = Object.entries(config.options);

      for (const [optionId, value] of optionsEntries) {
        selectedOptions.set(optionId, {
          value,
          source: 'site-config',
          sitePattern: config.matchedPattern,
          configName: config.configName,
        });
      }
    }

    // Then add user options (overriding site configs)
    for (const [optionId, optionData] of userOptions) {
      if (selectedOptions.has(optionId)) {
        const siteConfigOption = selectedOptions.get(optionId);
        if (siteConfigOption?.sitePattern) {
          conflictWarnings.set(
            optionId,
            `Your selection overrides site config for ${siteConfigOption.sitePattern}`,
          );
        }
      }

      selectedOptions.set(optionId, {
        value: typeof optionData === 'object' ? optionData.value : optionData,
        source: 'user',
      });
    }

    selectedOptions = new Map(selectedOptions);
    conflictWarnings = new Map(conflictWarnings);
  }

  function handleFormResult(result: FormResult) {
    formError = null;

    const urlsToProcess = commandUrlsInput
      .split(/[\s\n]+/)
      .map((url) => url.trim())
      .filter((url) => url !== '');

    let localStartedCount = 0;
    const localErrorMessages: string[] = [];

    if (result.results && result.results.length > 0) {
      result.results.forEach((jobResult) => {
        if (jobResult.success && jobResult.jobId) {
          localStartedCount++;
        } else {
          localErrorMessages.push(
            `Error for "${jobResult.url}": ${jobResult.error ?? jobResult.message ?? 'Unknown error'}`,
          );
        }
      });
    } else if (!result.overallSuccess) {
      formError =
        result.results?.[0]?.error ??
        result.error ??
        'Failed to process job request. Check server logs.';
    }

    if (localErrorMessages.length > 0) {
      formError = `Processed ${urlsToProcess.length} URL(s).\n`;
      if (localStartedCount > 0) {
        formError += `${localStartedCount} job(s) started.\n`;
      }
      formError += `${localErrorMessages.length} failed:\n- ${localErrorMessages.join('\n- ')}`;
    }

    if (localStartedCount > 0) {
      // Toast notification to be handled by the jobStore
      if (localErrorMessages.length === 0) {
        commandUrlsInput = '';
      }
    }

    if (localStartedCount === 0 && localErrorMessages.length === 0 && urlsToProcess.length > 0) {
      if (!result.overallSuccess) {
        formError ??= 'Job submission failed. Please check server logs or try again.';
      } else {
        formError ??= 'No valid URLs found to process, or all URLs were invalid before submission.';
      }
    }
  }

  function clearUrlsInput() {
    commandUrlsInput = '';
    formError = null;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    const urls = extractUrlsFromInput(commandUrlsInput);

    if (urls.length === 0) {
      formError = 'Please enter at least one URL.';
      return;
    }

    isLoading = true;
    formError = null;

    try {
      // Load site configs for URLs
      const siteConfigResponse = await fetch('/api/site-configs/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      let siteConfigs: SiteConfigData[] = [];
      if (siteConfigResponse.ok) {
        const { data } = await siteConfigResponse.json();
        siteConfigs = data ?? [];
      }

      // Conflict detection is now being handled by OptionsManager
      // Store siteConfigData for OptionsManager to make use of
      siteConfigData = siteConfigs;

      // Proceed with submission if no conflicts or if warning disabled
      await proceedWithJobSubmission(siteConfigs);
    } catch (error) {
      logger.error('Failed to start jobs:', error);
      formError = error instanceof Error ? error.message : 'An unexpected error occurred';
    } finally {
      isLoading = false;
    }
  }

  async function proceedWithJobSubmission(siteConfigs: SiteConfigData[]) {
    isLoading = true;
    showConflictWarning = false;
    detectedConflicts = [];

    try {
      // Merging site rules with user options
      if (siteConfigs && siteConfigs.length > 0) {
        siteConfigData = siteConfigs;
        mergeSiteConfigsWithUserOptions(siteConfigs);
      }

      // Submitting job
      const result = await jobStore.startJob(
        extractUrlsFromInput(commandUrlsInput),
        selectedOptions,
      );
      handleFormResult(result);
    } catch (error) {
      logger.error('Failed to start jobs:', error);
      formError = error instanceof Error ? error.message : 'An unexpected error occurred';
    } finally {
      isLoading = false;
    }
  }

  function handleCancelWarning() {
    showConflictWarning = false;
    detectedConflicts = [];
    isLoading = false;
  }

  async function handleProceedAnyway() {
    await proceedWithJobSubmission(siteConfigData);
  }
</script>

<div class="content-panel">
  <form
    class="space-y-6"
    onsubmit={handleSubmit}
  >
    <div class="m-4">
      <label
        for="commandUrlsInput"
        class="mb-2 block px-2 text-sm font-medium text-primary"
      >
        URL(s) <span class="text-xs text-muted-foreground">
          (one per line or space-separated)
        </span>
      </label>
      <div class="relative">
        <textarea
          id="commandUrlsInput"
          name="urls"
          bind:value={commandUrlsInput}
          placeholder="https://example.com/gallery1&#10;https://example.com/image.jpg https://othersite.com/album"
          autocomplete="off"
          rows="7"
          class="form-textarea"
        ></textarea>
      </div>
    </div>

    <!-- Site Rule Panel -->
    {#if siteConfigData.length > 0}
      <Info
        variant="info"
        title="Site Rules Detected"
        class="mx-4 p-4"
      >
        {#each siteConfigData as config (config.url)}
          <div
            class="config-item flex items-center justify-between rounded bg-surface-elevated px-3 py-2 border-strong"
          >
            <div class="flex flex-col">
              <span class="text-sm font-medium text-primary">
                Rule: {config.configName}
              </span>
              <span class="text-xs text-muted-foreground">
                Pattern: {config.matchedPattern}
              </span>
            </div>
            <Chip
              label={`${Object.keys(config.options).length} options`}
              variant="info"
              size="sm"
              dismissible={false}
            >
              {Object.keys(config.options).length} options
            </Chip>
          </div>
        {/each}
      </Info>
    {/if}

    <!-- Hidden inputs for form data -->
    <input
      type="hidden"
      name="args"
      value={JSON.stringify(
        Array.from(selectedOptions.entries()).map(([key, optionData]) => [key, optionData.value]),
      )}
    />

    <!-- Conflict warning Info -->
    {#if showConflictWarning}
      <Info
        variant="warning"
        title="Site Rule Override"
        class="mx-4"
      >
        <div class="space-y-3">
          <p class="text-sm">Your selections will override the following automated site rules:</p>

          <ul class="list-disc space-y-1 pl-5 text-sm">
            {#each detectedConflicts as conflict (conflict.optionId)}
              {@const option = getOptionById(conflict.optionId)}
              {#if option}
                <li>
                  For <strong>{conflict.sitePattern}</strong>
                  {#if conflict.configName}
                    ({conflict.configName})
                  {/if}:
                  <br />
                  Your
                  <code class="rounded bg-surface-elevated px-1 text-xs"
                    >{option.command} = {conflict.userValue}</code
                  >
                  will override
                  <code class="rounded bg-surface-elevated px-1 text-xs"
                    >{option.command} = {conflict.siteRuleValue}</code
                  >
                </li>
              {/if}
            {/each}
          </ul>

          <div class="flex gap-3 pt-2">
            <Button
              onclick={handleProceedAnyway}
              variant="primary"
              size="sm"
            >
              Proceed Anyway
            </Button>
            <Button
              onclick={handleCancelWarning}
              variant="outline-primary"
              size="sm">Cancel</Button
            >
          </div>
        </div>
      </Info>
    {/if}

    <!-- Form Buttons with Error Handling -->
    <div class="m-4 flex justify-end gap-6">
      <Button
        onclick={clearUrlsInput}
        disabled={isLoading || !commandUrlsInput}
        class="mt-2 w-full"
        variant="outline-primary"
      >
        Clear
      </Button>

      <Button
        type="submit"
        disabled={isLoading || $hasJsonLintErrors || !commandUrlsInput}
        class="mt-2 w-full"
        variant="primary"
      >
        Run
      </Button>
    </div>

    {#if formError}
      <Info
        variant="warning"
        dismissible>{formError}</Info
      >
    {/if}

    {#if $hasJsonLintErrors}
      <Info
        variant="warning"
        title="Stop!"
        class="m-8"
      >
        There is at least one error in your <a
          href="/config"
          class="underline">config file</a
        >
        that you must fix before proceeding!
      </Info>
    {/if}
  </form>

  <!-- OptionsManager -->
  <!--
  <OptionsManager
    bind:selectedOptions
    bind:conflicts={detectedConflicts}
    bind:conflictWarnings
    {siteConfigData}
    {userWarningSetting}
    {commandUrlsInput}
    onConflictDetected={(conflicts) => {
      if (conflicts.length > 0) {
        showConflictWarning = true;
      }
    }}
    onSiteRuleSaved={() => {
      // Handle site rule saved
    }}
  />
  -->
</div>
