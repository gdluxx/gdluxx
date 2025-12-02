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
  import type { IconName } from '#utils/icons';
  import { iconMap } from '#utils/icons';

  interface IconProps {
    iconName: IconName;
    size?: number;
    color?: string;
    ariaLabel?: string;
    class?: string;
  }

  const {
    iconName,
    size = 24,
    color = 'currentColor',
    ariaLabel,
    class: className,
  }: IconProps = $props();

  const iconData = $derived.by(() => {
    const resolvedIcon = iconMap[iconName];
    const envAny = import.meta as unknown as { env?: { DEV?: boolean } };
    if (!resolvedIcon && envAny.env?.DEV) {
      console.error(`[Icon] Unknown icon name: "${iconName}"`);
      return iconMap['question']; // Fallback icon
    }
    return resolvedIcon;
  });
</script>

{#if iconData}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox={`0 0 ${iconData.width} ${iconData.height}`}
    role="img"
    aria-label={ariaLabel ?? `${iconName} icon`}
    class={`icon icon-${iconName} ${className ?? ''}`}
    style={`color: ${color}; fill: ${color}; width: ${size}px; height: ${size}px; min-width: ${size}px; min-height: ${size}px;`}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html iconData.body}
  </svg>
{/if}

<style>
  .icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
