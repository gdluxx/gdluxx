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
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    children: Snippet;
  }

  const { title, description, children }: Props = $props();
</script>

<section class="space-y-3">
  <header>
    <h2 class="text-lg font-semibold text-foreground">{title}</h2>
    {#if description}
      <p class="mt-1 text-sm text-muted-foreground">{description}</p>
    {/if}
  </header>
  <div class="rounded-surface border border-border bg-surface p-4 sm:p-6">
    {@render children()}
  </div>
</section>
