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
  import { Button, Chip, Info, Toggle } from '$lib/components/ui';
  import optionsData from '$lib/assets/options.json';
  import type { Option, OptionsData } from '$lib/types/options';
  import type { OptionWithSource, SiteConfigData } from '$lib/types/command-form';
  import { browser } from '$app/environment';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { Icon } from '$lib/components/index';
  import SaveSiteRuleModal from './SaveSiteRuleModal.svelte';
  import { extractUniquePatterns } from '$lib/utils/patternDetection';
  import { toastStore } from '$lib/stores/toast';

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
  let selectedOptionsByCategory = $state<Map<string, Map<string, OptionWithSource>>>(new Map());
  let siteConfigData = $state<SiteConfigData[]>([]);
  let conflictWarnings = $state(new Map<string, string>());
  let categoryAccordionStates = $state(new Map<string, boolean>());
  let isAccordionOpen = $state(false);
  let showSaveRuleDialog = $state(false);
  let userWarningSetting = $state(false);
  let showConflictWarning = $state(false);
  let detectedConflicts = $state<Conflict[]>([]);

  const allOptions: Option[] = Object.values(typedOptionsData).flatMap(
    category => category.options as Option[]
  );

  const categoriesArray = Object.entries(typedOptionsData);

  onMount(async () => {
    await checkConfigFileForErrors();
    // Initialize category accordion states (all closed by default)
    for (const categoryKey of Object.keys(typedOptionsData)) {
      categoryAccordionStates.set(categoryKey, false);
    }
    categoryAccordionStates = new Map(categoryAccordionStates);

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

  function toggleOption(option: Option) {
    const { id, defaultValue } = option;
    if (selectedOptions.has(id)) {
      selectedOptions.delete(id);
    } else {
      selectedOptions.set(id, {
        value: defaultValue ?? true,
        source: 'user',
      });
    }
    selectedOptions = new Map(selectedOptions);
    updateCategoryTracking();
  }

  function removeOption(optionId: string) {
    selectedOptions.delete(optionId);
    conflictWarnings.delete(optionId);
    selectedOptions = new Map(selectedOptions);
    conflictWarnings = new Map(conflictWarnings);
    updateCategoryTracking();
  }

  function editOption(optionId: string, newValue: string | number | boolean) {
    if (selectedOptions.has(optionId)) {
      const currentOption = selectedOptions.get(optionId);
      if (currentOption) {
        selectedOptions.set(optionId, {
          ...currentOption,
          value: newValue,
        });
        selectedOptions = new Map(selectedOptions);
        updateCategoryTracking();
      }
    }
  }

  function getOptionById(optionId: string): Option | undefined {
    return allOptions.find(opt => opt.id === optionId);
  }

  function getCategoryKeyForOption(optionId: string): string | undefined {
    for (const [categoryKey, category] of Object.entries(typedOptionsData)) {
      if (category.options.some(opt => opt.id === optionId)) {
        return categoryKey;
      }
    }
    return undefined;
  }

  function getCategoryTitle(categoryKey: string): string {
    return typedOptionsData[categoryKey]?.title || categoryKey;
  }

  function getSelectedCountForCategory(categoryKey: string): number {
    const categoryMap = selectedOptionsByCategory.get(categoryKey);
    return categoryMap ? categoryMap.size : 0;
  }

  function detectConflicts(siteConfigs: SiteConfigData[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Only checking user selected options
    const userSelectedOptions = Array.from(selectedOptions.entries()).filter(
      ([, optionData]) => optionData.source === 'user'
    );

    for (const [optionId, userOptionData] of userSelectedOptions) {
      for (const config of siteConfigs) {
        if (optionId in config.options) {
          const siteRuleValue = config.options[optionId];
          if (userOptionData.value !== siteRuleValue) {
            conflicts.push({
              optionId,
              userValue: userOptionData.value,
              siteRuleValue,
              sitePattern: config.matchedPattern ?? '',
              configName: config.configName,
            });
          }
        }
      }
    }

    return conflicts;
  }

  function updateCategoryTracking() {
    selectedOptionsByCategory.clear();

    for (const [optionId, optionData] of selectedOptions.entries()) {
      const categoryKey = getCategoryKeyForOption(optionId);
      if (categoryKey) {
        if (!selectedOptionsByCategory.has(categoryKey)) {
          selectedOptionsByCategory.set(categoryKey, new Map());
        }
        const categoryMap = selectedOptionsByCategory.get(categoryKey);
        if (categoryMap) {
          categoryMap.set(optionId, optionData);
        }
      }
    }

    selectedOptionsByCategory = new Map(selectedOptionsByCategory);
  }

  async function checkConfigFileForErrors() {
    try {
      const response = await fetch('/config');
      const data = await response.json();

      if (data.success) {
        try {
          // Handle standardized API response format
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
      .map(url => url.trim())
      .filter(url => url !== '');
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
            `Your selection overrides site config for ${siteConfigOption.sitePattern}`
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
    updateCategoryTracking();
  }

  function handleFormResult(result: FormResult) {
    formError = null;

    const urlsToProcess = commandUrlsInput
      .split(/[\s\n]+/)
      .map(url => url.trim())
      .filter(url => url !== '');

    let localStartedCount = 0;
    const localErrorMessages: string[] = [];

    if (result.results && result.results.length > 0) {
      result.results.forEach(jobResult => {
        if (jobResult.success && jobResult.jobId) {
          localStartedCount++;
        } else {
          localErrorMessages.push(
            `Error for "${jobResult.url}": ${jobResult.error ?? jobResult.message ?? 'Unknown error'}`
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
      toastStore.success('Jobs Started', `${localStartedCount} job(s) accepted for processing`);
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

  function clearAllOptions() {
    selectedOptions = new Map();
    selectedOptionsByCategory = new Map();
  }

  function revertToSiteConfig(optionId: string) {
    const currentOption = selectedOptions.get(optionId);
    if (!currentOption) {
      return;
    }

    // Find the original site config value from siteConfigData
    for (const config of siteConfigData) {
      const optionsEntries = Object.entries(config.options);

      for (const [siteOptionId, value] of optionsEntries) {
        if (siteOptionId === optionId) {
          selectedOptions.set(optionId, {
            value,
            source: 'site-config',
            sitePattern: config.matchedPattern,
            configName: config.configName,
          });
          break;
        }
      }
    }

    // Remove the conflict warning
    conflictWarnings.delete(optionId);

    selectedOptions = new Map(selectedOptions);
    conflictWarnings = new Map(conflictWarnings);
    updateCategoryTracking();
  }

  function canSaveAsSiteRule(): boolean {
    if (!commandUrlsInput.trim()) {
      return false;
    }

    const userOptions = getUserSelectedOptions();
    return userOptions.size > 0;
  }

  function getUserSelectedOptions(): Map<string, OptionWithSource> {
    const userOptions = new Map<string, OptionWithSource>();
    for (const [key, optionData] of selectedOptions) {
      if (optionData.source === 'user') {
        userOptions.set(key, optionData);
      }
    }
    return userOptions;
  }

  function handleSiteRuleSaved() {
    showSaveRuleDialog = false;
    toastStore.success('Site Rule Saved', 'Site rule saved successfully!');
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
      // 1. Load site configs for URLs
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

      // 2. Check for conflicts if setting is enabled
      if (userWarningSetting && siteConfigs.length > 0) {
        const conflicts = detectConflicts(siteConfigs);
        if (conflicts.length > 0) {
          detectedConflicts = conflicts;
          siteConfigData = siteConfigs; // Store for later use
          showConflictWarning = true;
          isLoading = false;
          return; // Stop here and show the warning
        }
      }

      // 3. Proceed with submission if no conflicts or if warning disabled
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
      // Mergeing site rules with user options
      if (siteConfigs && siteConfigs.length > 0) {
        siteConfigData = siteConfigs;
        mergeSiteConfigsWithUserOptions(siteConfigs);
      }

      // Submitting job
      const result = await jobStore.startJob(
        extractUrlsFromInput(commandUrlsInput),
        selectedOptions
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

<div
  class="bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
>
  <form class="space-y-6" onsubmit={handleSubmit}>
    <div class="m-4">
      <label
        for="commandUrlsInput"
        class="mb-2 block px-2 text-sm font-medium text-primary-900 dark:text-primary-100"
      >
        URL(s) <span class="text-xs dark:text-secondary-600 text-secondary-500">
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
          rows="5"
          class="w-full rounded-sm border dark:border-secondary-300 dark:bg-secondary-900 px-4 py-3 text-base dark:text-primary-100
         dark:placeholder-secondary-500 transition-colors duration-200
         dark:focus:border-primary-500 focus:ring-3 dark:focus:ring-primary-500/20 focus:outline-hidden
         border-secondary-700 bg-secondary-100 text-primary-900
         placeholder-secondary-500 focus:border-primary-400 focus:ring-primary-400/20 pr-9"
        ></textarea>
      </div>
    </div>

    <!-- Site Rule Panel -->
    {#if siteConfigData.length > 0}
      <Info variant="info" title="Site Rules Detected" class="p-4 mx-4">
        {#each siteConfigData as config (config.url)}
          <div
            class="config-item flex items-center justify-between bg-primary-200 dark:bg-primary-800 bg-opacity-50 px-3 py-2 rounded border dark:border-primary-200 border-primary-600"
          >
            <div class="flex flex-col">
              <span class="font-medium text-primary-900 dark:text-primary-100 text-sm">
                Rule: {config.configName}
              </span>
              <span class="text-xs text-primary-600 dark:text-primary-300">
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

    <!-- Conflict warnings panel -->
    {#if conflictWarnings.size > 0}
      <Info variant="warning" title="Conflicts Detected" class="p-4 mx-4">
        {#each Array.from(conflictWarnings.entries()) as [optionId, warning] (optionId)}
          {@const option = getOptionById(optionId)}
          {#if option}
            <div
              class="config-item flex items-center justify-between bg-primary-200 dark:bg-primary-800 bg-opacity-50 px-3 py-2 rounded border dark:border-primary-200 border-primary-600"
            >
              <div class="flex flex-col">
                <span class="font-medium text-primary-900 dark:text-primary-100 text-sm">
                  {option.command}
                </span>
                <span class="text-xs text-primary-600 dark:text-primary-300">
                  {warning}
                </span>
              </div>
              <Button variant="warning" size="sm" onclick={() => revertToSiteConfig(optionId)}>
                Revert
              </Button>
            </div>
          {/if}
        {/each}
      </Info>
    {/if}

    <!-- Save rule mdal -->
    {#if showSaveRuleDialog}
      <SaveSiteRuleModal
        show={showSaveRuleDialog}
        options={getUserSelectedOptions()}
        detectedPatterns={extractUniquePatterns(extractUrlsFromInput(commandUrlsInput))}
        onSaved={handleSiteRuleSaved}
        onCancel={() => (showSaveRuleDialog = false)}
      />
    {/if}

    <!-- Hidden inputs for form data -->
    <input
      type="hidden"
      name="args"
      value={JSON.stringify(
        Array.from(selectedOptions.entries()).map(([key, optionData]) => [key, optionData.value])
      )}
    />

    <!-- Conflict warning Info -->
    {#if showConflictWarning}
      <Info variant="warning" title="Site Rule Override" class="mx-4">
        <div class="space-y-3">
          <p class="text-sm">Your selections will override the following automated site rules:</p>

          <ul class="list-disc pl-5 space-y-1 text-sm">
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
                  <code class="bg-secondary-200 dark:bg-secondary-700 px-1 rounded text-xs"
                    >{option.command} = {conflict.userValue}</code
                  >
                  will override
                  <code class="bg-secondary-200 dark:bg-secondary-700 px-1 rounded text-xs"
                    >{option.command} = {conflict.siteRuleValue}</code
                  >
                </li>
              {/if}
            {/each}
          </ul>

          <div class="flex gap-3 pt-2">
            <Button onclick={handleProceedAnyway} variant="primary" size="sm">
              Proceed Anyway
            </Button>
            <Button onclick={handleCancelWarning} variant="secondary" size="sm">Cancel</Button>
          </div>
        </div>
      </Info>
    {/if}

    <div class="flex justify-end m-4 gap-6">
      <Button
        onclick={clearUrlsInput}
        disabled={isLoading || !commandUrlsInput}
        class="mt-2 w-full"
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
      <Info variant="warning" dismissible>{formError}</Info>
    {/if}

    {#if $hasJsonLintErrors}
      <Info variant="warning" title="Stop!" class="m-8">
        There is at least one error in your <a href="/config" class="underline">config file</a>
        that you must fix before proceeding!
      </Info>
    {/if}

    <!-- Options Accordion -->
    <details
      class="group border border-primary-400 rounded-sm bg-secondary-50 dark:bg-primary-900"
      bind:open={isAccordionOpen}
    >
      <summary
        class="flex items-center justify-between p-4 cursor-pointer hover:rounded-t-sm dark:hover:bg-primary-800 transition-colors"
      >
        <span class="font-medium text-secondary-900 dark:text-secondary-100"> Options </span>
        <div class="flex items-center gap-2">
          {#if selectedOptions.size > 0}
            <Chip
              label={`${selectedOptions.size.toString()} selected`}
              size="sm"
              dismissible={false}
            />
          {/if}
          <span
            class="transform group-open:rotate-90 transition-transform text-secondary-600 dark:text-secondary-400"
            aria-hidden="true"
          >
            <Icon iconName="chevron-right" size={24} />
          </span>
        </div>
      </summary>

      <div class="border-t border-primary-400">
        <!-- Nested accordions for categories -->
        <div class="space-y-2 p-4">
          {#each categoriesArray as [categoryKey, category] (categoryKey)}
            <details
              class="group border border-secondary-300 dark:border-secondary-600 rounded-sm bg-white dark:bg-secondary-800"
              open={categoryAccordionStates.get(categoryKey) ?? false}
              ontoggle={e => {
                const target = e.target as HTMLDetailsElement;
                categoryAccordionStates.set(categoryKey, target.open);
                categoryAccordionStates = new Map(categoryAccordionStates);
              }}
            >
              <summary
                class="flex items-center justify-between p-3 cursor-pointer hover:rounded-sm hover:bg-accent-50 dark:hover:bg-secondary-700 transition-colors"
              >
                <span class="font-medium text-secondary-900 dark:text-secondary-100">
                  {category.title}
                </span>
                <div class="flex items-center gap-2">
                  {#if getSelectedCountForCategory(categoryKey) > 0}
                    <Chip
                      label={`${getSelectedCountForCategory(categoryKey).toString()} selected`}
                      size="sm"
                      dismissible={false}
                    />
                  {/if}
                  <span
                    class="transform group-open:rotate-90 transition-transform text-secondary-600 dark:text-secondary-400"
                    aria-hidden="true"
                  >
                    <Icon iconName="chevron-right" size={20} />
                  </span>
                </div>
              </summary>

              <div
                class="border-t border-secondary-200 dark:border-secondary-600 p-3 max-h-60 overflow-y-auto"
              >
                <div class="space-y-3">
                  {#each category.options as option (option.id)}
                    <div
                      class="flex items-start gap-3 p-2 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded transition-colors"
                    >
                      <Toggle
                        id="inline-option-{option.id}"
                        checked={selectedOptions.has(option.id)}
                        onchange={() => toggleOption(option)}
                        variant="primary"
                        size="sm"
                      />
                      <div class="flex-1 min-w-0">
                        <label for="inline-option-{option.id}" class="cursor-pointer">
                          <span
                            class="font-medium text-secondary-900 dark:text-secondary-100 block"
                          >
                            {option.command}
                          </span>
                          <span
                            class="text-sm text-secondary-600 dark:text-secondary-400 mt-1 block"
                          >
                            {option.description}
                          </span>
                        </label>
                        {#if selectedOptions.has(option.id) && option.type !== 'boolean'}
                          <div class="mt-2">
                            <input
                              type={option.type === 'number' ? 'number' : 'text'}
                              value={selectedOptions.get(option.id)?.value ?? ''}
                              oninput={e => {
                                const target = e.target;
                                if (target instanceof HTMLInputElement) {
                                  editOption(
                                    option.id,
                                    option.type === 'number' ? Number(target.value) : target.value
                                  );
                                }
                              }}
                              placeholder={option.placeholder ?? ''}
                              class="w-full px-2 py-1 text-sm border border-secondary-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-secondary-600 dark:bg-secondary-800 dark:text-secondary-100 dark:focus:ring-primary-400"
                            />
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </details>
          {/each}
        </div>
      </div>
    </details>

    <!-- Selected Options Display -->
    {#if selectedOptions.size > 0}
      <div
        class="bg-secondary-50 dark:bg-primary-900 p-2 rounded-sm border border-primary-400 mt-4"
      >
        <!-- Optional save as Site Rule -->
        {#if canSaveAsSiteRule()}
          <div
            class="save-site-rule dark:bg-gray-50 bg-gray-800 border dark:border-gray-200 border-gray-700 rounded-sm p-4 mt-4 mx-4 mb-4"
          >
            <div class="flex items-center justify-between">
              <div class="flex flex-col">
                <h4 class="text-sm font-medium dark:text-gray-800 text-gray-200">
                  Save Current Options
                </h4>
                <p class="text-xs dark:text-gray-600 text-gray-400 mt-1">
                  Create a site rule from your selected options
                </p>
              </div>
              <Button onclick={() => (showSaveRuleDialog = true)} variant="secondary" size="sm">
                <Icon iconName="save" size={20} />
              </Button>
            </div>
          </div>
        {/if}

        <div class="m-4">
          <div class="flex justify-between items-center mb-4">
            <span class="text-sm font-medium text-secondary-700 dark:text-secondary-300">
              Selected Options ({selectedOptions.size})
            </span>
            <Button
              pill
              onclick={clearAllOptions}
              size="sm"
              class="text-xs px-2 py-1 bg-secondary-200 text-secondary-800 hover:bg-secondary-300 dark:bg-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-600"
            >
              Clear All
            </Button>
          </div>
          <div class="space-y-4">
            {#each [...selectedOptionsByCategory.entries()] as [categoryKey, categoryOptions] (categoryKey)}
              {#if categoryOptions.size > 0}
                <div>
                  <h3 class="text-sm font-medium text-secondary-600 dark:text-secondary-400 mb-2">
                    {getCategoryTitle(categoryKey)} ({categoryOptions.size})
                  </h3>
                  <div class="flex flex-wrap gap-2">
                    {#each [...categoryOptions.entries()] as [optionId, optionData] (optionId)}
                      {@const option = getOptionById(optionId)}
                      {#if option}
                        <div
                          class="option-chip inline-flex items-center gap-2 px-3 py-2 rounded-sm border text-sm font-medium transition-colors"
                          class:site-config={optionData.source === 'site-config'}
                          class:border-primary-300={optionData.source === 'site-config'}
                          class:bg-primary-50={optionData.source === 'site-config'}
                          class:dark:bg-primary-800={optionData.source === 'site-config'}
                          class:dark:border-primary-500={optionData.source === 'site-config'}
                          class:border-secondary-300={optionData.source === 'user'}
                          class:bg-secondary-100={optionData.source === 'user'}
                          class:dark:bg-secondary-700={optionData.source === 'user'}
                          class:dark:border-secondary-600={optionData.source === 'user'}
                        >
                          <span class="option-name text-secondary-900 dark:text-secondary-100">
                            {option.command}
                          </span>

                          {#if optionData.value !== true && option.type !== 'boolean'}
                            <span class="text-secondary-600 dark:text-secondary-400">
                              = {optionData.value}
                            </span>
                          {/if}

                          <button
                            type="button"
                            onclick={() => removeOption(optionId)}
                            class="ml-1 text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200 text-lg leading-none"
                            title="Remove option"
                          >
                            ×
                          </button>
                        </div>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </form>
</div>
