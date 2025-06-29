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

<div class="flex items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <div class="flex justify-center items-center mb-6">
        <img src={icon} alt="gdluxx Logo" class="h-12 w-12 mr-3" />
        <h1 class="text-3xl font-extrabold text-secondary-900 dark:text-secondary-100">
          Welcome to gdluxx
        </h1>
      </div>
      <p class="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
        Create your administrator account to get started
      </p>
    </div>
    <SetupForm />
  </div>
</div>
