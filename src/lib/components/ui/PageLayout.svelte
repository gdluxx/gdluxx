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
  import { Icon } from '$lib/components';

  interface Props {
    title: string;
    description?: string;
    icon?: Snippet;
    children: Snippet;
    ariaLabel?: string;
  }

  const { title, description, icon, children, ariaLabel }: Props = $props();
</script>

<svelte:head>
  <title>{title} - gdluxx</title>
  {#if description}
    <meta
      name="description"
      content={description}
    />
  {/if}
</svelte:head>

<section
  class="space-y-6 sm:space-y-8"
  aria-labelledby="page-title"
  aria-describedby={description ? 'page-description' : undefined}
  {...ariaLabel && { 'aria-label': ariaLabel }}
>
  <header>
    <div class="flex items-center gap-2">
      <div
        class="h-6 w-6 flex-shrink-0 text-primary [&_svg]:h-full [&_svg]:w-full"
        aria-hidden="true"
      >
        {#if icon}
          {@render icon()}
        {:else}
          <Icon
            iconName="circle"
            size={16}
          />
        {/if}
      </div>
      <h1
        id="page-title"
        class="cursor-default text-2xl font-bold text-primary"
      >
        {title}
      </h1>
    </div>
    {#if description}
      <p
        id="page-description"
        class="mt-1 cursor-default text-sm text-muted-foreground"
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html description}
      </p>
    {/if}
  </header>

  <div
    aria-labelledby="page-title"
    class="px-2 sm:px-0"
  >
    {@render children()}
  </div>
</section>
