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
  import { VersionManager } from '$lib/components/settings';
  import { Icon } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
  import type { SourceInfo } from '$lib/server/version/versionManager';

  interface PageData {
    success: boolean;
    current?: string | null;
    latestAvailable?: string | null;
    lastChecked?: number | null;
    source?: SourceInfo | null;
    binaryExists?: boolean;
    error?: string;
  }

  const { data }: { data: PageData } = $props();
</script>

<PageLayout
  title="Version"
  description="Check for and install gallery-dl updates"
>
  {#snippet icon()}
    <Icon
      iconName="version"
      size={32}
      ariaLabel="versionIcon"
    />
  {/snippet}
  <VersionManager {data} />
</PageLayout>
