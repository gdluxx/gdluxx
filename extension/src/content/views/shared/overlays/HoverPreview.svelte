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
  import { HOVER_PREVIEW_STYLES, resolveHoverMode } from '#utils/display';
  import type { HoverPreviewMode } from '#src/content/types';

  interface HoverPreviewProps {
    visible: boolean;
    url: string | null;
    position: { x: number; y: number };
    mode: HoverPreviewMode;
    hasError?: boolean;
    onerror?: () => void;
  }

  const { visible, url, position, mode, hasError = false, onerror }: HoverPreviewProps = $props();

  const resolvedMode = $derived(resolveHoverMode(mode));
  const classes = $derived(HOVER_PREVIEW_STYLES[resolvedMode]);
</script>

{#if visible && url}
  <div
    class="pointer-events-none fixed z-[2147483647]"
    style={`top: ${position.y}px; left: ${position.x}px;`}
  >
    <div
      class={`${classes.container} card image-full border-base-300 bg-base-100 border p-3 shadow-xl`}
    >
      <!--      <div class="mb-1 text-xs font-semibold text-base-content/70">Preview</div>-->
      <div
        class={`flex ${classes.image} card bg-base-200 items-center justify-center overflow-hidden`}
      >
        {#key url}
          {#if hasError}
            <span class="text-base-content/60 px-2 text-center text-xs">
              Image could not be loaded.
            </span>
          {:else}
            <figure>
              <img
                src={url}
                alt=""
                class="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
                onerror={() => onerror?.()}
              />
            </figure>
          {/if}
        {/key}
      </div>
    </div>
  </div>
{/if}
