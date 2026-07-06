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
  import { ExtensionProfilesManager } from '$lib/components/settings';
  import { PageLayout } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import type { ExtensionProfilesPageData } from '$lib/extensionProfiles/types';

  interface PageData extends Partial<ExtensionProfilesPageData> {
    success: boolean;
    error?: string;
  }

  const { data }: { data: PageData } = $props();
</script>

<PageLayout
  title="Extension Profiles"
  description="View and manage extraction profile backups synced from the browser extension"
>
  {#snippet icon()}
    <Icon
      iconName="extract"
      size={32}
      ariaLabel="extensionProfilesIcon"
    />
  {/snippet}
  <ExtensionProfilesManager initialData={data} />
</PageLayout>
