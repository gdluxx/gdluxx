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
  import { Icon } from '$lib/components';
  import type { IconName } from '$lib/types/icons';
  import ExampleSection from './ExampleSection.svelte';

  const iconNames = [
    'key',
    'close',
    'close-light',
    'copy-clipboard',
    'delete',
    'play',
    'double-chevron-left',
    'json',
    'version',
    'dark',
    'light',
    'ui',
    'job',
    'log',
    'loading',
    'chevron-right',
    'plus',
    'user',
    'minimize',
    'maximize',
    'logout',
    'lock',
    'circle',
    'menu',
    'magnifying-glass',
    'settings',
    'run',
    'setup',
    'sort',
    'download-arrow',
    'no-circle',
    'dot',
    'date',
    'alpha-asc',
    'alpha-desc',
    'alpha-var',
    'num-asc',
    'num-desc',
    'num-var',
    'site-rules',
    'edit',
    'question',
    'extract',
    'save',
    'general-settings',
    'options',
    'checked',
    'error',
    'format',
    'export',
    'import',
    'reload',
    'restore',
  ] as const satisfies readonly IconName[];

  const sizes = [12, 16, 24, 32, 48] as const;
</script>

<div class="space-y-8">
  <ExampleSection
    title="Icon set"
    description="Every IconName exported by the project."
  >
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {#each iconNames as iconName (iconName)}
        <div class="flex min-w-0 items-center gap-3 rounded border border-border p-3">
          <Icon
            {iconName}
            size={20}
            ariaLabel={iconName}
            class="text-primary"
          />
          <span
            class="truncate text-xs text-muted-foreground"
            title={iconName}>{iconName}</span
          >
        </div>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Sizes and colors">
    <div class="flex flex-wrap items-end gap-6">
      {#each sizes as size (size)}
        <div class="text-center">
          <Icon
            iconName="settings"
            {size}
            color="var(--color-primary)"
          />
          <p class="mt-2 text-xs text-muted-foreground">{size}px</p>
        </div>
      {/each}
      <div class="text-center">
        <Icon
          iconName="checked"
          size={32}
          color="var(--color-success)"
        />
        <p class="mt-2 text-xs text-muted-foreground">custom color</p>
      </div>
    </div>
  </ExampleSection>
</div>
