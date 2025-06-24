<script lang="ts">
  import { toastStore } from '$lib/stores/toast.js';
  import { jobCount } from '$lib/stores/jobs';
  import { Toast } from '$lib/components';

  $: hasJobButton = $jobCount > 0;
</script>

<div class="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-6 sm:p-6">
  <div class="flex w-full flex-col items-center space-y-4 sm:items-end" class:mb-20={hasJobButton}>
    {#each $toastStore as toast (toast.id)}
      <Toast {toast} />
    {/each}
  </div>
</div>
