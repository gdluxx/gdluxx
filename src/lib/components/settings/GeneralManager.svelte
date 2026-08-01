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
  import { Toggle, Spinner } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast';
  import type { UserSettings } from '$lib/server/userSettingsManager';
  import { AVAILABLE_THEMES, type ThemeName } from '$lib/themes/themeUtils';
  import { themeStore } from '$lib/themes/themeStore';
  import { Icon } from '$lib/components';
  import { createSettingsSaver } from '$lib/utils/settings-save.svelte';

  interface Props {
    userSettings: UserSettings;
  }

  const { userSettings }: Props = $props();
  const settings = $state<UserSettings>({
    warnOnSiteRuleOverride: false,
    selectedTheme: 'indigo',
    maxBatchUrls: 200,
  });

  const toggleSaver = createSettingsSaver();
  const maxBatchUrlsSaver = createSettingsSaver();
  const themeSaver = createSettingsSaver();

  const sortedThemes = Object.values(AVAILABLE_THEMES).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  $effect(() => {
    settings.warnOnSiteRuleOverride = userSettings.warnOnSiteRuleOverride;
    settings.selectedTheme = userSettings.selectedTheme;
    settings.maxBatchUrls = userSettings.maxBatchUrls;
  });

  async function handleToggleChange(checked: boolean) {
    const newSetting = checked;
    const oldSetting = settings.warnOnSiteRuleOverride;
    const actionText = newSetting ? 'enabled' : 'disabled';

    await toggleSaver.save({
      endpoint: '/api/settings/user',
      body: { warnOnSiteRuleOverride: newSetting },
      apply: () => {
        settings.warnOnSiteRuleOverride = newSetting;
      },
      rollback: () => {
        settings.warnOnSiteRuleOverride = oldSetting;
      },
      successTitle: 'Settings Updated',
      successMessage: `Site rule override warnings ${actionText}`,
    });
  }

  async function handleMaxBatchUrlsBlur(event: FocusEvent) {
    const input = event.currentTarget as HTMLInputElement;
    const raw = input.value;
    const value = Number(raw);
    const oldValue = settings.maxBatchUrls;

    if (!raw || !Number.isInteger(value) || value < 1 || value > 10000) {
      toastStore.warning(
        'Invalid Value',
        'Must be a whole number between 1 and 10000. Reverting to previous value.',
      );
      settings.maxBatchUrls = oldValue;
      input.value = String(oldValue);
      return;
    }

    if (value === oldValue) {
      return;
    }

    await maxBatchUrlsSaver.save({
      endpoint: '/api/settings/user',
      body: { maxBatchUrls: value },
      apply: () => {
        settings.maxBatchUrls = value;
      },
      rollback: () => {
        settings.maxBatchUrls = oldValue;
        input.value = String(oldValue);
      },
      successTitle: 'Settings Updated',
      successMessage: 'Max batch URLs saved',
    });
  }

  async function handleThemeChange(newTheme: ThemeName) {
    const oldTheme = settings.selectedTheme;
    const themeConfig = AVAILABLE_THEMES[newTheme];

    await themeSaver.save({
      endpoint: '/api/settings/user',
      body: { selectedTheme: newTheme },
      apply: async () => {
        settings.selectedTheme = newTheme;
        await themeStore.setTheme(newTheme);
      },
      rollback: async () => {
        settings.selectedTheme = oldTheme;
        await themeStore.setTheme(oldTheme);
      },
      successTitle: 'Theme Updated',
      successMessage: `Switched to ${themeConfig.displayName} theme`,
      errorTitle: 'Theme Error',
    });
  }
</script>

<div class="space-y-6">
  <p class="text-xs text-muted-foreground">Changes on this page save automatically.</p>

  <!-- CommandForm options -->
  <div class="content-panel">
    <h2 class="">Run</h2>

    <div class="flex items-start justify-between">
      <div class="flex-1">
        <label
          for="warn-toggle"
          class="block font-medium text-foreground"
        >
          Warn on Site Rule Override
        </label>
        <p class="mt-1 text-sm text-muted-foreground">
          Show a confirmation when your manually selected options conflict with an automated site
          rule.
        </p>
      </div>

      <div class="ml-6">
        <Toggle
          id="warn-toggle"
          checked={settings.warnOnSiteRuleOverride}
          disabled={toggleSaver.saving}
          onchange={handleToggleChange}
          variant="primary"
        />
      </div>
    </div>
  </div>

  <!-- Extension option -->
  <div class="content-panel">
    <h2 class="">Extension</h2>

    <div class="flex items-start justify-between gap-6">
      <div class="flex-1">
        <label
          for="max-batch-urls"
          class="block font-medium text-foreground"
        >
          Max Batch URLs
        </label>
        <p class="mt-1 text-sm text-muted-foreground">
          Maximum number of URLs the browser extension can submit in a single request.
        </p>
        <div class="mt-3">
          <input
            id="max-batch-urls"
            type="number"
            min="1"
            max="10000"
            value={settings.maxBatchUrls}
            onblur={handleMaxBatchUrlsBlur}
            disabled={maxBatchUrlsSaver.saving}
            class="form-input form-input-sm w-32"
          />
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          Must be a whole number between 1 and 10000. Default is 200.
        </p>
      </div>
    </div>
  </div>

  <!-- Theme selection -->
  <div class="content-panel">
    <div class="mb-6">
      <h3 id="theme-selection-heading">Theme Selection</h3>
      <p class="text-sm text-muted-foreground">
        Choose a color theme for the application. Your selection will be saved and applied across
        all sessions.
      </p>
    </div>

    <div class="relative {themeSaver.saving ? 'pointer-events-none opacity-50' : ''}">
      <div
        role="radiogroup"
        aria-labelledby="theme-selection-heading"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
      >
        {#each sortedThemes as theme (theme.name)}
          <button
            type="button"
            role="radio"
            aria-checked={settings.selectedTheme === theme.name}
            aria-describedby="theme-{theme.name}-description"
            onclick={() => handleThemeChange(theme.name)}
            disabled={themeSaver.saving}
            class="relative cursor-pointer rounded-sm border-2 p-4 text-left transition-all hover:shadow-md focus:ring-2 focus:ring-primary focus:ring-offset-2 {settings.selectedTheme ===
            theme.name
              ? 'border-primary bg-surface-selected'
              : 'border-border bg-surface-elevated hover:border-primary/35 hover:bg-surface-hover'}"
          >
            {#if settings.selectedTheme === theme.name}
              <div
                class="absolute top-1.5 right-1.5 flex h-7 w-7 cursor-default items-center justify-center rounded-full font-semibold text-primary select-none"
              >
                <Icon
                  iconName="checked"
                  size={20}
                />
              </div>
            {/if}
            <div class="text-sm font-medium text-foreground">{theme.displayName}</div>
            <div
              id="theme-{theme.name}-description"
              class="mt-1 text-xs text-muted-foreground"
            >
              {theme.description}
            </div>
            <div class="mt-2 flex items-center gap-1.5">
              {#each theme.swatch as color, index (index)}
                <span
                  class="h-3 w-3 rounded-full border border-border/50"
                  style:background-color={color}
                ></span>
              {/each}
            </div>
            <span class="sr-only">
              {settings.selectedTheme === theme.name ? 'Currently selected' : 'Not selected'}
            </span>
          </button>
        {/each}
      </div>
      {#if themeSaver.saving}
        <div class="absolute inset-0 flex items-center justify-center bg-surface/50">
          <div
            class="flex items-center gap-2 rounded border bg-surface-elevated px-3 py-2 shadow-md"
          >
            <Spinner
              variant="ring"
              size={16}
              border="full"
              class="border-skeleton border-t-spinner"
            />
            <span class="text-sm text-foreground">Updating theme...</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
