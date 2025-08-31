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
  import { Icon } from '$lib/components/index.js';
  import { goto } from '$app/navigation';
  import { Button, Info } from '$lib/components/ui/index.js';

  const is404 = $derived(page.status === 404);
  const isServerError = $derived(page.status >= 500);
</script>

<svelte:head>
  <title>{page.status} - {page.error?.message ?? 'Error'}</title>
</svelte:head>

<div class="content-panel">
  <div class="flex items-center justify-center p-8">
    {#if is404}
      <!-- 404 -->
      <div class="mx-auto max-w-2xl text-center">
        <div class="mb-4 flex justify-center text-6xl font-bold text-foreground md:text-8xl">
          <Icon
            iconName="magnifying-glass"
            size={96}
            class="text-muted-foreground"
          />
        </div>
        <div class="mb-2 text-4xl font-bold text-foreground md:text-6xl">
          {page.status}
        </div>
        <h2 class="mb-6 text-2xl font-semibold text-accent-foreground md:text-3xl">
          Page Not Found
        </h2>
        <p class="mb-8 text-lg leading-relaxed text-muted-foreground">Wrong turn!</p>

        <div class="mb-12 flex flex-wrap justify-center gap-4">
          <Button
            variant="outline-info"
            onclick={() => history.back()}
          >
            Go Back
          </Button>
          <Button
            variant="outline-success"
            onclick={() => goto('/')}
          >
            Go Home
          </Button>
        </div>
      </div>
    {:else if isServerError}
      <!-- Server error -->
      <div class="mx-auto max-w-2xl text-center">
        <div
          class="mb-4 flex items-center justify-center pb-4 text-6xl font-bold text-foreground md:text-8xl"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="96"
            height="96"
            viewBox="0 0 16 16"
            ><path
              fill="currentColor"
              d="M2 8a6 6 0 0 0 4.509 5.813A5.5 5.5 0 0 1 6 11.5a5.5 5.5 0 0 1 .207-1.5h-.028A11 11 0 0 1 6 8c0-.714.064-1.39.179-2H9.82q.024.122.043.247a5.5 5.5 0 0 1 .98-.208L10.837 6h1.747l.05.117a5.5 5.5 0 0 1 1.18.392A6 6 0 0 0 2 8m6-5c.374 0 .875.356 1.313 1.318q.141.313.26.682H6.427a6 6 0 0 1 .26-.682C7.125 3.356 7.627 3 8 3m-2.223.904q-.227.5-.393 1.096H4a5 5 0 0 1 2.038-1.6a6 6 0 0 0-.261.504M5.163 6A12 12 0 0 0 5 8c0 .699.057 1.373.163 2H3.416A5 5 0 0 1 3 8c0-.711.148-1.388.416-2zm.221 5q.166.596.393 1.096q.119.262.26.504A5 5 0 0 1 4 11zm4.578-7.6A5 5 0 0 1 12 5h-1.384a7.5 7.5 0 0 0-.393-1.096a6 6 0 0 0-.26-.504M16 11.5a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0M11.5 9a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5m0 5.125a.625.625 0 1 0 0-1.25a.625.625 0 0 0 0 1.25"
            /></svg
          >
        </div>
        <div class="mb-2 text-4xl font-bold text-accent-foreground md:text-6xl">
          {page.status}
        </div>
        <h2 class="mb-6 text-2xl font-semibold text-accent-foreground md:text-3xl">Server Error</h2>
        <p class="mb-6 text-lg leading-relaxed text-muted-foreground">
          Uh oh, something went terribly wrong!
        </p>
        {#if page.error?.message}
          <Info
            variant="error"
            class="mb-8"
          >
            {page.error?.message}
          </Info>
        {/if}

        <div class="flex flex-wrap justify-center gap-4">
          <Button
            variant="outline-warning"
            onclick={() => location.reload()}
          >
            Try Again
          </Button>
          <Button
            variant="outline-success"
            onclick={() => goto('/')}
          >
            Go Home
          </Button>
        </div>
      </div>
    {:else}
      <!-- Other Errors (4xx) -->
      <div class="mx-auto max-w-2xl text-center">
        <h1 class="mb-4 text-6xl font-bold text-warning md:text-8xl">
          <Icon
            iconName="error"
            size={96}
          />
        </h1>
        <div class="mb-2 text-4xl font-bold text-muted-foreground md:text-6xl">
          {page.status}
        </div>
        <h2 class="mb-6 text-2xl font-semibold text-muted-foreground md:text-3xl">
          Something's Wrong
        </h2>
        <p class="mb-8 text-lg leading-relaxed text-foreground">
          {page.error?.message ?? 'An unexpected error occurred.'}
        </p>

        <div class="flex flex-wrap justify-center gap-4">
          <Button
            variant="outline-warning"
            onclick={() => history.back()}
          >
            Go Back
          </Button>
          <Button
            variant="outline-success"
            onclick={() => goto('/')}
          >
            Go Home
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>
