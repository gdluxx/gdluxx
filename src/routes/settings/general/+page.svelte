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
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  const { data }: Props = $props();
</script>

<PageLayout title="General Settings" description="Manage general application preferences">
  {#snippet icon()}
    <Icon iconName="general-settings" size={24} />
  {/snippet}

  <GeneralManager userSettings={data.userSettings} />
</PageLayout>
