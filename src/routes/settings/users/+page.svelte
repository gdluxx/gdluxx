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
  import { UserManager } from '$lib/components/settings';
  import { Icon } from '$lib/components';

  const { data } = $props();

  const user = $derived(data.user);
</script>

<PageLayout
  title="User Manager"
  description="Manage user accounts"
>
  {#snippet icon()}
    <Icon
      iconName="user"
      size={40}
      ariaLabel="userIcon"
    />
  {/snippet}
  <UserManager {user} />
</PageLayout>
