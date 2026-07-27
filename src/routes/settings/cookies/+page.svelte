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
  import { CookiesManager } from '$lib/components/settings';
  import { PageLayout } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import type { CookiesPageData } from '$lib/cookieBackups/types';

  interface PageData extends Partial<CookiesPageData> {
    success: boolean;
    error?: string;
  }

  const { data }: { data: PageData } = $props();
</script>

<PageLayout
  title="Cookies"
  description="View and manage cookies synced from the browser extension for authenticated downloads"
>
  {#snippet icon()}
    <Icon
      iconName="cookies"
      size={32}
      ariaLabel="cookiesIcon"
    />
  {/snippet}
  <CookiesManager initialData={data} />
</PageLayout>
