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
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import optionsData from '$lib/assets/options.json';
  import type { Option, OptionsData } from '$lib/types/options';
  import type { SiteConfig } from '$lib/server/siteConfigManager';

  const typedOptionsData = optionsData as OptionsData;

  interface Props {
    config?: SiteConfig | null;
    supportedSites?: Array<{ name: string; url_pattern: string }>;
    onSave: (config: Partial<SiteConfig>) => Promise<void>;
    onCancel: () => void;
  }

  const { config = null, supportedSites = [], onSave, onCancel }: Props = $props();

  const formData = $state({
    site_pattern: config?.site_pattern ?? '',
    display_name: config?.display_name ?? '',
    priority: config?.priority ?? 100,
    cli_options: new Map(config?.cli_options ?? []),
    is_default: config?.is_default ?? false,
    enabled: config?.enabled !== false,
  });

  let selectedSiteFromList = $state('');
  let isSubmitting = $state(false);
  let errors = $state<Record<string, string>>({});

  // Watch for site selection from dropdown
  $effect(() => {
    if (selectedSiteFromList) {
      const site = supportedSites.find(s => s.url_pattern === selectedSiteFromList);
      if (site) {
        formData.site_pattern = site.url_pattern;
        formData.display_name = site.name;
        formData.priority = calculatePriorityFromPattern(site.url_pattern);
      }
    }
  });

  function calculatePriorityFromPattern(pattern: string): number {
    if (pattern === '*') {
      return 1000;
    } // All sites - lowest priority
    if (pattern.startsWith('*.')) {
      return 500;
    } // Wildcard domains
    return 100; // Exact matches - highest priority
  }

  function toggleOption(option: Option) {
    if (formData.cli_options.has(option.id)) {
      formData.cli_options.delete(option.id);
    } else {
      // For boolean options, when checked, we want them to be true (enabled)
      // For non-boolean options, use their default value
      const value = option.type === 'boolean' ? true : (option.defaultValue ?? true);
      formData.cli_options.set(option.id, value);
    }
    formData.cli_options = new Map(formData.cli_options);
  }

  function updateOptionValue(optionId: string, value: string | number | boolean) {
    formData.cli_options.set(optionId, value);
    formData.cli_options = new Map(formData.cli_options);
  }

  function handleOptionInputChange(event: Event, optionId: string, type: 'string' | 'number') {
    const target = event.target as HTMLInputElement;
    const value = type === 'number' ? Number(target.value) : target.value;
    updateOptionValue(optionId, value);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errors = {};

    // Validation
    if (!formData.site_pattern.trim()) {
      errors.site_pattern = 'Site pattern is required';
    }
    if (!formData.display_name.trim()) {
      errors.display_name = 'Display name is required';
    }

    if (Object.keys(errors).length > 0) {
      return;
    }

    isSubmitting = true;
    try {
      await onSave({
        site_pattern: formData.site_pattern,
        display_name: formData.display_name,
        priority: formData.priority,
        cli_options: Array.from(formData.cli_options.entries()),
        is_default: formData.is_default,
        enabled: formData.enabled,
      });
    } finally {
      isSubmitting = false;
    }
  }

  const inputClasses =
    'w-full px-3 py-2 border border-secondary-300 bg-secondary-100 dark:bg-secondary-900 text-secondary-900 dark:text-secondary-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-secondary-400';
</script>

<form onsubmit={handleSubmit} class="space-y-6">
  <!-- Site Selection -->
  <div>
    <label
      for="siteSelect"
      class="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2"
    >
      Select Supported Site
    </label>
    <select id="siteSelect" bind:value={selectedSiteFromList} class={inputClasses}>
      <option value="">Choose from supported sites...</option>
      {#each supportedSites as site}
        <option value={site.url_pattern}>{site.name} ({site.url_pattern})</option>
      {/each}
    </select>
  </div>

  <!-- Manual Pattern Entry -->
  <div>
    <label
      for="site_pattern"
      class="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2"
    >
      Site Pattern
    </label>
    <input
      id="site_pattern"
      type="text"
      bind:value={formData.site_pattern}
      placeholder="*.youtube.com or twitter.com or *"
      class="{inputClasses} {errors.site_pattern ? 'border-red-500' : ''}"
      required
    />
    {#if errors.site_pattern}
      <p class="text-red-500 text-sm mt-1">{errors.site_pattern}</p>
    {/if}
    <p class="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
      Use * for all sites, *.domain.com for subdomains, or exact domain
    </p>
  </div>

  <div>
    <label
      for="display_name"
      class="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2"
    >
      Display Name
    </label>
    <input
      id="display_name"
      type="text"
      bind:value={formData.display_name}
      placeholder="YouTube, Twitter, etc."
      class="{inputClasses} {errors.display_name ? 'border-red-500' : ''}"
      required
    />
    {#if errors.display_name}
      <p class="text-red-500 text-sm mt-1">{errors.display_name}</p>
    {/if}
  </div>

  <div>
    <label
      for="priority"
      class="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2"
    >
      Priority
    </label>
    <input
      id="priority"
      type="number"
      bind:value={formData.priority}
      min="1"
      max="1000"
      class={inputClasses}
    />
    <p class="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
      Higher numbers = higher priority. 1000 = all sites, 500 = wildcards, 100 = exact matches
    </p>
  </div>

  <!-- Configuration Settings -->
  <div class="space-y-4">
    <h3 class="text-lg font-medium text-secondary-900 dark:text-secondary-100">
      Configuration Settings
    </h3>

    <!-- Enabled Toggle -->
    <div
      class="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-800 rounded-lg"
    >
      <div>
        <label for="enabled" class="font-medium text-secondary-900 dark:text-secondary-100">
          Configuration Enabled
        </label>
        <p class="text-sm text-secondary-600 dark:text-secondary-400">
          When disabled, this configuration will be completely ignored (but not deleted)
        </p>
      </div>
      <input
        id="enabled"
        type="checkbox"
        bind:checked={formData.enabled}
        class="w-4 h-4 text-primary-600 bg-secondary-100 border-secondary-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-secondary-800 focus:ring-2 dark:bg-secondary-700 dark:border-secondary-600"
      />
    </div>
  </div>

  <!-- CLI Options Selection -->
  <div>
    <h3 class="text-lg font-medium text-secondary-900 dark:text-secondary-100 mb-4">CLI Options</h3>
    <div
      class="max-h-96 overflow-y-auto border border-secondary-300 dark:border-secondary-400 rounded p-4 bg-secondary-50 dark:bg-secondary-800"
    >
      {#each Object.entries(typedOptionsData) as [categoryKey, category]}
        <details class="mb-4">
          <summary
            class="font-medium cursor-pointer text-secondary-800 dark:text-secondary-200 hover:text-primary-600 dark:hover:text-primary-400"
          >
            {category.title}
          </summary>
          <div class="mt-2 space-y-2">
            {#each category.options as option}
              <div class="flex items-start gap-2 p-2 bg-white dark:bg-secondary-700 rounded">
                <input
                  type="checkbox"
                  id="option-{option.id}"
                  checked={formData.cli_options.has(option.id)}
                  onchange={() => toggleOption(option)}
                  class="mt-1"
                />
                <div class="flex-1">
                  <label
                    for="option-{option.id}"
                    class="font-medium text-secondary-900 dark:text-secondary-100 cursor-pointer"
                  >
                    {option.command}
                  </label>
                  <p class="text-sm text-secondary-600 dark:text-secondary-400">
                    {option.description}
                  </p>

                  <!-- Option value input for non-boolean options -->
                  {#if formData.cli_options.has(option.id) && option.type !== 'boolean'}
                    <div class="mt-2">
                      {#if option.type === 'string'}
                        <input
                          type="text"
                          value={formData.cli_options.get(option.id) || ''}
                          oninput={e => handleOptionInputChange(e, option.id, 'string')}
                          placeholder="Enter value..."
                          class="{inputClasses} px-2 py-1 text-sm"
                        />
                      {:else if option.type === 'number'}
                        <input
                          type="number"
                          value={formData.cli_options.get(option.id) || ''}
                          oninput={e => handleOptionInputChange(e, option.id, 'number')}
                          placeholder="Enter number..."
                          class="{inputClasses} px-2 py-1 text-sm"
                        />
                      {/if}
                    </div>
                  {/if}

                  <!-- Show value for boolean options when enabled -->
                  {#if formData.cli_options.has(option.id) && option.type === 'boolean'}
                    <div class="mt-2">
                      <span
                        class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                      >
                        ✓ Enabled ({formData.cli_options.get(option.id) ? 'true' : 'false'})
                      </span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </details>
      {/each}
    </div>
  </div>

  <div class="flex gap-4 pt-4">
    <Button type="submit" disabled={isSubmitting} variant="primary">
      {#if isSubmitting}
        <Icon iconName="loading" size={16} class="animate-spin mr-2" />
        Saving...
      {:else}
        Save Configuration
      {/if}
    </Button>
    <Button type="button" onclick={onCancel}>Cancel</Button>
  </div>
</form>
