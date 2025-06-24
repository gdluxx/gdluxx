<script lang="ts">
  import { onMount } from 'svelte';
  import { Options } from '$lib/components/settings';
  import type { OptionsData, SelectedOption } from '$lib/types/options';
  import optionsData from '$lib/assets/options.json';
  import { browser } from '$app/environment';

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

  // Save to localStorage to persist
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
    // Remove all options from this category
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

    // Update selectedIdsByCategory with a new Set to trigger reactivity
    if (selectedIdsByCategory[option.category]) {
      const currentIds = selectedIdsByCategory[option.category];
      const newIds = new Set([...currentIds].filter(id => id !== option.id));

      if (newIds.size === 0) {
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
  <title>Gallery-dl Options - gdluxx</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
      Gallery-dl Options
    </h1>
    <p class="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
      Configure command-line options for gallery-dl downloads
    </p>
  </div>

  <div
    class="rounded-lg border border-secondary-200 bg-white p-6 shadow-sm dark:border-secondary-700 dark:bg-secondary-900"
  >
    <!-- Category Buttons -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
      {#each Object.entries(options) as [categoryKey, category] (categoryKey)}
        <button
          onclick={() => openModal(categoryKey)}
          class="relative px-4 py-3 bg-secondary-50 dark:bg-secondary-800 hover:bg-primary-50 dark:hover:bg-secondary-700 border border-secondary-200 dark:border-secondary-600 rounded-lg transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary-500"
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
      <div class="space-y-4">
        <h2 class="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
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
                      title="Click to remove: {option.description}"
                    >
                      <span class="text-sm font-mono">{option.command}</span>
                      <svg
                        class="w-4 h-4 opacity-60 group-hover:opacity-100"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {:else}
      <div class="text-center py-8">
        <div class="text-secondary-400 dark:text-secondary-500 mb-2">
          <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <p class="text-secondary-600 dark:text-secondary-400">
          No options selected. Click on a category above to get started.
        </p>
      </div>
    {/if}
  </div>
</div>

<!-- Option Category Modals -->
{#each Object.entries(options) as [categoryKey, category] (categoryKey)}
  <Options
    isOpen={activeModal === categoryKey}
    {category}
    selectedIds={selectedIdsByCategory[categoryKey] || new Set()}
    onClose={closeModal}
    onApply={selected => handleApplyOptions(categoryKey, selected)}
  />
{/each}
