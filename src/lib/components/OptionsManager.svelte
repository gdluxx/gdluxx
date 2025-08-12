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
  import { Button, Chip, Info, Toggle } from '$lib/components/ui';
  import optionsData from '$lib/assets/options.json';
  import type { Option, OptionsData } from '$lib/types/options';
  import type { OptionWithSource, SiteConfigData } from '$lib/types/command-form';
  import { Icon } from '$lib/components/index';
  import { SiteRuleModal } from '$lib/components/site-rules';
  import { extractUniquePatterns } from '$lib/utils/patternDetection';
  import { toastStore } from '$lib/stores/toast';

  const typedOptionsData = optionsData as OptionsData;

  interface Conflict {
    optionId: string;
    userValue: string | number | boolean;
    siteRuleValue: string | number | boolean;
    sitePattern: string;
    configName?: string;
  }

  let {
    selectedOptions = $bindable(),
    conflicts = $bindable(),
    conflictWarnings = $bindable(),

    siteConfigData, // eslint-disable-line prefer-const
    userWarningSetting, // eslint-disable-line prefer-const
    commandUrlsInput, // eslint-disable-line prefer-const

    onConflictDetected, // eslint-disable-line prefer-const
    onSiteRuleSaved, // eslint-disable-line prefer-const
  }: {
    selectedOptions: Map<string, OptionWithSource>;
    conflicts: Conflict[];
    siteConfigData: SiteConfigData[];
    conflictWarnings: Map<string, string>;
    userWarningSetting: boolean;
    commandUrlsInput: string;
    onConflictDetected?: (conflicts: Conflict[]) => void;
    onSiteRuleSaved?: () => void;
  } = $props();

  let selectedOptionsByCategory = $state<Map<string, Map<string, OptionWithSource>>>(new Map());
  let categoryAccordionStates = $state(new Map<string, boolean>());
  let isAccordionOpen = $state(false);
  let showSaveRuleDialog = $state(false);

  // category accordion states closed by default
  $effect(() => {
    const newAccordionStates = new Map(categoryAccordionStates);
    let hasChanges = false;

    for (const categoryKey of Object.keys(typedOptionsData)) {
      if (!newAccordionStates.has(categoryKey)) {
        newAccordionStates.set(categoryKey, false);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      categoryAccordionStates = newAccordionStates;
    }
  });

  const allOptions: Option[] = Object.values(typedOptionsData).flatMap(
    category => category.options as Option[]
  );
  const categoriesArray = Object.entries(typedOptionsData);

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
  }

  function removeOption(optionId: string) {
    selectedOptions.delete(optionId);
    conflictWarnings.delete(optionId);
    selectedOptions = new Map(selectedOptions);
    conflictWarnings = new Map(conflictWarnings);
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
    const newCategoryMap = new Map<string, Map<string, OptionWithSource>>();

    for (const [optionId, optionData] of selectedOptions.entries()) {
      const categoryKey = getCategoryKeyForOption(optionId);
      if (categoryKey) {
        if (!newCategoryMap.has(categoryKey)) {
          newCategoryMap.set(categoryKey, new Map());
        }
        const categoryMap = newCategoryMap.get(categoryKey);
        if (categoryMap) {
          categoryMap.set(optionId, optionData);
        }
      }
    }

    selectedOptionsByCategory = newCategoryMap;
  }

  function detectConflicts(siteConfigs: SiteConfigData[]): Conflict[] {
    const detectedConflicts: Conflict[] = [];

    const userSelectedOptions = Array.from(selectedOptions.entries()).filter(
      ([, optionData]) => optionData.source === 'user'
    );

    for (const [optionId, userOptionData] of userSelectedOptions) {
      for (const config of siteConfigs) {
        if (optionId in config.options) {
          const siteRuleValue = config.options[optionId];
          if (userOptionData.value !== siteRuleValue) {
            detectedConflicts.push({
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

    return detectedConflicts;
  }

  function revertToSiteConfig(optionId: string) {
    const currentOption = selectedOptions.get(optionId);
    if (!currentOption) {
      return;
    }

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

    conflictWarnings.delete(optionId);

    selectedOptions = new Map(selectedOptions);
    conflictWarnings = new Map(conflictWarnings);
  }

  function clearAllOptions() {
    selectedOptions = new Map();
    selectedOptionsByCategory = new Map();
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
    onSiteRuleSaved?.();
  }

  let previousConflictCount = $state(0);

  $effect(() => {
    if (userWarningSetting && siteConfigData.length > 0 && selectedOptions.size > 0) {
      const detectedConflicts = detectConflicts(siteConfigData);
      if (detectedConflicts.length !== previousConflictCount) {
        previousConflictCount = detectedConflicts.length;
        conflicts = detectedConflicts;
        if (detectedConflicts.length > 0) {
          onConflictDetected?.(detectedConflicts);
        }
      }
    } else if (conflicts.length > 0) {
      conflicts = [];
      previousConflictCount = 0;
    }
  });

  $effect(() => {
    updateCategoryTracking();
  });
</script>

<!-- Options Accordion -->
<details
  class="group border border-primary-400 rounded-sm bg-secondary-50 dark:bg-primary-900"
  bind:open={isAccordionOpen}
>
  <summary
    class="flex items-center justify-between p-4 cursor-pointer hover:rounded-t-sm dark:hover:bg-primary-800 transition-colors"
  >
    <div class="flex items-center gap-1">
      <Icon iconName="options" size={20} class="text-secondary-600 dark:text-secondary-400" />
      <span class="font-medium text-secondary-900 dark:text-secondary-100"> Options </span>
    </div>
    <div class="flex items-center gap-2">
      {#if selectedOptions.size > 0}
        <Chip label={`${selectedOptions.size.toString()} selected`} size="sm" dismissible={false} />
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
          </div>
        </details>
      {/each}
    </div>
  </div>
</details>

<!-- Conflict warnings panel -->
{#if conflictWarnings.size > 0}
  <Info variant="warning" title="Conflicts Detected" class="my-4">
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

<!-- Selected options display -->
{#if selectedOptions.size > 0}
  <div class="bg-secondary-50 dark:bg-primary-900 p-2 rounded-sm border border-primary-400 mt-4">
    <!-- Optional to save as Site Rule -->
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

        <!-- Legend/key -->
        <div
          class="cursor-default flex items-center gap-4 text-xs text-secondary-600 dark:text-secondary-400"
        >
          <div
            class="flex items-center gap-1 border rounded-sm border-secondary-800 dark:border-secondary-200 px-2 py-1"
          >
            <Icon iconName="site-rules" size={16} class="text-primary-600 dark:text-primary-400" />
            <span>Site Rules</span>
          </div>
          <div
            class="flex items-center gap-1 border rounded-sm border-secondary-800 dark:border-secondary-200 px-2 py-1"
          >
            <Icon iconName="options" size={16} class="text-secondary-600 dark:text-secondary-400" />
            <span>User Selected</span>
          </div>
        </div>

        <Button
          pill
          onclick={clearAllOptions}
          size="sm"
          class="text-xs px-2 py-1 bg-secondary-200 text-secondary-800 hover:bg-secondary-300 dark:bg-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-600"
        >
          Clear All
        </Button>
      </div>
      <div class="space-y-4 cursor-default">
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
                      <!-- Source indicator icon -->
                      {#if optionData.source === 'site-config'}
                        <Icon
                          iconName="site-rules"
                          size={20}
                          class="text-primary-600 dark:text-primary-400"
                        />
                      {:else}
                        <Icon
                          iconName="options"
                          size={20}
                          class="text-secondary-600 dark:text-secondary-400"
                        />
                      {/if}

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

<!-- Save rule modal -->
{#if showSaveRuleDialog}
  <SiteRuleModal
    show={showSaveRuleDialog}
    options={getUserSelectedOptions()}
    detectedPatterns={extractUniquePatterns(
      commandUrlsInput
        .split(/[\s\n]+/)
        .map(url => url.trim())
        .filter(url => url !== '')
    )}
    onSaved={handleSiteRuleSaved}
    onCancel={() => (showSaveRuleDialog = false)}
  />
{/if}
