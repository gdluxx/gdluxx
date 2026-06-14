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
  import { describeExtractionProfile } from '#utils/formatters';
  import type { ExtractionProfile } from '#src/content/types';

  const {
    hostProfiles = [],
    onapplyprofile,
  }: {
    hostProfiles?: ExtractionProfile[];
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
      aria-label="Quick apply extraction profile"
    >
      <option value="">Select a saved profile…</option>
      {#each hostProfiles as profile (profile.id)}
        <option value={profile.id}>
          {describeExtractionProfile(profile)}
        </option>
      {/each}
    </select>
  </div>
{:else}
  <p class="text-base-content/50 text-xs">No extraction profiles for this host yet.</p>
{/if}
