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
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { authClient, signOut } from '$lib/auth-client';
  import { Button, Chip, ConfirmModal, Field, Info, Toggle } from '$lib/components/ui';
  import { formatRelativeTime } from '$lib/utils/relativeTime';
  import { clientLogger } from '$lib/client/logger';

  interface AccountUser {
    id: string;
    name: string;
    email: string;
    createdAt: string | Date;
  }

  interface SessionSummary {
    // Opaque identifier. Only ever used as a form value; session tokens never
    // reach the browser
    id: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    isCurrent: boolean;
  }

  interface Props {
    user?: AccountUser;
    sessions?: SessionSummary[];
  }

  const { user, sessions = [] }: Props = $props();

  const PASSWORD_MIN_LENGTH = 8;
  const PASSWORD_MAX_LENGTH = 128;

  // Change password
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let revokeOtherSessionsOnChange = $state(true);
  let passwordErrors = $state<{ current?: string; next?: string; confirm?: string }>({});
  let passwordError = $state<string | null>(null);
  let passwordMessage = $state<string | null>(null);
  let passwordSaving = $state(false);

  // Change email
  let newEmail = $state('');
  let emailPassword = $state('');
  let emailErrors = $state<{ email?: string; password?: string }>({});
  let emailError = $state<string | null>(null);
  let emailMessage = $state<string | null>(null);
  let emailSaving = $state(false);

  // Sessions
  let sessionError = $state<string | null>(null);
  let sessionMessage = $state<string | null>(null);
  let sessionIdToRevoke = $state<string | null>(null);
  let showRevokeOthersConfirm = $state(false);
  let showSignOutEverywhereConfirm = $state(false);
  let signOutAfterRevoke = $state(false);
  let sessionBusy = $state(false);

  const otherSessionCount = $derived(sessions.filter((session) => !session.isCurrent).length);

  function absoluteTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }

  function relativeTime(value: string): string {
    return value ? formatRelativeTime(value) : 'Unknown';
  }

  function expiresIn(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      return 'Expires today';
    }
    return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  }

  // Deliberately not parsed into browser/OS: that needs a UA-parser dependency
  // and gets stale. The raw string is shown, truncated, with the full value in
  // the tooltip.
  function shortUserAgent(userAgent: string | null): string {
    if (!userAgent) {
      return 'Unknown device';
    }
    return userAgent.length > 72 ? `${userAgent.slice(0, 72)}…` : userAgent;
  }

  function readFormError(data: unknown, fallback: string): string {
    if (data && typeof data === 'object' && 'error' in data) {
      const value = (data as { error?: unknown }).error;
      if (typeof value === 'string' && value) {
        return value;
      }
    }
    return fallback;
  }

  function readFormMessage(data: unknown, fallback: string): string {
    if (data && typeof data === 'object' && 'message' in data) {
      const value = (data as { message?: unknown }).message;
      if (typeof value === 'string' && value) {
        return value;
      }
    }
    return fallback;
  }

  function validatePasswordForm(): boolean {
    const errors: { current?: string; next?: string; confirm?: string } = {};

    if (!currentPassword) {
      errors.current = 'Enter your current password.';
    }
    if (!newPassword) {
      errors.next = 'Enter a new password.';
    } else if (newPassword.length < PASSWORD_MIN_LENGTH) {
      errors.next = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    } else if (newPassword.length > PASSWORD_MAX_LENGTH) {
      errors.next = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
    } else if (newPassword === currentPassword) {
      errors.next = 'The new password must be different from the current one.';
    }
    if (!confirmPassword) {
      errors.confirm = 'Re-enter the new password.';
    } else if (confirmPassword !== newPassword) {
      errors.confirm = 'The passwords do not match.';
    }

    passwordErrors = errors;
    return Object.keys(errors).length === 0;
  }

  function mapPasswordErrorCode(code: string | undefined, message: string | undefined): string {
    switch (code) {
      case 'INVALID_PASSWORD':
        return 'Current password is incorrect.';
      case 'PASSWORD_TOO_SHORT':
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
      case 'PASSWORD_TOO_LONG':
        return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
      case 'USER_NOT_FOUND':
        return 'Account not found.';
      default:
        return message && message.length > 0 ? message : 'The password could not be changed.';
    }
  }

  async function handleChangePassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    passwordError = null;
    passwordMessage = null;

    if (!validatePasswordForm()) {
      return;
    }

    passwordSaving = true;

    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: revokeOtherSessionsOnChange,
      });

      if (error) {
        const mapped = mapPasswordErrorCode(error.code, error.message);
        if (error.code === 'INVALID_PASSWORD') {
          passwordErrors = { ...passwordErrors, current: mapped };
        } else {
          passwordError = mapped;
        }
        return;
      }

      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      passwordErrors = {};
      passwordMessage = revokeOtherSessionsOnChange
        ? 'Password changed. All other devices were signed out.'
        : 'Password changed. Other devices are still signed in.';

      await invalidateAll();
    } catch (error) {
      clientLogger.error('Password change failed:', error);
      passwordError = 'The password could not be changed.';
    } finally {
      passwordSaving = false;
    }
  }

  function validateEmailForm(): boolean {
    const errors: { email?: string; password?: string } = {};
    const trimmed = newEmail.trim();

    if (!trimmed) {
      errors.email = 'Enter a new email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      errors.email = 'Enter a valid email address.';
    } else if (trimmed.toLowerCase() === user?.email.toLowerCase()) {
      errors.email = 'That is already your email address.';
    }
    if (!emailPassword) {
      errors.password = 'Enter your current password.';
    }

    emailErrors = errors;
    return Object.keys(errors).length === 0;
  }

  function requestSubmitById(formId: string): void {
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }

  function confirmRevokeSession(): void {
    if (sessionBusy) {
      return;
    }
    requestSubmitById('revoke-session-form');
  }

  function confirmRevokeOthers(): void {
    showRevokeOthersConfirm = false;
    signOutAfterRevoke = false;
    requestSubmitById('revoke-others-form');
  }

  function confirmSignOutEverywhere(): void {
    showSignOutEverywhereConfirm = false;
    signOutAfterRevoke = true;
    requestSubmitById('revoke-others-form');
  }

  const sessionPendingRevoke = $derived(
    sessionIdToRevoke ? sessions.find((session) => session.id === sessionIdToRevoke) : undefined,
  );
</script>

<div class="space-y-6">
  <!-- Account -->
  <section class="content-panel">
    <h2 class="text-lg font-medium text-foreground">Account</h2>
    {#if user}
      <dl class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Name</dt>
          <dd class="mt-1 text-sm break-words text-foreground">{user.name}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Email</dt>
          <dd class="mt-1 text-sm break-all text-foreground">{user.email}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Member since
          </dt>
          <dd class="mt-1 text-sm text-foreground">
            {new Date(user.createdAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>
    {:else}
      <p class="mt-4 text-sm text-muted-foreground">No account information is available.</p>
    {/if}
  </section>

  <!-- Change password -->
  <section class="content-panel">
    <h2 class="text-lg font-medium text-foreground">Change password</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      gdluxx has no password reset flow. If this password is lost, the account cannot be recovered
      from the web interface.
    </p>

    {#if passwordMessage}
      <Info
        variant="success"
        size="sm"
        class="mt-4"
      >
        {passwordMessage}
      </Info>
    {/if}
    {#if passwordError}
      <Info
        variant="error"
        size="sm"
        class="mt-4"
      >
        {passwordError}
      </Info>
    {/if}

    <!--
      `method="POST"` and the missing `name` attributes are deliberate: this
      form is submitted by JS only (values come from bound state), so a native
      submit before hydration must never be able to put a password in a query
      string or a request body.
    -->
    <form
      class="mt-4 space-y-4"
      method="POST"
      onsubmit={handleChangePassword}
    >
      <Field
        label="Current password"
        required
        error={passwordErrors.current}
      >
        {#snippet control({ id, describedBy, invalid, required })}
          <input
            {id}
            type="password"
            autocomplete="current-password"
            class="form-input"
            class:form-input-error={invalid}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required={required ? 'true' : undefined}
            bind:value={currentPassword}
          />
        {/snippet}
      </Field>

      <Field
        label="New password"
        required
        description={`Between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`}
        error={passwordErrors.next}
      >
        {#snippet control({ id, describedBy, invalid, required })}
          <input
            {id}
            type="password"
            autocomplete="new-password"
            minlength={PASSWORD_MIN_LENGTH}
            maxlength={PASSWORD_MAX_LENGTH}
            class="form-input"
            class:form-input-error={invalid}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required={required ? 'true' : undefined}
            bind:value={newPassword}
          />
        {/snippet}
      </Field>

      <Field
        label="Confirm new password"
        required
        error={passwordErrors.confirm}
      >
        {#snippet control({ id, describedBy, invalid, required })}
          <input
            {id}
            type="password"
            autocomplete="new-password"
            maxlength={PASSWORD_MAX_LENGTH}
            class="form-input"
            class:form-input-error={invalid}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required={required ? 'true' : undefined}
            bind:value={confirmPassword}
          />
        {/snippet}
      </Field>

      <Toggle
        bind:checked={revokeOtherSessionsOnChange}
        id="revoke-other-sessions"
        variant="primary"
        size="sm"
        label="Sign out other devices"
        description="Leave this on when changing a password you think may be compromised. If it is off, any session someone else already has stays signed in even after the password changes."
      />

      <div class="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={passwordSaving}
        >
          {passwordSaving ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </form>
  </section>

  <!-- Change email -->
  <section class="content-panel">
    <h2 class="text-lg font-medium text-foreground">Change email address</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      This is the address used to sign in. The change takes effect immediately and is not verified —
      gdluxx sends no email, so a typo will lock you out of sign-in. There is also no password reset
      flow, so keep these credentials safe.
    </p>

    {#if emailMessage}
      <Info
        variant="success"
        size="sm"
        class="mt-4"
      >
        {emailMessage}
      </Info>
    {/if}
    {#if emailError}
      <Info
        variant="error"
        size="sm"
        class="mt-4"
      >
        {emailError}
      </Info>
    {/if}

    <form
      class="mt-4 space-y-4"
      method="POST"
      action="?/changeEmail"
      use:enhance={({ cancel }) => {
        emailError = null;
        emailMessage = null;

        if (!validateEmailForm()) {
          cancel();
          return;
        }

        emailSaving = true;

        return async ({ result }) => {
          emailSaving = false;

          if (result.type === 'success') {
            emailMessage = readFormMessage(result.data, 'Email address updated.');
            newEmail = '';
            emailPassword = '';
            emailErrors = {};
            await invalidateAll();
          } else if (result.type === 'failure') {
            emailError = readFormError(result.data, 'The email address could not be changed.');
          } else {
            emailError = 'An unexpected error occurred.';
          }
        };
      }}
    >
      <Field
        label="New email address"
        required
        error={emailErrors.email}
      >
        {#snippet control({ id, describedBy, invalid, required })}
          <input
            {id}
            type="email"
            name="newEmail"
            autocomplete="email"
            maxlength={254}
            class="form-input"
            class:form-input-error={invalid}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required={required ? 'true' : undefined}
            bind:value={newEmail}
          />
        {/snippet}
      </Field>

      <Field
        label="Current password"
        required
        description="Required so that an unattended session cannot silently move the account to another address."
        error={emailErrors.password}
      >
        {#snippet control({ id, describedBy, invalid, required })}
          <input
            {id}
            type="password"
            name="currentPassword"
            autocomplete="current-password"
            class="form-input"
            class:form-input-error={invalid}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required={required ? 'true' : undefined}
            bind:value={emailPassword}
          />
        {/snippet}
      </Field>

      <div class="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={emailSaving}
        >
          {emailSaving ? 'Saving…' : 'Change email'}
        </Button>
      </div>
    </form>
  </section>

  <!-- Active sessions -->
  <section class="content-panel">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-medium text-foreground">
          Active sessions ({sessions.length})
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Every browser currently signed in to this account. Sessions expire 7 days after they were
          last used.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline-warning"
          size="sm"
          disabled={sessionBusy || otherSessionCount === 0}
          onclick={() => (showRevokeOthersConfirm = true)}
        >
          Sign out other devices
        </Button>
        <Button
          type="button"
          variant="outline-danger"
          size="sm"
          disabled={sessionBusy}
          onclick={() => (showSignOutEverywhereConfirm = true)}
        >
          Sign out everywhere
        </Button>
      </div>
    </div>

    {#if sessionMessage}
      <Info
        variant="success"
        size="sm"
        class="mt-4"
      >
        {sessionMessage}
      </Info>
    {/if}
    {#if sessionError}
      <Info
        variant="error"
        size="sm"
        class="mt-4"
      >
        {sessionError}
      </Info>
    {/if}

    {#if sessions.length === 0}
      <p class="mt-4 text-sm text-muted-foreground">No active sessions were found.</p>
    {:else}
      <ul class="mt-4 space-y-3">
        {#each sessions as session (session.id)}
          <li class="rounded-sm border-strong p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="text-sm font-medium break-all text-foreground"
                    title={session.userAgent ?? 'Unknown device'}
                  >
                    {shortUserAgent(session.userAgent)}
                  </span>
                  {#if session.isCurrent}
                    <Chip
                      size="sm"
                      label="Current session"
                      variant="outline-primary"
                    />
                  {/if}
                </div>
                <dl class="mt-2 grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <div class="flex gap-1">
                    <dt>IP address:</dt>
                    <dd class="text-foreground">{session.ipAddress ?? 'Not recorded'}</dd>
                  </div>
                  <div class="flex gap-1">
                    <dt>Last active:</dt>
                    <dd
                      class="text-foreground"
                      title={absoluteTime(session.updatedAt)}
                    >
                      {relativeTime(session.updatedAt)}
                    </dd>
                  </div>
                  <div class="flex gap-1">
                    <dt>Signed in:</dt>
                    <dd
                      class="text-foreground"
                      title={absoluteTime(session.createdAt)}
                    >
                      {relativeTime(session.createdAt)}
                    </dd>
                  </div>
                  <div class="flex gap-1">
                    <dt>Expires:</dt>
                    <dd
                      class="text-foreground"
                      title={absoluteTime(session.expiresAt)}
                    >
                      {expiresIn(session.expiresAt)}
                    </dd>
                  </div>
                </dl>
              </div>

              {#if !session.isCurrent}
                <Button
                  type="button"
                  variant="outline-danger"
                  size="sm"
                  disabled={sessionBusy}
                  onclick={() => (sessionIdToRevoke = session.id)}
                >
                  Revoke
                </Button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<!-- Hidden action forms, driven by the confirmation modals above -->
<form
  id="revoke-session-form"
  method="POST"
  action="?/revokeSession"
  style:display="none"
  use:enhance={() => {
    sessionBusy = true;
    sessionError = null;
    sessionMessage = null;

    return async ({ result }) => {
      sessionBusy = false;
      // Closes the confirmation modal and releases the hidden input, now that
      // the value has actually been submitted.
      sessionIdToRevoke = null;

      if (result.type === 'success') {
        sessionMessage = readFormMessage(result.data, 'Session revoked.');
        await invalidateAll();
      } else if (result.type === 'failure') {
        sessionError = readFormError(result.data, 'The session could not be revoked.');
      } else {
        sessionError = 'An unexpected error occurred.';
      }
    };
  }}
>
  <input
    type="hidden"
    name="sessionId"
    value={sessionIdToRevoke ?? ''}
  />
</form>

<form
  id="revoke-others-form"
  method="POST"
  action="?/revokeOtherSessions"
  style:display="none"
  use:enhance={() => {
    sessionBusy = true;
    sessionError = null;
    sessionMessage = null;

    return async ({ result }) => {
      if (result.type === 'success') {
        // "Sign out everywhere" = revoke others (safe, keeps this cookie valid)
        // then sign this session out, so no stale cookie is left behind.
        if (signOutAfterRevoke) {
          try {
            await signOut();
          } catch (error) {
            // This device's session and cookie are still live, so navigating
            // to the login page would claim an "everywhere" sign-out that did
            // not happen. Stay put and surface the failure instead.
            clientLogger.error('Sign out failed:', error);
            sessionBusy = false;
            signOutAfterRevoke = false;
            sessionError =
              'Other devices were signed out, but this device could not be signed out. Try again.';
            await invalidateAll();
            return;
          }
          window.location.href = '/auth/login';
          return;
        }

        sessionBusy = false;
        sessionMessage = readFormMessage(result.data, 'Signed out of all other devices.');
        await invalidateAll();
        return;
      }

      sessionBusy = false;
      signOutAfterRevoke = false;

      if (result.type === 'failure') {
        sessionError = readFormError(result.data, 'Other devices could not be signed out.');
      } else {
        sessionError = 'An unexpected error occurred.';
      }
    };
  }}
></form>

{#if sessionPendingRevoke}
  <ConfirmModal
    show={sessionIdToRevoke !== null}
    title="Revoke this session?"
    confirmText="Revoke"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={confirmRevokeSession}
    onCancel={() => (sessionIdToRevoke = null)}
  >
    <p class="mb-4 text-foreground">
      The browser using this session will be signed out immediately and will need to sign in again.
    </p>
    <p class="text-sm break-all text-muted-foreground">
      {sessionPendingRevoke.userAgent ?? 'Unknown device'}
      {#if sessionPendingRevoke.ipAddress}
        &middot; {sessionPendingRevoke.ipAddress}
      {/if}
    </p>
  </ConfirmModal>
{/if}

{#if showRevokeOthersConfirm}
  <ConfirmModal
    show={showRevokeOthersConfirm}
    title="Sign out other devices?"
    confirmText="Sign out others"
    cancelText="Cancel"
    confirmVariant="warning"
    onConfirm={confirmRevokeOthers}
    onCancel={() => (showRevokeOthersConfirm = false)}
  >
    <p class="text-foreground">
      This signs out every other browser signed in to this account ({otherSessionCount}
      {otherSessionCount === 1 ? 'session' : 'sessions'}). You will stay signed in here.
    </p>
  </ConfirmModal>
{/if}

{#if showSignOutEverywhereConfirm}
  <ConfirmModal
    show={showSignOutEverywhereConfirm}
    title="Sign out everywhere?"
    confirmText="Sign out everywhere"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={confirmSignOutEverywhere}
    onCancel={() => (showSignOutEverywhereConfirm = false)}
  >
    <p class="mb-4 text-foreground">
      This ends every session on the account, including this one — you will be signed out here too
      and returned to the login page.
    </p>
    <Info variant="error">You will need to sign in again on every device.</Info>
  </ConfirmModal>
{/if}
