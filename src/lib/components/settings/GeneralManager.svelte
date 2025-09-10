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
  import { Toggle } from '$lib/components/ui';
  import { clientLogger as logger } from '$lib/client/logger';
  import { toastStore } from '$lib/stores/toast';
  import type { UserSettings } from '$lib/server/userSettingsManager';
  import { AVAILABLE_THEMES, type ThemeName } from '$lib/themes/themeUtils';
  import { themeStore } from '$lib/themes/themeStore';
  import { Icon } from '$lib/components';

  interface Props {
    userSettings: UserSettings;
  }

  // eslint-disable-next-line prefer-const
  let { userSettings }: Props = $props();
  // eslint-disable-next-line prefer-const
  let settings = $state(userSettings);
  let isUpdating = $state(false);

  let isUpdatingTheme = $state(false);

  const sortedThemes = Object.values(AVAILABLE_THEMES).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  async function handleToggleChange(checked: boolean) {
    const newSetting = checked;
    const oldSetting = settings.warnOnSiteRuleOverride;

    settings.warnOnSiteRuleOverride = newSetting;
    isUpdating = true;

    try {
      const response = await fetch('/api/settings/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warnOnSiteRuleOverride: newSetting }),
      });

      if (response.ok) {
        const actionText = newSetting ? 'enabled' : 'disabled';
        toastStore.success('Settings Updated', `Site rule override warnings ${actionText}`);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      logger.error('Failed to save settings:', error);
      toastStore.error('Settings Error', 'Failed to save settings. Please try again.');
      settings.warnOnSiteRuleOverride = oldSetting;
    } finally {
      isUpdating = false;
    }
  }

  async function handleThemeChange(newTheme: ThemeName) {
    const oldTheme = settings.selectedTheme;

    settings.selectedTheme = newTheme;
    isUpdatingTheme = true;

    try {
      await themeStore.setTheme(newTheme);

      const response = await fetch('/api/settings/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTheme: newTheme }),
      });

      if (response.ok) {
        const themeConfig = AVAILABLE_THEMES[newTheme];
        toastStore.success('Theme Updated', `Switched to ${themeConfig.displayName} theme`);
      } else {
        throw new Error('Failed to save theme setting');
      }
    } catch (error) {
      logger.error('Failed to save theme setting:', error);
      toastStore.error('Theme Error', 'Failed to save theme setting. Please try again.');
      settings.selectedTheme = oldTheme;
      await themeStore.setTheme(oldTheme);
    } finally {
      isUpdatingTheme = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- CommandForm options -->
  <div class="content-panel">
    <h2 class="">Command Form</h2>

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
          disabled={isUpdating}
          onchange={handleToggleChange}
          variant="primary"
        />
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

    <div class="relative {isUpdatingTheme ? 'pointer-events-none opacity-50' : ''}">
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
            disabled={isUpdatingTheme}
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
            <span class="sr-only">
              {settings.selectedTheme === theme.name ? 'Currently selected' : 'Not selected'}
            </span>
          </button>
        {/each}
      </div>
      {#if isUpdatingTheme}
        <div class="absolute inset-0 flex items-center justify-center bg-surface/50">
          <div
            class="flex items-center gap-2 rounded border bg-surface-elevated px-3 py-2 shadow-md"
          >
            <div
              class="h-4 w-4 animate-spin rounded-full border-2 border-skeleton border-t-spinner"
            ></div>
            <span class="text-sm text-foreground">Updating theme...</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
