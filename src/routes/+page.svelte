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
  import { RunIcon } from '$lib/components/icons';
</script>

<svelte:head>
  <title>gdluxx</title>
</svelte:head>

<PageLayout title="Run" description="Retrieve your URLs">
  {#snippet icon()}
    <RunIcon />
  {/snippet}
  <CommandForm />
</PageLayout>
