<script lang="ts">
  import { onMount } from 'svelte';
  import { loggingStore } from '$lib/stores/loggingStore.svelte';

  onMount(() => {
    loggingStore.fetchStatus();
  });

  function handleLoggingToggleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    loggingStore.updateStatus(target.checked);
  }
</script>

<div
  class="bg-primary-50 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800 p-6"
>
  {#if loggingStore.isLoading && !loggingStore.enabled}
    <div class="flex items-center space-x-3 text-secondary-700 dark:text-secondary-300">
      <div
        class="h-4 w-4 animate-spin bg-current"
        style:mask="url('/icons/loading-two-tone-loop.svg') no-repeat center"
        style:mask-size="contain"
      ></div>
      <span>Loading log settings...</span>
    </div>
  {:else}
    <div class="space-y-4">
      <label class="flex cursor-pointer items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="relative">
            <input
              type="checkbox"
              checked={loggingStore.enabled}
              onchange={handleLoggingToggleChange}
              disabled={loggingStore.isLoading}
              name="Enable Debugging"
              class="peer sr-only"
            />

            <div
              class="h-5 w-10 rounded-full bg-secondary-600 transition-colors peer-checked:bg-primary-400 peer-disabled:opacity-50 dark:bg-secondary-300 dark:peer-checked:bg-primary-600"
            ></div>

            <div
              class="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-5 peer-disabled:opacity-70 shadow-sm"
            ></div>
          </div>
          <span class="text-lg font-medium text-secondary-900 dark:text-secondary-100">
            Enable Debugging
          </span>
        </div>

        {#if loggingStore.isLoading}
          <div
            class="h-4 w-4 animate-spin bg-current text-secondary-600"
            style:mask="url('/icons/loading-two-tone-loop.svg') no-repeat center"
            style:mask-size="contain"
          ></div>
        {/if}
      </label>

      <p class="cursor-default text-sm text-secondary-600 dark:text-secondary-400 pl-14">
        When enabled, additional logs will be written to the server console. This setting persists
        across server restarts. However, the logs themselves do not persist.
      </p>

      {#if loggingStore.error && !loggingStore.isLoading}
        <div
          class="bg-error-50 border border-error-200 rounded-md p-3 dark:bg-error-900/20 dark:border-error-800"
        >
          <p class="text-error-600 dark:text-error-400 text-sm font-medium">
            Error: {loggingStore.error}
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>
