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
  import { LogSettings } from '$lib/components/settings';
  import { Icon } from '$lib/components';
  import { PageLayout, Info } from '$lib/components/ui';
  import { loggingStore } from './lib';
</script>

<PageLayout title="Debug Manager" description="Manage your log settings">
  {#snippet icon()}
    <Icon iconName="log" size={32} ariaLabel="logIcon" />
  {/snippet}

  {#if loggingStore.error}
    <Info variant="danger" title="Error" class="mb-4">
      {loggingStore.error}
    </Info>
  {/if}

  <LogSettings />
</PageLayout>
