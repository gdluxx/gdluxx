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
</script>

<PageLayout title="Version Manager" description="Manage your <i>gallery-dl</i> version">
  {#snippet icon()}
    <Icon iconName="version" size={32} ariaLabel="versionIcon" />
  {/snippet}
  <VersionManager />
</PageLayout>
