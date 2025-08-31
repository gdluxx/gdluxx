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
  import { ApiKeyManager } from '$lib/components/settings';
  import { PageLayout } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import type { ApiKey } from './lib';

  interface PageData {
    success: boolean;
    apiKeys?: ApiKey[];
    error?: string;
  }

  const { data }: { data: PageData } = $props();
</script>

<PageLayout
  title="Key Manager"
  description="Manage your API keys"
>
  {#snippet icon()}
    <Icon
      iconName="key"
      size={32}
      ariaLabel="keyIcon"
    />
  {/snippet}
  <ApiKeyManager initialData={data} />
</PageLayout>
