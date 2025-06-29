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
  interface IconProps {
    class?: string;
    size?: number;
  }

  const { class: className = 'w-8 h-8', size = 20 }: IconProps = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 48 48"
  width={size}
  height={size}
  class={className}
>
  <g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="4">
    <path d="M13 10h28v34H13z" />
    <path stroke-linecap="round" d="M35 10V4H8a1 1 0 0 0-1 1v33h6m8-16h12m-12 8h12" />
  </g>
</svg>
