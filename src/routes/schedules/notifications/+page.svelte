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
  import { PageLayout, Button, Chip, ConfirmModal, Toggle, EmptyState } from '$lib/components/ui';
  import { SvelteSet } from 'svelte/reactivity';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { scheduleNotificationStore } from '$lib/stores/scheduleNotifications.svelte';
  import { toastStore } from '$lib/stores/toast';
  import type { PageData } from './$types';
  import type {
    ScheduleNotificationItem,
    ScheduleNotificationType,
    ScheduleRunResponse,
  } from '$lib/types/schedules';

  const { data } = $props<{ data: PageData }>();

  let showAcknowledged = $state(false);
  let showClearConfirm = $state(false);
  const runningIds = new SvelteSet<string>();

  const TYPE_LABELS: Record<ScheduleNotificationType, string> = {
    missed_skipped: 'Missed',
    missed_caught_up: 'Caught up',
    overlap_skipped: 'Overlap',
    launch_failed: 'Launch failed',
  };

  const TYPE_VARIANTS: Record<ScheduleNotificationType, 'warning' | 'info' | 'danger'> = {
    missed_skipped: 'warning',
    missed_caught_up: 'info',
    overlap_skipped: 'warning',
    launch_failed: 'danger',
  };

  const notifications = $derived(scheduleNotificationStore.notifications);

  const hasAcknowledged = $derived(notifications.some((n) => n.acknowledgedAt !== null));

  // Unread first, then newest first within each group.
  const visibleNotifications = $derived.by(() => {
    const base = showAcknowledged
      ? notifications
      : notifications.filter((n) => n.acknowledgedAt === null);
    return [...base].sort((a, b) => {
      const unreadA = a.acknowledgedAt === null ? 0 : 1;
      const unreadB = b.acknowledgedAt === null ? 0 : 1;
      if (unreadA !== unreadB) {
        return unreadA - unreadB;
      }
      return b.createdAt - a.createdAt;
    });
  });

  function formatTimestamp(ms: number | null): string {
    return ms === null ? 'Unknown' : new Date(ms).toLocaleString();
  }

  function formatRange(start: number | null, end: number | null): string {
    if (start === null && end === null) {
      return '';
    }
    if (start === null) {
      return formatTimestamp(end);
    }
    if (end === null || end === start) {
      return formatTimestamp(start);
    }
    return `${formatTimestamp(start)} – ${formatTimestamp(end)}`;
  }

  onMount(() => {
    scheduleNotificationStore.initializeWithNotifications(data.notifications ?? []);
  });

  async function handleAcknowledge(notification: ScheduleNotificationItem): Promise<void> {
    await scheduleNotificationStore.acknowledge(notification.id);
  }

  async function handleDelete(notification: ScheduleNotificationItem): Promise<void> {
    await scheduleNotificationStore.remove([notification.id]);
    toastStore.success('Success', 'Notification deleted');
  }

  function openClearConfirm(): void {
    showClearConfirm = true;
  }

  function cancelClear(): void {
    showClearConfirm = false;
  }

  async function confirmClear(): Promise<void> {
    await scheduleNotificationStore.clearAcknowledged();
    toastStore.success('Success', 'Acknowledged notifications cleared');
    showClearConfirm = false;
  }

  async function handleRunMissed(notification: ScheduleNotificationItem): Promise<void> {
    if (notification.scheduleId === null) {
      return;
    }
    const scheduleId = notification.scheduleId;
    runningIds.add(notification.id);
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notification.id }),
      });
      const payload = await response.json();
      if (response.status === 409) {
        toastStore.error(
          'Run blocked',
          payload.error ?? 'This schedule already has a run in progress.',
        );
        return;
      }
      if (payload.success && payload.data) {
        const result = payload.data as ScheduleRunResponse;
        const launchedCount = result.results.filter((r) => r.success).length;
        const totalCount = result.results.length;
        if (result.overallSuccess) {
          toastStore.success('Run started', `Launched ${launchedCount} of ${totalCount} URL(s).`);
        } else if (launchedCount > 0) {
          toastStore.warning(
            'Partially launched',
            `Launched ${launchedCount} of ${totalCount} URL(s).`,
          );
        } else {
          toastStore.error('Run failed', 'No URLs were launched.');
        }
        // The route only acknowledges the notification when the outcome is
        // 'launched'; refetch to reflect that server-side state change.
        await scheduleNotificationStore.loadList({ limit: 100 });
      } else {
        toastStore.error('Run failed', payload.error ?? 'Failed to run schedule');
      }
    } catch (err) {
      toastStore.error('Run failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      runningIds.delete(notification.id);
    }
  }
</script>

<PageLayout
  title="Notifications"
  description="Missed occurrences, overlaps, and launch failures for your schedules."
>
  {#snippet icon()}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M14.857 17.082a23.85 23.85 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  {/snippet}

  <div class="cursor-default">
    <div class="data-list-header">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Toggle
          checked={showAcknowledged}
          onchange={(checked) => (showAcknowledged = checked)}
          variant="primary"
          size="sm"
          label="Show acknowledged"
        />
        <Button
          onclick={openClearConfirm}
          variant="outline-danger"
          size="sm"
          disabled={!hasAcknowledged}
        >
          Clear acknowledged
        </Button>
      </div>
    </div>

    {#if visibleNotifications.length === 0}
      <EmptyState
        title="No notifications"
        description={showAcknowledged ? 'Nothing here yet.' : 'No unread notifications.'}
        class="py-12"
      />
    {:else}
      <ul>
        {#each visibleNotifications as notification (notification.id)}
          <li
            class="data-list-item"
            class:opacity-60={notification.acknowledgedAt !== null}
          >
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Chip
                  label={TYPE_LABELS[notification.type]}
                  variant={TYPE_VARIANTS[notification.type]}
                  size="sm"
                />
                {#if notification.scheduleId !== null}
                  <a
                    href={resolve('/schedules')}
                    class="text-sm font-medium text-primary hover:underline"
                  >
                    {notification.scheduleName}
                  </a>
                {:else}
                  <span class="text-sm font-medium text-foreground">
                    {notification.scheduleName}
                  </span>
                {/if}
              </div>
              <span class="text-xs text-muted-foreground">
                {formatTimestamp(notification.createdAt)}
              </span>
            </div>
            <p class="mb-3 text-sm text-muted-foreground">
              {notification.occurrenceCount}
              {notification.occurrenceCount === 1 ? 'occurrence' : 'occurrences'}
              {#if formatRange(notification.rangeStart, notification.rangeEnd)}
                &middot; {formatRange(notification.rangeStart, notification.rangeEnd)}
              {/if}
            </p>
            <div class="flex flex-wrap items-center gap-2">
              {#if notification.scheduleId !== null}
                <Button
                  size="sm"
                  variant="outline-primary"
                  onclick={() => handleRunMissed(notification)}
                  loading={runningIds.has(notification.id)}
                  disabled={runningIds.has(notification.id)}
                >
                  Run missed now
                </Button>
              {/if}
              {#if notification.acknowledgedAt === null}
                <Button
                  size="sm"
                  variant="outline-primary"
                  onclick={() => handleAcknowledge(notification)}
                >
                  Acknowledge
                </Button>
              {/if}
              <Button
                size="sm"
                variant="outline-danger"
                onclick={() => handleDelete(notification)}
              >
                Delete
              </Button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <ConfirmModal
    show={showClearConfirm}
    title="Clear acknowledged notifications?"
    confirmText="Clear"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={confirmClear}
    onCancel={cancelClear}
  >
    <p class="text-foreground">This permanently deletes every acknowledged notification.</p>
  </ConfirmModal>
</PageLayout>
