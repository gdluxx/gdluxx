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
  import { toastStore } from '#stores/toast';
  import Toast from './Toast.svelte';

  function handleDismiss(id: string) {
    toastStore.dismiss(id);
  }
</script>

<div
  class="pointer-events-none fixed top-4 right-4 z-[2147483648] flex w-full max-w-sm flex-col gap-2"
  role="region"
  aria-label="Notifications"
>
  {#each $toastStore as toast (toast.id)}
    <div class="pointer-events-auto">
      <Toast
        id={toast.id}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        dismissible={toast.dismissible}
        autoHide={toast.autoHide}
        duration={toast.duration}
        onDismiss={() => handleDismiss(toast.id)}
      />
    </div>
  {/each}
</div>
