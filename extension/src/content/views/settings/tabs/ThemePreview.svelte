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
  interface ThemePreviewProps {
    themes: string[];
    currentTheme: string;
    onThemeSelect: (theme: string) => void;
  }

  const { themes, currentTheme, onThemeSelect }: ThemePreviewProps = $props();

  const themeGroups = {
    Basic: ['light', 'dark'],
    Colorful: [
      'cupcake',
      'emerald',
      'corporate',
      'retro',
      'valentine',
      'garden',
      'aqua',
      'pastel',
      'fantasy',
    ],
    Dark: [
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
    ],
    Professional: ['wireframe', 'cmyk', 'autumn'],
    Fun: ['acid', 'lemonade', 'winter', 'nord', 'sunset'],
  };

  function handleThemeClick(theme: string): void {
    onThemeSelect(theme);
  }

  const visibleGroups = $derived(
    Object.entries(themeGroups)
      .map(([groupName, groupThemes]) => ({
        groupName,
        groupThemes: groupThemes.filter((theme) => themes.includes(theme)),
      }))
      .filter(({ groupThemes }) => groupThemes.length > 0),
  );
</script>

<div class="mx-2 my-4">
  {#each visibleGroups as { groupName, groupThemes } (groupName)}
    <div class="mb-6">
      <h4 class="mb-2 text-sm font-medium opacity-70">{groupName}</h4>
      <div class="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        {#each groupThemes as theme (theme)}
          <button
            class="outline-base-content cursor-pointer overflow-hidden rounded-lg text-left {currentTheme ===
            theme
              ? 'outline outline-2 outline-offset-2'
              : ''}"
            data-set-theme={theme}
            data-act-class="outline"
            onclick={() => handleThemeClick(theme)}
            aria-label={`Select ${theme} theme`}
          >
            <div
              data-theme={theme}
              class="bg-base-100 text-base-content w-full font-sans"
            >
              <div class="grid grid-cols-5 grid-rows-3">
                <div class="bg-base-200 col-start-1 row-span-2 row-start-1"></div>
                <div class="bg-base-300 col-start-1 row-start-3"></div>
                <div
                  class="bg-base-100 col-span-4 col-start-2 row-span-3 row-start-1 flex flex-col gap-1 p-2"
                >
                  <div class="font-bold capitalize">{theme}</div>
                  <div class="flex flex-wrap gap-1">
                    <div
                      class="bg-primary flex aspect-square w-5 items-center justify-center rounded"
                    >
                      <span class="text-primary-content text-xs font-bold">A</span>
                    </div>
                    <div
                      class="bg-secondary flex aspect-square w-5 items-center justify-center rounded"
                    >
                      <span class="text-secondary-content text-xs font-bold">A</span>
                    </div>
                    <div
                      class="bg-accent flex aspect-square w-5 items-center justify-center rounded"
                    >
                      <span class="text-accent-content text-xs font-bold">A</span>
                    </div>
                    <div
                      class="bg-neutral flex aspect-square w-5 items-center justify-center rounded"
                    >
                      <span class="text-neutral-content text-xs font-bold">A</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>
