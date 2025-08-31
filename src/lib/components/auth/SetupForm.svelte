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
  import { signUp } from '$lib/auth-client';
  import { toastStore } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let name = $state('');
  let isLoading = $state(false);

  async function handleSetup() {
    if (!email || !password || !confirmPassword || !name) {
      toastStore.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toastStore.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toastStore.error('Password must be at least 8 characters long');
      return;
    }

    isLoading = true;

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        toastStore.error('Setup failed', result.error.message);
      } else {
        toastStore.success('Account created successfully');
        window.location.href = '/';
      }
    } catch (error) {
      toastStore.error('Setup failed', 'An unexpected error occurred');
      console.error('Setup error:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSetup();
    }
  }

  function clearForm() {
    email = '';
    password = '';
    confirmPassword = '';
    name = '';
  }
</script>

<div class="m-4 mx-8">
  <form
    onsubmit={e => {
      e.preventDefault();
      handleSetup();
    }}
    class="space-y-6"
  >
    <div>
      <input
        id="name"
        type="text"
        bind:value={name}
        onkeydown={handleKeyPress}
        required
        class="text-sm w-full px-3 py-2 border rounded-sm bg-input text-foreground"
        placeholder="username"
        disabled={isLoading}
      />
    </div>

    <div>
      <input
        id="email"
        type="email"
        bind:value={email}
        onkeydown={handleKeyPress}
        required
        class="text-sm w-full px-3 py-2 border rounded-sm bg-input text-foreground"
        placeholder="email address"
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
        class="text-sm w-full px-3 py-2 border rounded-sm bg-input text-foreground"
        placeholder="password (min 8 characters)"
        disabled={isLoading}
      />
    </div>

    <div>
      <input
        id="confirmPassword"
        type="password"
        bind:value={confirmPassword}
        onkeydown={handleKeyPress}
        required
        class="text-sm w-full px-3 py-2 border rounded-sm bg-input text-foreground"
        placeholder="Confirm password"
        disabled={isLoading}
      />
    </div>

    <div class="flex justify-end m-4 gap-6">
      <Button
        onclick={clearForm}
        variant="outline-primary"
        disabled={isLoading}
        class="w-full mt-2"
      >
        Clear
      </Button>
      <Button type="submit" variant="primary" disabled={isLoading} class="w-full mt-2">
        {isLoading ? 'Creating account...' : 'Create account'}
      </Button>
    </div>
  </form>
</div>
