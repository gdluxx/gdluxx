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
  import { PageLayout } from '$lib/components/ui';
  import { AccountManager } from '$lib/components/settings';
  import { Icon } from '$lib/components';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const user = $derived(data.user);
  const sessions = $derived(data.sessions);
</script>

<PageLayout title="Account">
  {#snippet icon()}
    <Icon
      iconName="user"
      size={40}
      ariaLabel="userIcon"
    />
  {/snippet}
  <AccountManager
    {user}
    {sessions}
  />
</PageLayout>
