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
  export let x: number;
  export let y: number;
  export let visible: boolean;
  export let text: string;
</script>

{#if visible}
  <div 
    class="fixed bg-text-primary text-inverse px-2.5 py-1.5 rounded text-sm pointer-events-none -translate-x-1/2 -translate-y-full whitespace-nowrap z-50 opacity-90" 
    style:top="{y}px" 
    style:left="{x}px"
  >
    {text}
  </div>
{/if}
