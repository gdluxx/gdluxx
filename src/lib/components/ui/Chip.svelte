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
  import { createEventDispatcher } from 'svelte';
  import { Icon } from '$lib/components';

  interface Props {
    label: string;
    value?: string | number | boolean;
  }

  const { label, value }: Props = $props();
  const dispatch = createEventDispatcher<{ remove: object }>();

  function handleRemove() {
    dispatch('remove');
  }
</script>

<button
  onclick={handleRemove}
  class="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1.5 text-primary-800 transition-colors group dark:bg-primary-900 dark:text-primary-200 hover:bg-primary-200 dark:hover:bg-primary-800"
>
  <span class="text-sm font-medium">{label}</span>
  {#if value && typeof value !== 'boolean'}
    <span class="text-sm text-primary-600 dark:text-primary-400">{value}</span>
  {/if}
  <Icon iconName="close" size={12} class="opacity-60 group-hover:opacity-100" />
</button>
