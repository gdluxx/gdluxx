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
  import { Button } from '#components/ui';
  import type { HoverPreviewMode } from '#src/content/types';
  import ThemePreview from './ThemePreview.svelte';

  interface AppearanceTabProps {
    currentTheme: string;
    isFullscreen: boolean;
    showImagePreviews: boolean;
    showImageHoverPreview: HoverPreviewMode;
    onThemeChange: (event: Event) => void;
    onToggleDisplayMode: () => void | Promise<void>;
    onToggleImagePreviews: (event: Event) => void | Promise<void>;
    onToggleImageHoverPreview: (event: Event) => void | Promise<void>;
  }

  const { currentTheme, isFullscreen, onThemeChange, onToggleDisplayMode }: AppearanceTabProps =
    $props();

  const allThemes = [
    'light',
    'dark',
    'cupcake',
    'emerald',
    'corporate',
    'retro',
    'valentine',
    'garden',
    'aqua',
    'pastel',
    'fantasy',
    'cyberpunk',
    'halloween',
    'forest',
    'black',
    'luxury',
    'dracula',
    'business',
    'night',
    'coffee',
    'dim',
    'wireframe',
    'cmyk',
    'autumn',
    'acid',
    'lemonade',
    'winter',
    'nord',
    'sunset',
  ];

  function handleThemeSelect(theme: string): void {
    const syntheticEvent = new Event('change');
    Object.defineProperty(syntheticEvent, 'target', {
      value: { value: theme },
      writable: false,
    });
    onThemeChange(syntheticEvent);
  }
</script>

<div class="mx-2 my-4">
  <div class="card bg-base-100 border-base-200 mb-4 max-w-[640px] border shadow-xl">
    <div class="card-body">
      <div class="card-title">Display Mode</div>
      <p>Modal view or fullscreen overlay for maximum space.</p>
      <div class="card-actions justify-end">
        <Button
          variant="secondary"
          onclick={onToggleDisplayMode}
        >
          {isFullscreen ? 'Switch to Modal' : 'Switch to Fullscreen'}
        </Button>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 border-base-200 mb-4 border shadow-xl">
    <div class="card-body">
      <div class="card-title">Theme Selection</div>
      <ThemePreview
        themes={allThemes}
        {currentTheme}
        onThemeSelect={handleThemeSelect}
      />

      <p class="text-base-content/70 text-right text-sm">
        Props to <a
          href="https://daisyui.com"
          class="link-accent">daisyUI</a
        >
      </p>
    </div>
  </div>
</div>
