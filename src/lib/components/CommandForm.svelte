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
  import { hasJsonLintErrors } from '$lib/stores/lint';
  import { clientLogger as logger } from '$lib/client/logger';
  import { Button, Chip, Info } from '$lib/components/ui';
  import type { Conflict, OptionWithSource, SiteConfigData } from '$lib/types/command-form';
  import {
    buildCommandPreview,
    detectConflicts,
    getActiveMutuallyExclusive,
    getEmptyValueOptions,
    optionsById,
  } from '$lib/utils/commandOptions';
  import { browser } from '$app/environment';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { parseUrls } from '$lib/utils/parseUrls';
  import OptionsManager from './OptionsManager.svelte';

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

  let commandUrlsInput = $state('');
  let isLoading = $state(false);
  let formError = $state<string | null>(null);
  let selectedOptions = $state(new Map<string, OptionWithSource>());
  let siteConfigData = $state<SiteConfigData[]>([]);
  let conflictWarnings = $state(new Map<string, string>());
  let userWarningSetting = $state(false);
  let showConflictWarning = $state(false);
  let detectedConflicts = $state<Conflict[]>([]);

  // Site-rule options the user has explicitly dismissed; excluded from the merge
  // and sent to the server so they aren't reapplied per URL
  // Always reassigned, never mutated in place, so the merge effect re-fires
  let dismissedSiteRuleOptions = $state(new Set<string>());

  // Live, non-blocking site-rule hint shown while typing (before submit)
  let siteRuleHints = $state<SiteConfigData[]>([]);
  let hintRequestId = 0;

  const emptyValueOptions = $derived(getEmptyValueOptions(selectedOptions));
  const emptyValueOptionIds = $derived(new Set(emptyValueOptions.map((o) => o.id)));
  const mutuallyExclusiveActive = $derived(getActiveMutuallyExclusive(selectedOptions));
  const runDisabled = $derived(
    isLoading || $hasJsonLintErrors || !commandUrlsInput || emptyValueOptions.length > 0,
  );
  const commandPreview = $derived(
    buildCommandPreview(selectedOptions, parseUrls(commandUrlsInput), { maskSensitive: true }),
  );

  const siteRuleHintSummary = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const config of siteRuleHints) {
      const name = config.configName ?? config.matchedPattern ?? 'site rule';
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return Object.entries(counts).map(([configName, count]) => ({ configName, count }));
  });

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

  // Debounced site rule lookup to surface a quiet hint while the user types
  $effect(() => {
    const input = commandUrlsInput;

    if (!browser) {
      return;
    }

    const urls = parseUrls(input);
    if (urls.length === 0) {
      siteRuleHints = [];
      return;
    }

    const timer = setTimeout(() => {
      const requestId = ++hintRequestId;
      void lookupSiteConfigs(urls)
        .then((configs) => {
          // Ignore stale/out-of-order responses
          if (requestId === hintRequestId) {
            siteRuleHints = configs;
          }
        })
        .catch(() => {
          if (requestId === hintRequestId) {
            siteRuleHints = [];
          }
        });
    }, 450);

    return () => clearTimeout(timer);
  });

  async function lookupSiteConfigs(urls: string[]): Promise<SiteConfigData[]> {
    const response = await fetch('/api/site-configs/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      return [];
    }

    const { data } = await response.json();
    return data ?? [];
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

  function mergeSiteConfigsWithUserOptions(siteConfigs: SiteConfigData[]) {
    const userOptions = new Map(selectedOptions);

    selectedOptions.clear();
    conflictWarnings.clear();

    // First add site config options
    for (const config of siteConfigs) {
      const optionsEntries = Object.entries(config.options);

      for (const [optionId, value] of optionsEntries) {
        if (dismissedSiteRuleOptions.has(optionId)) {
          continue;
        }
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
      if (typeof optionData === 'object' && optionData.source !== 'user') {
        continue;
      }

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

  $effect(() => {
    const hints = siteRuleHints;
    // Register the dismissal set as a dependency
    void dismissedSiteRuleOptions;

    untrack(() => {
      mergeSiteConfigsWithUserOptions(hints);
    });
  });

  function handleFormResult(result: FormResult) {
    formError = null;

    const urlsToProcess = parseUrls(commandUrlsInput);

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

    const urls = parseUrls(commandUrlsInput);

    if (urls.length === 0) {
      formError = 'Please enter at least one URL.';
      return;
    }

    isLoading = true;
    formError = null;

    try {
      // Load site configs for URLs, shared with the typing hint lookup
      const siteConfigs = await lookupSiteConfigs(urls);

      // Store siteConfigData for OptionsManager and the Site Rules panel
      siteConfigData = siteConfigs;

      // Gate submission on user/site rule conflicts when the warning is enabled
      if (userWarningSetting && siteConfigs.length > 0) {
        const conflicts = detectConflicts(selectedOptions, siteConfigs);
        if (conflicts.length > 0) {
          detectedConflicts = conflicts;
          showConflictWarning = true;
          return;
        }
      }

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
        parseUrls(commandUrlsInput),
        selectedOptions,
        Array.from(dismissedSiteRuleOptions),
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
    id="command-form"
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
          class="form-textarea"></textarea>
      </div>
    </div>

    <!-- Live site rule hint (while typing, before submit time lookup) -->
    {#if siteConfigData.length === 0 && siteRuleHintSummary.length > 0}
      <div class="mx-4 -mt-2 space-y-0.5 px-2 text-xs text-muted-foreground">
        {#each siteRuleHintSummary as hint (hint.configName)}
          <p>
            {hint.count} URL{hint.count === 1 ? '' : 's'} will use the "{hint.configName}" rule
          </p>
        {/each}
      </div>
    {/if}

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
            >
              {Object.keys(config.options).length} options
            </Chip>
          </div>
        {/each}
      </Info>
    {/if}

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
              {@const option = optionsById.get(conflict.optionId)}
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

    <!-- Command preview -->
    {#if parseUrls(commandUrlsInput).length > 0}
      <div class="mx-4">
        <span class="mb-1 block px-2 text-xs font-medium text-muted-foreground"
          >Command preview</span
        >
        <pre
          class="overflow-x-auto rounded-sm bg-surface-sunken px-3 py-2 text-xs text-foreground border-strong"><code
            >{commandPreview.text}</code
          ></pre>
        {#if siteRuleHints.length > 0 || siteConfigData.length > 0}
          <p class="mt-1 px-2 text-xs text-muted-foreground">
            Site rules matched — their options will also be applied per URL; your selections take
            precedence.
          </p>
        {/if}
      </div>
    {/if}

    <!-- Selection warnings -->
    {#if emptyValueOptions.length > 0}
      <Info
        variant="warning"
        title="Missing option values"
        class="mx-4"
      >
        Provide a value or deselect: {emptyValueOptions.map((o) => o.command).join(', ')}
      </Info>
    {/if}

    {#if mutuallyExclusiveActive.length >= 2}
      <Info
        variant="info"
        title="Mutually exclusive flags"
        class="mx-4"
      >
        {mutuallyExclusiveActive.map((o) => o.command).join(', ')}, generally conflict — gallery-dl
        will honor only one behavior.
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
        disabled={runDisabled}
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
  <OptionsManager
    bind:selectedOptions
    bind:conflicts={detectedConflicts}
    bind:conflictWarnings
    bind:dismissedSiteRuleOptions
    siteConfigData={siteConfigData.length > 0 ? siteConfigData : siteRuleHints}
    {userWarningSetting}
    {commandUrlsInput}
    {runDisabled}
    runFormId="command-form"
    isRunning={isLoading}
    {emptyValueOptionIds}
    onConflictDetected={(conflicts) => {
      // Only surface the blocking override panel during an in-flight submit
      // otherwise typing would pop it open
      if (conflicts.length > 0 && isLoading) {
        showConflictWarning = true;
      }
    }}
    onSiteRuleSaved={() => {
      // Handle site rule saved
    }}
  />
</div>
