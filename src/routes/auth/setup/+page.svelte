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
  import SetupForm from '$lib/components/auth/SetupForm.svelte';
  import icon from '$lib/assets/gdl-ico.png';
</script>

<svelte:head>
  <title>Initial Setup - gdluxx</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
  <div class="rounded-sm bg-surface-elevated p-8">
    <div class="w-full max-w-md space-y-8">
      <div class="text-center">
        <div class="mb-6 flex items-center justify-center">
          <img
            src={icon}
            alt="gdluxx Logo"
            class="mr-3 h-12 w-12"
          />
          <h1 class="text-3xl font-extrabold text-foreground">Welcome to gdluxx</h1>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          Create your administrator account to get started
        </p>
      </div>
      <SetupForm />
    </div>
  </div>
</div>
