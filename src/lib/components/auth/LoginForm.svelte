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
  import { signIn } from '$lib/auth-client';
  import { toastStore } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);

  async function handleLogin() {
    if (!email || !password) {
      toastStore.error('Please fill in all fields');
      return;
    }

    isLoading = true;

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        toastStore.error('Login failed', result.error.message);
      } else {
        toastStore.success('Login successful');
        window.location.href = '/';
      }
    } catch (error) {
      toastStore.error('Login failed', 'An unexpected error occurred');
      console.error('Login error:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleLogin();
    }
  }

  function clearForm() {
    email = '';
    password = '';
  }
</script>

<div class="w-full max-w-md mx-auto">
  <form
    onsubmit={e => {
      e.preventDefault();
      handleLogin();
    }}
    class="space-y-6"
  >
    <div>
      <input
        id="email"
        type="email"
        bind:value={email}
        onkeydown={handleKeyPress}
        required
        class="mt-1 block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm placeholder-secondary-400 dark:placeholder-secondary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        placeholder="email"
        disabled={isLoading}
      />
    </div>

    <div>
      <input
        id="password"
        type="password"
        bind:value={password}
        onkeydown={handleKeyPress}
        required
        class="mt-1 block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm placeholder-secondary-400 dark:placeholder-secondary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        placeholder="password"
        disabled={isLoading}
      />
    </div>

    <div class="flex justify-end m-4 gap-6">
      <Button onclick={clearForm} variant="outline-secondary" disabled={isLoading} class="w-full"
        >Clear</Button
      >
      <Button type="submit" variant="primary" disabled={isLoading} class="w-full">
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </div>
  </form>
</div>
