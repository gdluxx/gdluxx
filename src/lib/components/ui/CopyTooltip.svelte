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
  interface Props {
    x: number;
    y: number;
    visible: boolean;
    text: string;
  }

  const { x, y, visible, text }: Props = $props();
</script>

{#if visible}
  <div
    class="bg-surface-elevated text-primary border border-primary/75 shadow-md pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded px-2.5 py-1.5 text-sm whitespace-nowrap"
    style:top="{y}px"
    style:left="{x}px"
  >
    {text}
  </div>
{/if}
