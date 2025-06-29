<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script>
  import { page } from '$app/state';

  const is404 = $derived(page.status === 404);
  const isServerError = $derived(page.status >= 500);
</script>

<svelte:head>
  <title>{page.status} - {page.error?.message ?? 'Error'}</title>
</svelte:head>

<div
  class="mx-auto rounded-lg border border-secondary-200 bg-secondary-50 p-6 shadow-md dark:border-secondary-700 dark:bg-secondary-950"
>
  <div class="flex items-center justify-center p-8">
    {#if is404}
      <!-- 404 -->
      <div class="max-w-2xl mx-auto text-center">
        <div class="flex justify-center text-6xl md:text-8xl font-bold text-primary-500 mb-4">
          <svg class="h-32 w-32 text-primary-600 mr-3" viewBox="0 0 48 48">
            <g fill="currentColor">
              <path
                d="M18.748 12.816c-1.74.067-3.313.688-4.154 1.53a1 1 0 1 1-1.414-1.415c1.297-1.297 3.409-2.033 5.49-2.114c2.095-.081 4.382.492 5.984 2.094a1 1 0 0 1-1.415 1.414c-1.09-1.091-2.764-1.577-4.491-1.51"
              />
              <path
                fill-rule="evenodd"
                d="M27.384 28.936A12.95 12.95 0 0 1 19 32c-7.18 0-13-5.82-13-13S11.82 6 19 6s13 5.82 13 13c0 3.195-1.152 6.12-3.064 8.384L31.144 27l10.284 10.284c.763.763.763 2 0 2.762l-1.382 1.382c-.763.763-2 .763-2.762 0L27 31.144zM30 19c0 6.075-4.925 11-11 11S8 25.075 8 19S12.925 8 19 8s11 4.925 11 11m7.249 16.933l-6.785-6.785l-1.12.195l-.196 1.121l6.805 6.805zm.118 2.75l1.298 1.298l1.316-1.316l-1.318-1.318z"
                clip-rule="evenodd"
              />
            </g>
          </svg>
        </div>
        <div class="text-4xl md:text-6xl font-bold text-secondary-900 dark:text-secondary-100 mb-2">
          {page.status}
        </div>
        <h2
          class="text-2xl md:text-3xl font-semibold text-secondary-800 dark:text-secondary-200 mb-6"
        >
          Page Not Found
        </h2>
        <p class="text-lg text-secondary-600 dark:text-secondary-400 mb-8 leading-relaxed">
          The page you're looking for doesn't exist. It might have been moved, deleted, or you
          entered the wrong URL.
        </p>

        <div class="flex flex-wrap gap-4 justify-center mb-12">
          <a
            href="/"
            class="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-secondary-950"
          >
            Go Home
          </a>
          <button
            onclick={() => history.back()}
            class="cursor-pointer inline-flex items-center px-6 py-3 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 dark:focus:ring-offset-secondary-950"
          >
            Go Back
          </button>
        </div>
      </div>
    {:else if isServerError}
      <!-- Server error -->
      <div class="max-w-2xl mx-auto text-center">
        <h1 class="text-6xl md:text-8xl font-bold text-error-500 mb-4">🚨</h1>
        <div class="text-4xl md:text-6xl font-bold text-secondary-900 dark:text-secondary-100 mb-2">
          {page.status}
        </div>
        <h2
          class="text-2xl md:text-3xl font-semibold text-secondary-800 dark:text-secondary-200 mb-6"
        >
          Server Error
        </h2>
        <p class="text-lg text-secondary-600 dark:text-secondary-400 mb-6 leading-relaxed">
          Something went wrong on our end. Please try again later.
        </p>
        {#if page.error?.message}
          <div
            class="bg-error-100 dark:bg-error-900 border border-error-250 dark:border-error-750 rounded-lg p-4 mb-8"
          >
            <p class="text-error-750 dark:text-error-250 font-mono text-sm">
              {page.error.message}
            </p>
          </div>
        {/if}

        <div class="flex flex-wrap gap-4 justify-center">
          <button
            onclick={() => location.reload()}
            class="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-secondary-950"
          >
            Try Again
          </button>
          <a
            href="/"
            class="inline-flex items-center px-6 py-3 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 dark:focus:ring-offset-secondary-950"
          >
            Go Home
          </a>
        </div>
      </div>
    {:else}
      <!-- Other Errors (4xx) -->
      <div class="max-w-2xl mx-auto text-center">
        <h1 class="text-6xl md:text-8xl font-bold text-warning-500 mb-4">⚠️</h1>
        <div class="text-4xl md:text-6xl font-bold text-secondary-900 dark:text-secondary-100 mb-2">
          {page.status}
        </div>
        <h2
          class="text-2xl md:text-3xl font-semibold text-secondary-800 dark:text-secondary-200 mb-6"
        >
          Something's Wrong
        </h2>
        <p class="text-lg text-secondary-600 dark:text-secondary-400 mb-8 leading-relaxed">
          {page.error?.message ?? 'An unexpected error occurred.'}
        </p>

        <div class="flex flex-wrap gap-4 justify-center">
          <a
            href="/"
            class="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-secondary-950"
          >
            Go Home
          </a>
          <button
            onclick={() => history.back()}
            class="inline-flex items-center px-6 py-3 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 dark:focus:ring-offset-secondary-950"
          >
            Go Back
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
