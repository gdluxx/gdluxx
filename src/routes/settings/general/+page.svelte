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
  import { PageLayout, Toggle } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import type { PageData } from './$types';
  import { clientLogger as logger } from '$lib/client/logger';
  import { toastStore } from '$lib/stores/toast';

  const { data }: { data: PageData } = $props();
  // eslint-disable-next-line prefer-const
  let settings = $state(data.userSettings);
  let isUpdating = $state(false);

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
</script>

<PageLayout title="General Settings" description="Manage general application preferences">
  {#snippet icon()}
    <Icon iconName="general-settings" size={24} />
  {/snippet}

  <div class="space-y-6">
    <div
      class="bg-primary-50 dark:bg-primary-800 border border-primary-600 dark:border-primary-400 rounded-lg p-6"
    >
      <h3 class="text-lg font-medium text-secondary-900 dark:text-secondary-100 mb-4">
        Command Form
      </h3>

      <div class="flex items-start justify-between">
        <div class="flex-1">
          <label
            for="warn-toggle"
            class="font-medium text-secondary-800 dark:text-secondary-200 block"
          >
            Warn on Site Rule Override
          </label>
          <p class="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
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
          />
        </div>
      </div>
    </div>
  </div>
</PageLayout>
