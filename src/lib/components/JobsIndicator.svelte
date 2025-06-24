<script lang="ts">
  import { jobCount, runningJobCount, jobStore } from '$lib/stores/jobs';

  function handleClick() {
    jobStore.showJobListModal();
  }
</script>

<button
  onclick={handleClick}
  class="relative flex items-center justify-center p-2 text-secondary-900 dark:text-secondary-100 hover:bg-secondary-200 dark:hover:bg-secondary-800 rounded-md transition-colors cursor-pointer"
  aria-label="Show jobs list"
  title="Show jobs list"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    ><g
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      color="currentColor"
      ><path
        d="M11.007 21.5H9.605c-3.585 0-5.377 0-6.491-1.135S2 17.403 2 13.75s0-5.48 1.114-6.615S6.02 6 9.605 6h3.803c3.585 0 5.378 0 6.492 1.135c.857.873 1.054 2.156 1.1 4.365V13"
      />
      <path
        d="M19 18.5h-3m0 3a3 3 0 1 1 0-6m3 6a3 3 0 1 0 0-6M16 6l-.1-.31c-.495-1.54-.742-2.31-1.331-2.75c-.59-.44-1.372-.44-2.938-.44h-.263c-1.565 0-2.348 0-2.937.44c-.59.44-.837 1.21-1.332 2.75L7 6"
      />
    </g>
  </svg>
  {#if $runningJobCount > 0}
    <span
      class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse"
    >
      {$runningJobCount}
    </span>
  {:else}
    <span
      class="absolute -top-0.25 -right-0.25 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
    >
      {$jobCount}
    </span>
  {/if}
</button>
