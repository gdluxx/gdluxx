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
  import { clientLogger as logger } from '$lib/client/logger';
  import { Button, Field } from '$lib/components/ui';
  import { submitOnEnter, withLoadingGuard } from './auth-form';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);

  const submitLogin = withLoadingGuard(
    async () => {
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
        logger.error('Login error:', error);
      }
    },
    {
      isLoading: () => isLoading,
      setLoading: (value) => (isLoading = value),
    },
  );

  async function handleLogin() {
    if (!email || !password) {
      toastStore.error('Please fill in all fields');
      return;
    }

    await submitLogin();
  }

  const handleKeyPress = submitOnEnter(handleLogin);

  function clearForm() {
    email = '';
    password = '';
  }
</script>

<div class="m-4 mx-8">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      handleLogin();
    }}
    class="space-y-6"
  >
    <Field
      label="Email"
      id="email"
      required
    >
      {#snippet control({ id, describedBy, invalid, required })}
        <input
          {id}
          type="email"
          bind:value={email}
          onkeydown={handleKeyPress}
          {required}
          class="form-input"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          placeholder="email"
          disabled={isLoading}
        />
      {/snippet}
    </Field>

    <Field
      label="Password"
      id="password"
      required
    >
      {#snippet control({ id, describedBy, invalid, required })}
        <input
          {id}
          type="password"
          bind:value={password}
          onkeydown={handleKeyPress}
          {required}
          class="form-input"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          placeholder="password"
          disabled={isLoading}
        />
      {/snippet}
    </Field>

    <div class="m-4 flex justify-end gap-6">
      <Button
        onclick={clearForm}
        variant="outline-primary"
        disabled={isLoading}
        class="w-full"
      >
        Clear
      </Button>
      <Button
        type="submit"
        variant="primary"
        disabled={isLoading}
        class="w-full"
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </div>
  </form>
</div>
