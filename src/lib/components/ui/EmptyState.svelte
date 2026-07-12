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
  import type { IconName } from '$lib/types/icons';
  import { Icon } from '$lib/components/index';

  interface Props {
    icon?: IconName;
    iconSize?: number;
    title: string;
    description?: string;
    class?: string;
    children?: Snippet;
  }

  const {
    icon,
    iconSize = 48,
    title,
    description,
    class: className = '',
    children,
  }: Props = $props();
</script>

<div class={`cursor-default text-center text-foreground ${className}`}>
  {#if icon}
    <Icon
      iconName={icon}
      size={iconSize}
      class="mx-auto mb-4 text-accent-foreground"
    />
  {/if}
  <p class="text-lg font-medium">{title}</p>
  {#if description}
    <p class="text-sm">{description}</p>
  {/if}
  {@render children?.()}
</div>
