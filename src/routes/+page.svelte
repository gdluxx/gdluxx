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
  import { CommandForm } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import { RecentJobs } from '$lib/components/jobs';
</script>

<svelte:head>
  <title>gdluxx</title>
</svelte:head>

<PageLayout
  title="Run"
  description="Download media from one or more URLs"
>
  {#snippet icon()}
    <Icon iconName="run" />
  {/snippet}
  <div class="space-y-6">
    <CommandForm />
    <RecentJobs />
  </div>
</PageLayout>
