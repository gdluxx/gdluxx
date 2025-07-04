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
  import { Options } from '$lib/components';
  import type { OptionsData, SelectedOption } from '$lib/types/options';
  import optionsData from '$lib/assets/options.json';
  import { browser } from '$app/environment';
  import { Icon } from '$lib/components';

  const options = optionsData as OptionsData;
  const STORAGE_KEY = 'selectedOptions';

  let selectedOptions = $state<SelectedOption[]>([]);
  let activeModal = $state<string | null>(null);
  const selectedIdsByCategory = $state<Record<string, Set<string>>>({});

  onMount(() => {
    if (browser) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as SelectedOption[];
          selectedOptions = parsed;

          parsed.forEach(option => {
            if (!selectedIdsByCategory[option.category]) {
              selectedIdsByCategory[option.category] = new Set();
            }
            selectedIdsByCategory[option.category].add(option.id);
          });
        } catch (e) {
          console.error('Failed to parse stored options:', e);
        }
      }
    }
  });

  $effect(() => {
    if (browser && selectedOptions) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedOptions));
    }
  });

  function openModal(categoryKey: string) {
    activeModal = categoryKey;
  }

  function closeModal() {
    activeModal = null;
  }

  function handleApplyOptions(categoryKey: string, selected: Set<string>) {
    // Remove all options from category
    selectedOptions = selectedOptions.filter(opt => opt.category !== categoryKey);

    // Add newly selected options
    const category = options[categoryKey];
    const newOptions = category.options
      .filter(opt => selected.has(opt.id))
      .map(opt => ({
        ...opt,
        category: categoryKey,
      }));

    selectedOptions = [...selectedOptions, ...newOptions];
    selectedIdsByCategory[categoryKey] = new Set(selected);
  }

  function removeOption(option: SelectedOption) {
    selectedOptions = selectedOptions.filter(
      opt => !(opt.id === option.id && opt.category === option.category)
    );

    // Update with a new Set to trigger reactivity
    if (selectedIdsByCategory[option.category]) {
      const currentIds = selectedIdsByCategory[option.category];
      const newIds = new Set([...currentIds].filter(id => id !== option.id));

      if (newIds.size === 0) {
        // TODO: Check for better way
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete selectedIdsByCategory[option.category];
      } else {
        selectedIdsByCategory[option.category] = newIds;
      }
    }
  }

  function getCategoryTitle(categoryKey: string): string {
    return options[categoryKey]?.title || categoryKey;
  }
</script>

<svelte:head>
  <title>Editor - gdluxx</title>
</svelte:head>

<div
  class="mx-auto rounded-lg border border-secondary-200 bg-secondary-50 p-6 shadow-md dark:border-secondary-700 dark:bg-secondary-950"
>
  <h1 class="text-3xl font-bold text-secondary-900 dark:text-secondary-100 mb-8">
    Options Configurator
  </h1>

  <!-- Category Buttons -->
  <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
    {#each Object.entries(options) as [categoryKey, category] (categoryKey)}
      <button
        onclick={() => openModal(categoryKey)}
        class="cursor-pointer relative px-4 py-3 bg-white dark:bg-secondary-900 hover:bg-primary-50 dark:hover:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg transition-colors text-left"
      >
        <span class="text-secondary-900 dark:text-secondary-100 font-medium">
          {category.title}
        </span>
        {#if selectedIdsByCategory[categoryKey]?.size}
          <span
            class="absolute -top-2 -right-2 w-6 h-6 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center"
          >
            {selectedIdsByCategory[categoryKey].size}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Selected Options -->
  {#if selectedOptions.length > 0}
    <div
      class="bg-white dark:bg-secondary-900 rounded-lg p-6 shadow-sm border border-secondary-200 dark:border-secondary-700"
    >
      <h2 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
        Selected Options
      </h2>
      <div class="space-y-4">
        {#each Object.entries(selectedIdsByCategory) as [categoryKey, optionIds] (categoryKey)}
          {#if optionIds.size > 0}
            <div>
              <h3 class="text-sm font-medium text-secondary-600 dark:text-secondary-400 mb-2">
                {getCategoryTitle(categoryKey)}
              </h3>
              <div class="flex flex-wrap gap-2">
                {#each selectedOptions.filter(opt => opt.category === categoryKey) as option (option.id)}
                  <button
                    onclick={() => removeOption(option)}
                    class="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors group"
                  >
                    <span class="text-sm">{option.command}</span>
                    <Icon iconName="close" size={12} class="opacity-60 group-hover:opacity-100" />
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div
      class="bg-white dark:bg-secondary-900 rounded-lg p-8 shadow-sm border border-secondary-200 dark:border-secondary-700 text-center"
    >
      <p class="text-secondary-600 dark:text-secondary-400">
        No options selected. Click on a category above to get started.
      </p>
    </div>
  {/if}
</div>

{#each Object.entries(options) as [categoryKey, category] (categoryKey)}
  <Options
    isOpen={activeModal === categoryKey}
    {category}
    selectedIds={selectedIdsByCategory[categoryKey] || new Set()}
    onClose={closeModal}
    onApply={selected => handleApplyOptions(categoryKey, selected)}
  />
{/each}
