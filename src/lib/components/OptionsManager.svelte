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
  import type { Option, OptionCategory, OptionsData } from '$lib/types/options';
  import type { Conflict, OptionWithSource, SiteConfigData } from '$lib/types/command-form';
  import {
    allOptions,
    detectConflicts,
    optionsById,
    SENSITIVE_MASK,
  } from '$lib/utils/commandOptions';
  import { Icon } from '$lib/components/index';
  import { SiteRuleModal } from '$lib/components/site-rules';
  import { extractUniquePatterns } from '$lib/utils/patternDetection';
  import { parseUrls } from '$lib/utils/parseUrls';
  import { toastStore } from '$lib/stores/toast';

  const typedOptionsData = optionsData as OptionsData;

  let {
    selectedOptions = $bindable(),
    conflicts = $bindable(),
    conflictWarnings = $bindable(),
    dismissedSiteRuleOptions = $bindable(),

    siteConfigData, // eslint-disable-line prefer-const
    userWarningSetting, // eslint-disable-line prefer-const
    commandUrlsInput, // eslint-disable-line prefer-const
    runDisabled, // eslint-disable-line prefer-const
    runFormId, // eslint-disable-line prefer-const
    isRunning, // eslint-disable-line prefer-const
    emptyValueOptionIds, // eslint-disable-line prefer-const

    onConflictDetected, // eslint-disable-line prefer-const
    onSiteRuleSaved, // eslint-disable-line prefer-const
  }: {
    selectedOptions: Map<string, OptionWithSource>;
    conflicts: Conflict[];
    conflictWarnings: Map<string, string>;
    dismissedSiteRuleOptions: Set<string>;
    siteConfigData: SiteConfigData[];
    userWarningSetting: boolean;
    commandUrlsInput: string;
    runDisabled: boolean;
    runFormId: string;
    isRunning: boolean;
    emptyValueOptionIds: Set<string>;
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

  const categoriesArray = Object.entries(typedOptionsData);

  let optionsSearch = $state('');
  const searchActive = $derived(optionsSearch.trim().length > 0);

  const filteredCategories = $derived.by((): Array<[string, OptionCategory]> => {
    if (!searchActive) {
      return categoriesArray;
    }
    const query = optionsSearch.trim().toLowerCase();
    return categoriesArray
      .map(([key, category]): [string, OptionCategory] => {
        const options = category.options.filter(
          (option) =>
            option.command.toLowerCase().includes(query) ||
            option.description.toLowerCase().includes(query),
        );
        return [key, { ...category, options }];
      })
      .filter(([, category]) => category.options.length > 0);
  });

  const filteredOptionCount = $derived(
    filteredCategories.reduce((sum, [, category]) => sum + category.options.length, 0),
  );

  function toggleOption(option: Option) {
    const { id, defaultValue } = option;
    if (selectedOptions.has(id)) {
      selectedOptions.delete(id);
    } else {
      selectedOptions.set(id, {
        value: defaultValue ?? (option.type === 'boolean' ? true : ''),
        source: 'user',
      });
    }
    selectedOptions = new Map(selectedOptions);
  }

  function removeOption(optionId: string) {
    // Dismissing a site-rule chip suppresses it from the parent's re-merge so it
    // won't immediately reappear; the reassignment triggers that effect
    if (selectedOptions.get(optionId)?.source === 'site-config') {
      dismissedSiteRuleOptions = new Set([...dismissedSiteRuleOptions, optionId]);
    }

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

  function getCategoryKeyForOption(optionId: string): string | undefined {
    for (const [categoryKey, category] of Object.entries(typedOptionsData)) {
      if (category.options.some((opt) => opt.id === optionId)) {
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
    // Keep site-config (and any non-user) entries; clearing dismissals lets the
    // parent's re-merge restore previously dismissed site-rule chips
    selectedOptions = new Map([...selectedOptions].filter(([, d]) => d.source !== 'user'));
    conflictWarnings = new Map();
    dismissedSiteRuleOptions = new Set();
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
      const detectedConflicts = detectConflicts(selectedOptions, siteConfigData);
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
  class="group m-4 rounded-sm bg-surface-elevated border-strong"
  bind:open={isAccordionOpen}
>
  <summary
    class="flex cursor-pointer items-center justify-between p-4 transition-colors hover:rounded-t-sm hover:bg-surface-hover"
  >
    <div class="flex items-center gap-1">
      <Icon
        iconName="options"
        size={20}
        class="text-foreground"
      />
      <span class="font-medium text-foreground"> Options </span>
    </div>
    <div class="flex items-center gap-2">
      {#if selectedOptions.size > 0}
        <Chip
          label={`${selectedOptions.size.toString()} selected`}
          size="sm"
        />
      {/if}
      <span
        class="transform text-foreground transition-transform group-open:rotate-90"
        aria-hidden="true"
      >
        <Icon
          iconName="chevron-right"
          size={24}
        />
      </span>
    </div>
  </summary>

  <div class="bg-surface-sunken border-t-strong">
    <!-- Sticky search across all option flags/descriptions -->
    <div class="sticky top-0 z-10 bg-surface-sunken px-4 pt-4 pb-2">
      <input
        type="text"
        bind:value={optionsSearch}
        placeholder="Search options by flag or description..."
        aria-label="Search options"
        class="form-input"
      />
      {#if searchActive}
        <p class="mt-1 text-xs text-muted-foreground">
          Showing {filteredOptionCount} of {allOptions.length} options
        </p>
      {/if}
    </div>

    <!-- Nested accordions for categories -->
    <div class="space-y-2 p-4 pt-2">
      {#each filteredCategories as [categoryKey, category] (categoryKey)}
        <details
          class="group rounded-sm bg-surface-elevated border-strong"
          open={searchActive ? true : (categoryAccordionStates.get(categoryKey) ?? false)}
          ontoggle={(e) => {
            if (searchActive) {
              return;
            }
            const target = e.target as HTMLDetailsElement;
            categoryAccordionStates.set(categoryKey, target.open);
            categoryAccordionStates = new Map(categoryAccordionStates);
          }}
        >
          <summary
            class="flex cursor-pointer items-center justify-between p-3 transition-colors hover:rounded-sm hover:bg-surface-hover"
          >
            <span class="font-medium text-foreground">
              {category.title}
            </span>
            <div class="flex items-center gap-2">
              {#if getSelectedCountForCategory(categoryKey) > 0}
                <Chip
                  label={`${getSelectedCountForCategory(categoryKey).toString()} selected`}
                  size="sm"
                />
              {/if}
              <span
                class="transform text-foreground transition-transform group-open:rotate-90"
                aria-hidden="true"
              >
                <Icon
                  iconName="chevron-right"
                  size={20}
                />
              </span>
            </div>
          </summary>

          <div class="bg-surface-sunken p-3 border-t-strong">
            <div class="space-y-3">
              {#each category.options as option (option.id)}
                <div
                  class="flex items-start gap-3 rounded bg-surface-elevated p-2 transition-colors border-strong"
                >
                  <Toggle
                    id="inline-option-{option.id}"
                    checked={selectedOptions.has(option.id)}
                    onchange={() => toggleOption(option)}
                    variant="primary"
                    size="sm"
                  />
                  <div class="min-w-0 flex-1">
                    <label
                      for="inline-option-{option.id}"
                      class="cursor-pointer"
                    >
                      <span class="font-medium text-foreground">
                        {option.command}
                      </span>
                      <span class="mt-1 block text-sm text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                    {#if selectedOptions.has(option.id) && option.type !== 'boolean'}
                      <div class="mt-2">
                        <input
                          type={option.type === 'number'
                            ? 'number'
                            : option.sensitive
                              ? 'password'
                              : 'text'}
                          value={selectedOptions.get(option.id)?.value ?? ''}
                          oninput={(e) => {
                            const target = e.target;
                            if (target instanceof HTMLInputElement) {
                              editOption(
                                option.id,
                                option.type === 'number'
                                  ? target.value === ''
                                    ? ''
                                    : Number(target.value)
                                  : target.value,
                              );
                            }
                          }}
                          placeholder={option.placeholder ?? ''}
                          class="bg-input w-full rounded-sm px-2 py-1 text-sm text-foreground focus:ring-primary {emptyValueOptionIds.has(
                            option.id,
                          )
                            ? 'border-warning'
                            : 'border-strong'}"
                        />
                        {#if emptyValueOptionIds.has(option.id)}
                          <p class="mt-1 text-xs text-warning">Value required</p>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </details>
      {/each}

      {#if searchActive && filteredCategories.length === 0}
        <p class="cursor-default py-8 text-center text-sm text-muted-foreground">
          No options match your search.
        </p>
      {/if}
    </div>
  </div>
</details>

<!-- Conflict warnings panel -->
{#if conflictWarnings.size > 0}
  <Info
    variant="warning"
    title="Conflicts Detected"
    class="my-4"
  >
    {#each Array.from(conflictWarnings.entries()) as [optionId, warning] (optionId)}
      {@const option = optionsById.get(optionId)}
      {#if option}
        <div
          class="config-item flex items-center justify-between rounded border bg-surface px-3 py-2"
        >
          <div class="flex flex-col">
            <span class="text-sm font-medium text-foreground">
              {option.command}
            </span>
            <span class="text-xs text-warning">
              {warning}
            </span>
          </div>
          <Button
            variant="warning"
            size="sm"
            onclick={() => revertToSiteConfig(optionId)}
          >
            Revert
          </Button>
        </div>
      {/if}
    {/each}
  </Info>
{/if}

<!-- Selected options display -->
{#if selectedOptions.size > 0}
  <div class="m-4 rounded-sm bg-surface-elevated p-2 border-strong">
    <!-- Optional to save as Site Rule -->
    {#if canSaveAsSiteRule()}
      <div class="save-site-rule mx-4 mt-4 mb-4 rounded-sm bg-surface p-4 border-strong">
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <h4 class="text-sm font-medium text-foreground">Save Current Options</h4>
            <p class="mt-1 text-xs text-muted-foreground">
              Create a site rule from your selected options
            </p>
          </div>
          <Button
            onclick={() => (showSaveRuleDialog = true)}
            variant="outline-primary"
            size="sm"
          >
            <Icon
              iconName="save"
              size={20}
            />
          </Button>
        </div>
      </div>
    {/if}

    <div class="m-4">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-sm font-medium text-foreground">
          Selected Options <span class="text-primary">({selectedOptions.size})</span>
        </span>

        <!-- Legend/key -->
        <div class="flex cursor-default items-center gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <Icon
              iconName="site-rules"
              size={14}
            />
            Site rules
          </span>
          <span class="flex items-center gap-1">
            <Icon
              iconName="options"
              size={14}
            />
            User selected
          </span>
        </div>

        <div class="flex items-center gap-2">
          <Button
            pill
            onclick={clearAllOptions}
            size="sm"
            variant="warning"
            class="px-2 py-1 text-xs"
          >
            Clear All
          </Button>
          <Button
            type="submit"
            form={runFormId}
            disabled={runDisabled}
            variant="primary"
            size="sm"
          >
            {isRunning ? 'Running…' : 'Run'}
          </Button>
        </div>
      </div>
      <div class="cursor-default space-y-4">
        {#each [...selectedOptionsByCategory.entries()] as [categoryKey, categoryOptions] (categoryKey)}
          {#if categoryOptions.size > 0}
            <div>
              <h3 class="mb-2 text-sm font-medium">
                <span class="text-foreground">{getCategoryTitle(categoryKey)}</span>
                <span class="text-primary">({categoryOptions.size})</span>
              </h3>
              <div class="flex flex-wrap gap-2">
                {#each [...categoryOptions.entries()] as [optionId, optionData] (optionId)}
                  {@const option = optionsById.get(optionId)}
                  {#if option}
                    <Chip
                      label={option.command}
                      value={optionData.value !== true && option.type !== 'boolean'
                        ? option.sensitive
                          ? SENSITIVE_MASK
                          : optionData.value
                        : undefined}
                      variant={optionData.source === 'site-config' ? 'primary' : 'outline-primary'}
                      size="default"
                      dismissible={true}
                      editable={option.type === 'string' &&
                        optionData.source === 'user' &&
                        !option.sensitive}
                      onDismiss={() => removeOption(optionId)}
                      onEdit={(newValue) => editOption(optionId, newValue)}
                      ariaLabel={`${optionData.source === 'site-config' ? 'Site rule' : 'User selected'} option: ${option.command}`}
                    >
                      {#snippet icon()}
                        {#if optionData.source === 'site-config'}
                          <Icon
                            iconName="site-rules"
                            size={16}
                          />
                        {:else}
                          <Icon
                            iconName="options"
                            size={16}
                          />
                        {/if}
                      {/snippet}
                    </Chip>
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
    detectedPatterns={extractUniquePatterns(parseUrls(commandUrlsInput))}
    onSaved={handleSiteRuleSaved}
    onCancel={() => (showSaveRuleDialog = false)}
  />
{/if}
