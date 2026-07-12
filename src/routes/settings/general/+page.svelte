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
  import { GeneralManager } from '$lib/components/settings';
  import { Icon } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
  import type { UserSettings } from '$lib/server/userSettingsManager';

  interface GeneralPageData {
    warnOnSiteRuleOverride?: boolean;
    selectedTheme?: UserSettings['selectedTheme'];
    maxBatchUrls?: number;
  }

  interface Props {
    data: GeneralPageData;
  }

  const { data }: Props = $props();

  const userSettings: UserSettings = $derived({
    warnOnSiteRuleOverride: data.warnOnSiteRuleOverride ?? false,
    selectedTheme: data.selectedTheme ?? 'indigo',
    maxBatchUrls: data.maxBatchUrls ?? 200,
  });
</script>

<PageLayout title="General">
  {#snippet icon()}
    <Icon
      iconName="general-settings"
      size={24}
    />
  {/snippet}

  <GeneralManager {userSettings} />
</PageLayout>
