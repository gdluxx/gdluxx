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
  import { LoginForm } from '$lib/components/auth';
  import icon from '$lib/assets/gdl-ico.png';
</script>

<svelte:head>
  <title>Sign In - gdluxx</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
  <div class="content-panel">
    <div class="w-full max-w-md space-y-8">
      <div class="text-center">
        <div class="mb-6 flex items-center justify-center">
          <img
            src={icon}
            alt="gdluxx Logo"
            class="mr-3 h-12 w-12"
          />
          <h1 class="text-3xl font-bold text-foreground">gdluxx</h1>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">Welcome back! Enter your credentials below</p>
      </div>
      <LoginForm />
    </div>
  </div>
</div>
