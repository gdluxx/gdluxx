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
  import { type BatchJobStartResult, jobStore } from '$lib/stores/jobs';
  import { logger } from '$lib/shared/logger';
  import { Button, Chip, Info } from '$lib/components/ui';
  import Options from '$lib/components/Options.svelte';
  import optionsData from '$lib/assets/options.json';
  import type { Option, OptionCategory, OptionsData } from '$lib/types/options';
  import { browser } from '$app/environment';

  type SelectedOptions = Map<string, string | number | boolean>;

  let commandUrlsInput = $state('');
  const useUserConfigPath = $state(false);
  let isLoading = $state(false);
  let formError = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let isOptionsOpen = $state(false);
  let selectedOptions = $state(new Map<string, string | number | boolean>());
  let currentCategory = $state<OptionCategory | null>(null);
  let selectedOptionsByCategory = $state<Map<string, Map<string, string | number | boolean>>>(
    new Map()
  );

  const STORAGE_KEY = 'commandForm_selectedOptions';

  const allOptions: Option[] = Object.values(optionsData as OptionsData).flatMap(
    category => category.options as Option[]
  );

  onMount(async () => {
    await checkConfigFileForErrors();
    loadSelectedOptions();
  });

  // Save options to localStorage whenever they change
  $effect(() => {
    if (browser && selectedOptions.size > 0) {
      const optionsArray = Array.from(selectedOptions.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(optionsArray));
    }
  });

  function loadSelectedOptions() {
    if (browser) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const optionsArray = JSON.parse(stored) as Array<[string, string | number | boolean]>;
          selectedOptions = new Map(optionsArray);
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

  function openOptions(category: OptionCategory) {
    currentCategory = category;
    isOptionsOpen = true;
  }

  function handleApplyOptions(newOptions: SelectedOptions | Set<string>) {
    if (newOptions instanceof Map) {
      selectedOptions = new Map(newOptions);
      updateCategoryTracking();
    }
    isOptionsOpen = false;
  }

  function removeOption(optionId: string) {
    selectedOptions.delete(optionId);
    selectedOptions = new Map(selectedOptions);
    updateCategoryTracking();
  }

  function editOption(optionId: string, newValue: string | number | boolean) {
    if (selectedOptions.has(optionId)) {
      selectedOptions.set(optionId, newValue);
      selectedOptions = new Map(selectedOptions);
      updateCategoryTracking();
    }
  }

  function getOptionById(optionId: string): Option | undefined {
    return allOptions.find(opt => opt.id === optionId);
  }

  function getCategoryKeyForOption(optionId: string): string | undefined {
    for (const [categoryKey, category] of Object.entries(optionsData as OptionsData)) {
      if (category.options.some(opt => opt.id === optionId)) {
        return categoryKey;
      }
    }
    return undefined;
  }

  function getCategoryTitle(categoryKey: string): string {
    const optionsDataTyped = optionsData as OptionsData;
    return optionsDataTyped[categoryKey]?.title || categoryKey;
  }

  function getSelectedCountForCategory(categoryKey: string): number {
    const categoryMap = selectedOptionsByCategory.get(categoryKey);
    return categoryMap ? categoryMap.size : 0;
  }

  function updateCategoryTracking() {
    selectedOptionsByCategory.clear();

    for (const [optionId, value] of selectedOptions.entries()) {
      const categoryKey = getCategoryKeyForOption(optionId);
      if (categoryKey) {
        if (!selectedOptionsByCategory.has(categoryKey)) {
          selectedOptionsByCategory.set(categoryKey, new Map());
        }
        const categoryMap = selectedOptionsByCategory.get(categoryKey);
        if (categoryMap) {
          categoryMap.set(optionId, value);
        }
      }
    }

    selectedOptionsByCategory = new Map(selectedOptionsByCategory);
  }

  async function checkConfigFileForErrors() {
    try {
      const response = await fetch('/api/files/read');
      const data = await response.json();

      if (data.success) {
        try {
          JSON.parse(data.content);
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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    successMessage = null;
    formError = null;

    const urlsToProcess = commandUrlsInput
      .split(/[\s\n]+/) // Split by any whitespace; space, tab, newline etc.
      .map(url => url.trim())
      .filter(url => url !== ''); // Remove empty strings

    if (urlsToProcess.length === 0) {
      formError = 'Please enter at least one URL.';
      return;
    }

    isLoading = true;

    const batchStartResult: BatchJobStartResult = await jobStore.startJob(
      urlsToProcess,
      useUserConfigPath,
      selectedOptions
    );

    isLoading = false;
    let localStartedCount = 0;
    const localErrorMessages: string[] = [];

    if (batchStartResult.results && batchStartResult.results.length > 0) {
      batchStartResult.results.forEach(result => {
        if (result.success && result.jobId) {
          localStartedCount++;
        } else {
          localErrorMessages.push(
            `Error for "${result.url}": ${result.error ?? result.message ?? 'Unknown error'}`
          );
        }
      });
    } else if (!batchStartResult.overallSuccess) {
      formError =
        batchStartResult.results?.[0]?.error ??
        batchStartResult.error ??
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
        // useUserConfigPath = false; // TODO: Future use
      }
      setTimeout(() => (successMessage = null), 5000);
    }

    if (localStartedCount === 0 && localErrorMessages.length === 0 && urlsToProcess.length > 0) {
      if (!batchStartResult.overallSuccess) {
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
</script>

<div
  class="bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
>
  <form onsubmit={handleSubmit} class="space-y-6">
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
          name="commandUrlsInput"
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

    <div class="flex justify-end m-4 gap-6">
      <Button
        onclick={clearUrlsInput}
        disabled={isLoading || !commandUrlsInput}
        class="mt-2 w-full"
      >
        Clear
      </Button>

      <Button
        variant="outline-primary"
        class="mt-2 w-full"
      >
        Options
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

    <!-- Options --> <!-- bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800 -->
    <div class="bg-secondary-50 dark:bg-primary-900 p-2 rounded-sm border border-primary-400">
      <div class="m-4 flex flex-wrap gap-2">
        {#each Object.entries(optionsData as OptionsData) as [categoryKey, category] (category.title)}
          <Button
            variant="light"
            type="button"
            onclick={() => openOptions(category)}
            class="relative"
          >
            {category.title}
            {#if getSelectedCountForCategory(categoryKey) > 0}
              <span
                class="absolute -top-2 -right-2 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center"
              >
                {getSelectedCountForCategory(categoryKey)}
              </span>
            {/if}
          </Button>
        {/each}
      </div>

      {#if selectedOptions.size > 0}
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
                    {#each [...categoryOptions.entries()] as [optionId, value] (optionId)}
                      {@const option = getOptionById(optionId)}
                      {#if option}
                        <Chip
                          label={option.command}
                          {value}
                          editable={option.type !== 'boolean'}
                          on:remove={() => removeOption(optionId)}
                          on:edit={e => editOption(optionId, e.detail.value)}
                        />
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>

  </form>
</div>

{#if isOptionsOpen && currentCategory}
  <Options
    isOpen={isOptionsOpen}
    category={currentCategory}
    {selectedOptions}
    onClose={() => (isOptionsOpen = false)}
    onApply={handleApplyOptions}
  />
{/if}
