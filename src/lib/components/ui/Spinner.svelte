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
  import { Icon } from '$lib/components/index';

  type SpinnerVariant = 'icon' | 'ring';
  type RingBorder = 'full' | 'bottom';

  interface Props {
    size?: number;
    variant?: SpinnerVariant;
    border?: RingBorder;
    class?: string;
    decorative?: boolean;
    label?: string;
  }

  const {
    size = 16,
    variant = 'icon',
    border = 'full',
    class: className = '',
    decorative = true,
    label = 'Loading',
  }: Props = $props();
</script>

{#if variant === 'icon'}
  <span
    class="inline-flex"
    role={decorative ? undefined : 'status'}
    aria-hidden={decorative ? 'true' : undefined}
    aria-label={decorative ? undefined : label}
  >
    <Icon
      iconName="loading"
      {size}
      class={`animate-spin ${className}`}
    />
  </span>
{:else}
  <div
    style:width="{size}px"
    style:height="{size}px"
    class={`animate-spin rounded-full ${border === 'full' ? 'border-2' : 'border-b-2'} ${className}`}
    role={decorative ? undefined : 'status'}
    aria-hidden={decorative ? 'true' : undefined}
    aria-label={decorative ? undefined : label}
  ></div>
{/if}
