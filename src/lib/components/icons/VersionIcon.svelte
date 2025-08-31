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
  viewBox="0 0 24 24"
  width={size}
  height={size}
  class={className}
  ><g
    fill="none"
    fill-rule="evenodd"
    ><path
      d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"
    /><path
      fill="currentColor"
      fill-rule="nonzero"
      d="m12.935 2.878l7.181 3.796c1.066.563 1.066 2.09 0 2.652L18.842 10l1.274.674c1.066.563 1.066 2.09 0 2.652L18.842 14l1.274.674c1.066.563 1.066 2.09 0 2.652l-7.181 3.796a2 2 0 0 1-1.87 0l-7.181-3.796c-1.066-.563-1.066-2.089 0-2.652L5.159 14l-1.275-.674c-1.066-.563-1.066-2.089 0-2.652L5.159 10l-1.275-.674c-1.066-.563-1.066-2.089 0-2.652l7.181-3.796a2 2 0 0 1 1.87 0m3.767 12.253l-3.767 1.991a2 2 0 0 1-1.87 0l-3.767-1.99L5.655 16L12 19.354L18.346 16zm0-4l-3.767 1.992a2 2 0 0 1-1.707.076l-.163-.076l-3.767-1.992l-1.643.87L12 15.353L18.346 12zM12 4.646L5.655 8L12 11.354L18.346 8z"
    />
  </g>
</svg>
