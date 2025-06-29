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

  const { class: className = 'w-5 h-5', size = 20 }: IconProps = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 48 48"
  class={className}
>
  <g fill="none">
    <path
      stroke="currentColor"
      stroke-linejoin="round"
      stroke-width="4"
      d="M24 44a19.94 19.94 0 0 0 14.142-5.858A19.94 19.94 0 0 0 44 24a19.94 19.94 0 0 0-5.858-14.142A19.94 19.94 0 0 0 24 4A19.94 19.94 0 0 0 9.858 9.858A19.94 19.94 0 0 0 4 24a19.94 19.94 0 0 0 5.858 14.142A19.94 19.94 0 0 0 24 44Z"
    />
    <path
      fill="currentColor"
      fill-rule="evenodd"
      d="M24 37a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5"
      clip-rule="evenodd"
    />
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="4"
      d="M24 12v16"
    />
  </g>
</svg>
