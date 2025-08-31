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
  import { Button, Chip, Toggle, Tooltip } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import optionsData from '$lib/assets/options.json';
  import type { Option, OptionsData } from '$lib/types/options';
  import type { SiteConfig } from '$lib/server/siteConfigManager';

  const typedOptionsData = optionsData as OptionsData;

  interface Props {
    config?: SiteConfig | null;
    supportedSites?: Array<{ name: string; url: string }>;
    onSave: (config: Partial<SiteConfig>) => Promise<void>;
    onCancel: () => void;
  }

  const { config = null, supportedSites = [], onSave, onCancel }: Props = $props();

  const formData = $state({
    site_pattern: config?.site_pattern ?? '',
    display_name: config?.display_name ?? '',
    cli_options: new Map(config?.cli_options ?? []),
    is_default: config?.is_default ?? false,
    enabled: config?.enabled !== false,
  });

  let isSubmitting = $state(false);
  let errors = $state<Record<string, string>>({});

  // Watch for site selection from dropdown
  $effect(() => {
    const site = supportedSites.find((s) => s.url === formData.site_pattern);
    if (site) {
      try {
        const url = new URL(site.url);
        if (formData.site_pattern !== url.hostname) {
          formData.site_pattern = url.hostname;
        }
        formData.display_name = site.name;
      } catch {
        formData.display_name = site.name;
      }
    }
  });

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
        cli_options: Array.from(formData.cli_options.entries()),
        is_default: formData.is_default,
        enabled: formData.enabled,
      });
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form
  onsubmit={handleSubmit}
  class="space-y-6"
>
  <div>
    <label
      for="site_pattern"
      class="mb-2 block text-sm font-medium text-foreground"
    >
      Site Pattern
    </label>
    <input
      list="supportedSites"
      id="site_pattern"
      name="site_pattern"
      bind:value={formData.site_pattern}
      placeholder="Type site name, or enter pattern like *.youtube.com, twitter.com, or *"
      class="form-input"
      class:border-error={errors.site_pattern}
      class:bg-input-invalid={errors.site_pattern}
      autocomplete="off"
    />
    <datalist id="supportedSites">
      {#each supportedSites as site (site.url)}
        <option value={site.url}>{site.name} - {site.url}</option>
      {/each}
    </datalist>
    {#if errors.site_pattern}
      <p class="mt-1 text-sm text-error">{errors.site_pattern}</p>
    {/if}

    <div class="mt-2 mr-1.5 flex justify-end">
      <Tooltip
        placement="left"
        maxWidth="32rem"
        class="!min-w-80 bg-surface-elevated !whitespace-normal"
      >
        {#snippet tooltipContent()}
          <div class="space-y-2">
            <div class="text-sm opacity-90">
              <p class="mt-1 cursor-default text-sm text-muted-foreground">
                Select from <b class="text-primary">{supportedSites.length}</b> supported sites or
                enter custom pattern
                <br />- * for all sites
                <br />- *.domain.com
              </p>
            </div>
          </div>
        {/snippet}
        <Icon
          iconName="question"
          size={20}
          class="text-primary"
        />
      </Tooltip>
    </div>
  </div>

  <div>
    <label
      for="display_name"
      class="mb-2 block text-sm font-medium text-foreground"
    >
      Display Name
    </label>
    <input
      id="display_name"
      type="text"
      bind:value={formData.display_name}
      placeholder="YouTube, Twitter, etc."
      class="form-input {errors.display_name ? 'border-red-300 dark:border-red-700' : ''}"
    />
    {#if errors.display_name}
      <p class="mt-1 text-sm text-error">{errors.display_name}</p>
    {/if}
  </div>

  <!-- Enable rule -->
  <div class="space-y-4">
    <label
      for="enabled"
      class="cursor-pointer"
    >
      <div class="flex items-center justify-between rounded-sm bg-primary/25 p-3">
        <span class="font-medium text-foreground">
          Rule {formData.enabled ? 'Enabled' : 'Disabled'}
        </span>
        <div class="relative ml-4 inline-block h-4 w-[26px]">
          <Toggle
            id="enabled"
            bind:checked={formData.enabled}
            size="sm"
            variant="primary"
          />
        </div>
      </div>
    </label>
  </div>

  <!-- CLI Options Selection -->
  <div>
    <h3 class="mb-4 cursor-default text-lg font-medium text-foreground">CLI Options</h3>
    <div class="max-h-96 overflow-y-auto rounded border bg-surface p-4">
      {#each Object.entries(typedOptionsData) as [_categoryKey, category] (_categoryKey)}
        <details class="mb-4">
          <summary class="cursor-pointer font-medium text-foreground hover:text-primary">
            {category.title}
          </summary>
          <div class="mt-2 space-y-2">
            {#each category.options as option (option.id)}
              <div class="flex items-start gap-2 rounded bg-surface-elevated p-2">
                <!-- slider -->
                <div class="relative inline-block h-4 w-[26px]">
                  <Toggle
                    id="option-{option.id}"
                    checked={formData.cli_options.has(option.id)}
                    onchange={() => toggleOption(option)}
                    variant="primary"
                    size="sm"
                  />
                </div>

                <!-- Label and description -->
                <div class="flex-1">
                  <label
                    for="option-{option.id}"
                    class="cursor-pointer font-medium text-foreground"
                  >
                    {option.command}
                  </label>
                  <p class="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>

                <!-- Input fields -->
                <div class="w-48 flex-shrink-0 text-right">
                  <!-- Option value input for non-boolean options -->
                  {#if formData.cli_options.has(option.id) && option.type !== 'boolean'}
                    {#if option.type === 'string'}
                      <input
                        type="text"
                        value={formData.cli_options.get(option.id) ?? ''}
                        oninput={(e) => handleOptionInputChange(e, option.id, 'string')}
                        placeholder="Enter value..."
                        class="form-input w-full px-2 py-1 text-sm"
                      />
                    {:else if option.type === 'number'}
                      <input
                        type="number"
                        value={formData.cli_options.get(option.id) ?? ''}
                        oninput={(e) => handleOptionInputChange(e, option.id, 'number')}
                        placeholder="Enter number..."
                        class="form-input w-full px-2 py-1 text-sm"
                      />
                    {:else if option.type === 'range'}
                      <input
                        type="text"
                        value={formData.cli_options.get(option.id) ?? ''}
                        oninput={(e) => handleOptionInputChange(e, option.id, 'string')}
                        placeholder={option.placeholder}
                        class="form-input w-full px-2 py-1 text-sm"
                      />
                    {/if}
                  {/if}

                  <!-- Show value for boolean options when enabled -->
                  {#if formData.cli_options.has(option.id) && option.type === 'boolean'}
                    <Chip
                      label="Enabled"
                      dismissible={false}
                      size="sm"
                      variant="outline-primary"
                    />
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </details>
      {/each}
    </div>
  </div>

  <div class="flex justify-end gap-4">
    <Button
      type="submit"
      disabled={isSubmitting}
      variant="primary"
      size="sm"
    >
      {#if isSubmitting}
        <Icon
          iconName="loading"
          size={16}
          class="mr-2 animate-spin"
        />
        Saving...
      {:else}
        Save Rule
      {/if}
    </Button>
    <Button
      type="button"
      onclick={onCancel}
      variant="outline-primary"
      size="sm">Cancel</Button
    >
  </div>
</form>
