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
  import { toastStore } from '$lib/stores/toast.js';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { Toast } from '$lib/components';

  const hasJobButton = $derived(jobStore.jobCount > 0);
</script>

<div class="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-6 sm:p-6">
  <div class="flex w-full flex-col items-center space-y-4 sm:items-end" class:mb-20={hasJobButton}>
    {#each $toastStore as toast (toast.id)}
      <Toast {toast} />
    {/each}
  </div>
</div>
