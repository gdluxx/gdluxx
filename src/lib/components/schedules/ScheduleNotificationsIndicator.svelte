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
  import { resolve } from '$app/paths';
  import { scheduleNotificationStore } from '$lib/stores/scheduleNotifications.svelte';

  const unreadCount = $derived(scheduleNotificationStore.unreadCount);
</script>

<a
  href={resolve('/schedules/notifications')}
  class="relative flex items-center justify-center rounded-sm p-2 text-muted-foreground hover:bg-surface-hover focus:outline-hidden focus:border-focus"
  aria-label="Schedule notifications"
  title="Schedule notifications"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M14.857 17.082a23.85 23.85 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
    />
  </svg>
  {#if unreadCount > 0}
    <span
      class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error/75 px-1 text-xs font-semibold text-foreground"
    >
      {unreadCount}
    </span>
  {/if}
</a>
