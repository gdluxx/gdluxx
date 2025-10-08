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
  import Icon from '#components/ui/Icon.svelte';
  import type { SettingsTab } from '#src/content/types';

  const {
    activeTab,
    onchange,
  }: {
    activeTab: SettingsTab;
    onchange?: (tab: SettingsTab) => void;
  } = $props();

  function select(tab: SettingsTab): void {
    if (tab === activeTab) return;
    onchange?.(tab);
  }
</script>

<div class="border-base-200 border-b">
  <div class="flex flex-wrap gap-2">
    <button
      class="text-base-content/70 hover:text-base-content flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm transition-all duration-200"
      class:border-b-primary={activeTab === 'preview'}
      class:text-primary={activeTab === 'preview'}
      class:font-semibold={activeTab === 'preview'}
      onclick={() => select('preview')}
    >
      <Icon
        iconName="preview"
        size={20}
      />
      Preview
    </button>
    <button
      class="text-base-content/70 hover:text-base-content flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm transition-all duration-200"
      class:border-b-primary={activeTab === 'gdluxx'}
      class:text-primary={activeTab === 'gdluxx'}
      class:font-semibold={activeTab === 'gdluxx'}
      onclick={() => select('gdluxx')}
    >
      <Icon
        iconName="settings"
        size={20}
      />
      gdluxx
    </button>
    <button
      class="text-base-content/70 hover:text-base-content flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm transition-all duration-200"
      class:border-b-primary={activeTab === 'appearance'}
      class:text-primary={activeTab === 'appearance'}
      class:font-semibold={activeTab === 'appearance'}
      onclick={() => select('appearance')}
    >
      <Icon
        iconName="theme"
        size={20}
      />
      Appearance
    </button>
    <button
      class="text-base-content/70 hover:text-base-content flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm transition-all duration-200"
      class:border-b-primary={activeTab === 'keyboard'}
      class:text-primary={activeTab === 'keyboard'}
      class:font-semibold={activeTab === 'keyboard'}
      onclick={() => select('keyboard')}
    >
      <Icon
        iconName="hotkey"
        size={16}
      />
      Hotkeys
    </button>
  </div>
</div>
