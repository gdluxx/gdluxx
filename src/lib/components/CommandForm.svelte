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
  import { logger } from '$lib/shared/logger';
  import { Button, Info } from '$lib/components/ui';
  import optionsData from '$lib/assets/options.json';
  import type { Option, OptionsData } from '$lib/types/options';
  import type { OptionWithSource } from '$lib/types/command-form';
  import { browser } from '$app/environment';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { Icon } from '$lib/components/index';
  import SaveSiteRuleModal from './SaveSiteRuleModal.svelte';
  import { extractUniquePatterns } from '$lib/utils/patternDetection';

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

  interface SiteConfigData {
    url: string;
    hostname: string;
    hasMatch: boolean;
    matchedPattern?: string;
    configName?: string;
    options: Map<string, string | number | boolean>;
  }

  let commandUrlsInput = $state('');
  let isLoading = $state(false);
  let formError = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let selectedOptions = $state(new Map<string, OptionWithSource>());
  let selectedOptionsByCategory = $state<Map<string, Map<string, OptionWithSource>>>(new Map());
  let siteConfigData = $state<SiteConfigData[]>([]);
  let conflictWarnings = $state(new Map<string, string>());
  let activeTab = $state<string>('');
  let isAccordionOpen = $state(false);
  let showSaveRuleDialog = $state(false);

  const STORAGE_KEY = 'commandForm_selectedOptions';

  const allOptions: Option[] = Object.values(typedOptionsData).flatMap(
    category => category.options as Option[]
  );

  const categoriesArray = Object.entries(typedOptionsData);

  onMount(async () => {
    await checkConfigFileForErrors();
    loadSelectedOptions();
    // Set first category as default active tab
    const firstCategoryKey = Object.keys(typedOptionsData)[0];
    if (firstCategoryKey) {
      activeTab = firstCategoryKey;
    }
  });

  // Save options to localStorage whenever they change
  $effect(() => {
    if (browser && selectedOptions.size > 0) {
      const optionsArray = Array.from(selectedOptions.entries()).map(([key, optionData]) => [
        key,
        optionData.value,
      ]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(optionsArray));
    }
  });

  function loadSelectedOptions() {
    if (browser) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const optionsArray = JSON.parse(stored) as Array<[string, string | number | boolean]>;
          for (const [optionId, value] of optionsArray) {
            selectedOptions.set(optionId, {
              value,
              source: 'user',
            });
          }
          selectedOptions = new Map(selectedOptions);
          updateCategoryTracking();
        }
      } catch (error) {
        logger.error('Failed to load stored options:', error);
      }
    }
  }

  function clearStoredOptions() {
    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

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
      for (const [optionId, value] of config.options) {
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

  function convertOptionsMapForSubmission(
    optionsMap: Map<string, OptionWithSource>
  ): Map<string, string | number | boolean> {
    const submissionMap = new Map<string, string | number | boolean>();
    for (const [key, optionData] of optionsMap) {
      submissionMap.set(key, optionData.value);
    }
    return submissionMap;
  }

  function handleFormResult(result: FormResult) {
    successMessage = null;
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
      successMessage = `${localStartedCount} job(s) accepted for processing.`;
      if (localErrorMessages.length === 0) {
        commandUrlsInput = '';
      }
      setTimeout(() => (successMessage = null), 5000);
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
    successMessage = null;
  }

  function clearAllOptions() {
    selectedOptions = new Map();
    selectedOptionsByCategory = new Map();
    clearStoredOptions();
  }

  function revertToSiteConfig(optionId: string) {
    const currentOption = selectedOptions.get(optionId);
    if (!currentOption) {
      return;
    }

    // Find the original site config value from siteConfigData
    for (const config of siteConfigData) {
      for (const [siteOptionId, value] of config.options) {
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
    successMessage = 'Site rule saved successfully!';
    setTimeout(() => (successMessage = null), 5000);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    const urls = extractUrlsFromInput(commandUrlsInput);

    if (urls.length === 0) {
      formError = 'Please enter at least one URL.';
      return;
    }

    isLoading = true;
    successMessage = null;
    formError = null;

    try {
      // 1. Load site configs for URLs
      const siteConfigResponse = await fetch('/api/site-configs/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (siteConfigResponse.ok) {
        const { data: siteConfigs } = await siteConfigResponse.json();
        if (siteConfigs && siteConfigs.length > 0) {
          siteConfigData = siteConfigs;
          mergeSiteConfigsWithUserOptions(siteConfigs);
        }
      }

      // 2. Proceed with job submission using merged options
      const finalOptions = convertOptionsMapForSubmission(selectedOptions);
      const result = await jobStore.startJob(urls, finalOptions);
      handleFormResult(result);
    } catch (error) {
      logger.error('Failed to start jobs:', error);
      formError = error instanceof Error ? error.message : 'An unexpected error occurred';
    } finally {
      isLoading = false;
    }
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

    <!-- Site Config Summary Panel -->
    {#if siteConfigData.length > 0}
      <div class="site-config-summary bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-sm p-4 mx-4 mb-4">
        <h4 class="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
          🔧 Site Configurations Detected
        </h4>
        <div class="space-y-2">
          {#each siteConfigData as config (config.url)}
            <div class="config-item flex items-center justify-between bg-white dark:bg-blue-800/30 px-3 py-2 rounded border border-blue-200 dark:border-blue-600">
              <div class="flex flex-col">
                <span class="font-medium text-blue-900 dark:text-blue-100 text-sm">
                  {config.configName}
                </span>
                <span class="text-xs text-blue-600 dark:text-blue-300">
                  for {config.matchedPattern}
                </span>
              </div>
              <span class="option-count px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full text-xs font-medium">
                {config.options.size} options
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Conflict Warnings Panel -->
    {#if conflictWarnings.size > 0}
      <div class="conflict-warnings bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-sm p-4 mx-4 mb-4">
        <h4 class="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200 mb-3">
          ⚠️ Option Conflicts Detected
        </h4>
        <div class="space-y-2">
          {#each Array.from(conflictWarnings.entries()) as [optionId, warning] (optionId)}
            {@const option = getOptionById(optionId)}
            {#if option}
              <div class="warning-item flex items-center justify-between bg-white dark:bg-red-800/30 px-3 py-2 rounded border border-red-200 dark:border-red-600">
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="font-medium text-red-900 dark:text-red-100 text-sm">
                    {option.command}
                  </span>
                  <span class="text-xs text-red-600 dark:text-red-300 break-words">
                    {warning}
                  </span>
                </div>
                <Button 
                  onclick={() => revertToSiteConfig(optionId)}
                  class="ml-3 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700 text-xs font-medium rounded border border-red-300 dark:border-red-600"
                >
                  Revert
                </Button>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Save as Site Rule -->
    {#if canSaveAsSiteRule()}
      <div class="save-site-rule bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm p-4 mx-4 mb-4">
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">
              Save Current Options
            </h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Create a site rule from your selected options
            </p>
          </div>
          <Button
            onclick={() => (showSaveRuleDialog = true)}
            variant="primary"
            class="px-4 py-2 text-sm font-medium"
          >
            💾 Save as Site Rule
          </Button>
        </div>
      </div>
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

    {#if successMessage && !formError}
      <Info variant="success" dismissible class="m-4">
        {successMessage}
      </Info>
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
        class="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary-100 dark:hover:bg-primary-800 transition-colors"
      >
        <span class="font-medium text-secondary-900 dark:text-secondary-100">Options</span>
        <div class="flex items-center gap-2">
          {#if selectedOptions.size > 0}
            <span
              class="px-2 py-1 bg-primary-100 text-primary-800 dark:bg-primary-700 dark:text-primary-100 rounded-full text-sm"
            >
              {selectedOptions.size} selected
            </span>
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
        <!-- Tabbed interface for categories -->
        <div class="border-b border-secondary-200 dark:border-secondary-700">
          <div class="flex overflow-x-auto pt-2 pr-2">
            {#each categoriesArray as [categoryKey, category] (categoryKey)}
              <button
                type="button"
                class="cursor-pointer px-4 py-2 whitespace-nowrap relative border-b-2 transition-colors hover:bg-secondary-100 dark:hover:bg-primary-800"
                class:border-primary-500={activeTab === categoryKey}
                class:text-primary-600={activeTab === categoryKey}
                class:border-transparent={activeTab !== categoryKey}
                class:text-secondary-600={activeTab !== categoryKey}
                class:dark:text-primary-400={activeTab === categoryKey}
                class:dark:text-secondary-400={activeTab !== categoryKey}
                onclick={() => (activeTab = categoryKey)}
              >
                <div class="flex flex-row">
                  {#if getSelectedCountForCategory(categoryKey) > 0}
                    <span
                      class="mr-1 flex items-center justify-center"
                      class:text-primary-600={activeTab === categoryKey}
                      class:text-secondary-600={activeTab !== categoryKey}
                      class:dark:text-primary-400={activeTab === categoryKey}
                      class:dark:text-secondary-400={activeTab !== categoryKey}
                    >
                      {getSelectedCountForCategory(categoryKey)}
                    </span>
                  {/if}
                  {category.title}
                </div>
                <!-- {#if getSelectedCountForCategory(categoryKey) > 0} -->
                <!--   <span -->
                <!--     class="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center" -->
                <!--   > -->
                <!--     {getSelectedCountForCategory(categoryKey)} -->
                <!--   </span> -->
                <!-- {/if} -->
              </button>
            {/each}
          </div>
        </div>

        <!-- Tab content -->
        <div class="p-4 max-h-60 overflow-y-auto">
          {#each categoriesArray as [categoryKey, category] (categoryKey)}
            {#if activeTab === categoryKey}
              <div class="space-y-3">
                {#each category.options as option (option.id)}
                  <div
                    class="flex items-start gap-3 p-2 hover:bg-secondary-100 dark:hover:bg-primary-800 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      id="inline-option-{option.id}"
                      checked={selectedOptions.has(option.id)}
                      onchange={() => toggleOption(option)}
                      class="mt-1 h-4 w-4 rounded border-secondary-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-700 dark:focus:ring-primary-400"
                    />
                    <div class="flex-1 min-w-0">
                      <label for="inline-option-{option.id}" class="cursor-pointer">
                        <span class="font-medium text-secondary-900 dark:text-secondary-100 block">
                          {option.command}
                        </span>
                        <span class="text-sm text-secondary-600 dark:text-secondary-400 mt-1 block">
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
            {/if}
          {/each}
        </div>
      </div>
    </details>

    <!-- Selected Options Display -->
    {#if selectedOptions.size > 0}
      <div
        class="bg-secondary-50 dark:bg-primary-900 p-2 rounded-sm border border-primary-400 mt-4"
      >
        <div class="m-4">
          <div class="flex justify-between items-center mb-4">
            <span class="text-sm font-medium text-secondary-700 dark:text-secondary-300">
              Selected Options ({selectedOptions.size})
            </span>
            <Button
              onclick={clearAllOptions}
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

                          {#if optionData.value !== true}
                            <span class="text-secondary-600 dark:text-secondary-400">
                              = {optionData.value}
                            </span>
                          {/if}

                          <!-- Source indicator -->
                          {#if optionData.source === 'site-config'}
                            <span
                              class="source-badge site-config inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium"
                              title="From site config: {optionData.configName}"
                            >
                              🔧 {optionData.sitePattern}
                            </span>
                          {:else}
                            <span 
                              class="source-badge user inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded text-xs font-medium"
                              title="Manually selected"
                            >
                              👤
                            </span>
                          {/if}

                          <!-- Conflict warning -->
                          {#if conflictWarnings.has(optionId)}
                            <span 
                              class="conflict-warning text-red-600 dark:text-red-400 text-lg"
                              title={conflictWarnings.get(optionId)}
                            >
                              ⚠️
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
