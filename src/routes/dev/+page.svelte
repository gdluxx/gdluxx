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
  import { resolve } from '$app/paths';
  import { Icon } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
</script>

<PageLayout
  title="Developer Tools"
  description="Internal tools for inspecting and exercising gdluxx during development."
>
  {#snippet icon()}
    <Icon
      iconName="ui"
      size={24}
    />
  {/snippet}

  <div class="grid gap-4 sm:grid-cols-2">
    <a
      href={resolve('/dev/components')}
      class="group rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-surface-hover focus:border-focus focus:ring-2 focus:ring-focus focus:outline-hidden"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-primary">Component Gallery</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Review variants, sizes, states, and interactions for shared UI components.
          </p>
        </div>
        <Icon
          iconName="chevron-right"
          size={20}
          class="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </div>
    </a>
  </div>
</PageLayout>
