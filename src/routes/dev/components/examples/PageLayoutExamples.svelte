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
  import { Icon } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
</script>

<div class="rounded-surface border border-dashed border-border-strong bg-surface p-4 sm:p-6">
  <PageLayout
    title="Example Page"
    description="PageLayout coordinates document metadata, an accessible page heading, an optional icon, and page content."
    ariaLabel="PageLayout component example"
  >
    {#snippet icon()}
      <Icon
        iconName="ui"
        size={24}
      />
    {/snippet}

    <div class="rounded-surface border border-border bg-surface-elevated p-5 text-foreground">
      This content is rendered through the PageLayout children snippet.
    </div>
  </PageLayout>
</div>
