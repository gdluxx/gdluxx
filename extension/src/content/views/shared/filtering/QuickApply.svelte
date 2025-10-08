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
  import { describeProfile } from '#utils/formatters';
  import type { SavedSelectorProfile } from '#utils/storageProfiles';

  const {
    hostProfiles = [],
    onapplyprofile,
  }: {
    hostProfiles: SavedSelectorProfile[];
    onapplyprofile?: (profileId: string) => void;
  } = $props();

  let quickApplySelection = $state('');

  function handleSelectionChange() {
    if (quickApplySelection) {
      onapplyprofile?.(quickApplySelection);
      quickApplySelection = '';
    }
  }
</script>

{#if hostProfiles.length > 0}
  <div class="text-base-content/70 flex items-center gap-2 text-xs">
    <span>Quick apply</span>
    <select
      class="select-bordered select select-xs focus:select-primary"
      bind:value={quickApplySelection}
      onchange={handleSelectionChange}
    >
      <option value="">Select a saved range…</option>
      {#each hostProfiles as profile (profile.id)}
        <option value={profile.id}>
          {describeProfile(profile)}
        </option>
      {/each}
    </select>
  </div>
{/if}
