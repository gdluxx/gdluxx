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
    description: string;
    icon?: Snippet;
    children: Snippet;
    ariaLabel?: string;
  }

  const { title, description, icon, children, ariaLabel }: Props = $props();
</script>

<svelte:head>
  <title>{title} - gdluxx</title>
  <meta name="description" content={description} />
</svelte:head>

<section
  class="space-y-6 sm:space-y-8"
  aria-labelledby="page-title"
  aria-describedby="page-description"
  {...ariaLabel && { 'aria-label': ariaLabel }}
>
  <header class="text-center">
    <div class="flex items-center justify-center mb-3 sm:mb-4">
      {#if icon}
        <div
          class="h-6 w-6 sm:h-8 sm:w-8 text-primary-600 dark:text-primary-100 mr-2 sm:mr-3"
          aria-hidden="true"
        >
          {@render icon()}
        </div>
      {:else}
        <div
          class="h-6 w-6 sm:h-8 sm:w-8 text-primary-600 dark:text-primary-100 mr-2 sm:mr-3"
          aria-hidden="true"
        >
          <Icon iconName="circle" size={16} />
        </div>
      {/if}

      <h1
        id="page-title"
        class="cursor-default text-xl sm:text-2xl lg:text-3xl font-bold text-secondary-900 dark:text-secondary-100"
      >
        {title}
      </h1>
    </div>

    <p
      id="page-description"
      class="cursor-default text-sm sm:text-base text-secondary-600 dark:text-secondary-400 max-w-2xl mx-auto px-4 sm:px-0"
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html description}
    </p>
  </header>

  <div aria-labelledby="page-title" class="px-2 sm:px-0">
    {@render children()}
  </div>
</section>
