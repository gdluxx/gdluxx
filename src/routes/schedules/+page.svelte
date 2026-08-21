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
  import {
    PageLayout,
    Button,
    Chip,
    Modal,
    ConfirmModal,
    Toggle,
    Spinner,
    EmptyState,
    Info,
  } from '$lib/components/ui';
  import { SvelteSet } from 'svelte/reactivity';
  import ScheduleEditor from '$lib/components/schedules/ScheduleEditor.svelte';
  import { toastStore } from '$lib/stores/toast';
  import type { PageData } from './$types';
  import type {
    ScheduleSummary,
    ScheduleDetail,
    ScheduleRunItem,
    ScheduleRunResponse,
    ScheduleStatus,
    ScheduleRunOutcome,
  } from '$lib/types/schedules';

  const { data } = $props<{ data: PageData }>();

  // Writable $derived: seeded from the server load, reassignable afterward by
  // mutations below without losing sync if the load data ever changes.
  let schedules = $derived<ScheduleSummary[]>(data.schedules ?? []);

  let showEditor = $state(false);
  let editingSchedule = $state<ScheduleDetail | null>(null);
  let editorLoadingId = $state<string | null>(null);

  let showDeleteConfirm = $state(false);
  let scheduleToDelete = $state<ScheduleSummary | null>(null);

  const runningIds = new SvelteSet<string>();

  let showHistoryModal = $state(false);
  let historySchedule = $state<ScheduleSummary | null>(null);
  let historyRuns = $state<ScheduleRunItem[]>([]);
  let historyLoading = $state(false);

  function formatTimestamp(ms: number | null): string {
    return ms === null ? 'Never' : new Date(ms).toLocaleString();
  }

  const OUTCOME_LABELS: Record<ScheduleRunOutcome, string> = {
    dispatching: 'Dispatching',
    launched: 'Launched',
    partial: 'Partial',
    launch_failed: 'Launch failed',
    skipped_overlap: 'Skipped (overlap)',
    skipped_misfire: 'Skipped (misfire)',
  };

  const OUTCOME_VARIANTS: Record<ScheduleRunOutcome, 'success' | 'warning' | 'danger' | 'info'> = {
    dispatching: 'info',
    launched: 'success',
    partial: 'warning',
    launch_failed: 'danger',
    skipped_overlap: 'warning',
    skipped_misfire: 'warning',
  };

  const TRIGGER_LABELS: Record<ScheduleRunItem['trigger'], string> = {
    scheduled: 'Scheduled',
    catch_up: 'Catch-up',
    manual: 'Manual',
    recovery: 'Recovery',
  };

  const STATUS_LABELS: Record<ScheduleStatus, string> = {
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
  };

  const STATUS_VARIANTS: Record<ScheduleStatus, 'success' | 'warning' | 'info'> = {
    active: 'success',
    paused: 'warning',
    completed: 'info',
  };

  async function refreshList(): Promise<void> {
    try {
      const response = await fetch('/api/schedules');
      const payload = await response.json();
      if (payload.success && Array.isArray(payload.data)) {
        schedules = payload.data as ScheduleSummary[];
      }
    } catch (err) {
      toastStore.error(
        'Refresh failed',
        err instanceof Error ? err.message : 'Failed to refresh schedules',
      );
    }
  }

  function openCreateModal(): void {
    editingSchedule = null;
    showEditor = true;
  }

  let editRequestId = 0;

  async function openEditModal(schedule: ScheduleSummary): Promise<void> {
    const requestId = ++editRequestId;
    editorLoadingId = schedule.id;
    try {
      const response = await fetch(`/api/schedules/${schedule.id}`);
      const payload = await response.json();
      if (requestId !== editRequestId) {
        return;
      }
      if (payload.success && payload.data) {
        editingSchedule = payload.data as ScheduleDetail;
        showEditor = true;
      } else {
        toastStore.error('Load failed', payload.error ?? 'Failed to load schedule');
      }
    } catch (err) {
      if (requestId === editRequestId) {
        toastStore.error('Load failed', err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (requestId === editRequestId) {
        editorLoadingId = null;
      }
    }
  }

  function closeEditor(): void {
    showEditor = false;
    editingSchedule = null;
  }

  function handleSaved(): void {
    showEditor = false;
    editingSchedule = null;
    toastStore.success('Success', 'Schedule saved successfully');
    void refreshList();
  }

  async function handleToggleStatus(
    schedule: ScheduleSummary,
    nextChecked: boolean,
  ): Promise<void> {
    try {
      const response = await fetch(`/api/schedules/${schedule.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextChecked ? 'active' : 'paused' }),
      });
      const payload = await response.json();
      if (response.ok && payload.success && payload.data) {
        const detail = payload.data as ScheduleDetail;
        // Reassignment, not in-place mutation: `schedules` is a $derived and a
        // plain-array index write would never re-render the row.
        schedules = schedules.map((s) =>
          s.id === schedule.id
            ? {
                ...s,
                status: detail.status,
                nextOccurrenceAt: detail.nextOccurrenceAt,
                lastOccurrenceAt: detail.lastOccurrenceAt,
              }
            : s,
        );
        toastStore.success('Success', nextChecked ? 'Schedule resumed' : 'Schedule paused');
      } else {
        toastStore.error('Update failed', payload.error ?? 'Failed to update schedule');
      }
    } catch (err) {
      toastStore.error('Update failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handleRunNow(schedule: ScheduleSummary): Promise<void> {
    runningIds.add(schedule.id);
    try {
      const response = await fetch(`/api/schedules/${schedule.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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
          const firstError = result.results.find((r) => r.error)?.error;
          toastStore.error('Run failed', firstError ?? 'No URLs were launched.');
        }
        void refreshList();
      } else {
        toastStore.error('Run failed', payload.error ?? 'Failed to run schedule');
      }
    } catch (err) {
      toastStore.error('Run failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      runningIds.delete(schedule.id);
    }
  }

  function openDeleteConfirm(schedule: ScheduleSummary): void {
    scheduleToDelete = schedule;
    showDeleteConfirm = true;
  }

  function cancelDelete(): void {
    showDeleteConfirm = false;
    scheduleToDelete = null;
  }

  async function confirmDelete(): Promise<void> {
    if (!scheduleToDelete) {
      return;
    }
    try {
      const response = await fetch(`/api/schedules/${scheduleToDelete.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (payload.success) {
        schedules = schedules.filter((s) => s.id !== scheduleToDelete?.id);
        toastStore.success(
          'Success',
          'Schedule deleted. Run history and notifications are retained.',
        );
      } else {
        toastStore.error('Delete failed', payload.error ?? 'Failed to delete schedule');
      }
    } catch (err) {
      toastStore.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      cancelDelete();
    }
  }

  async function openHistory(schedule: ScheduleSummary): Promise<void> {
    historySchedule = schedule;
    showHistoryModal = true;
    historyLoading = true;
    historyRuns = [];
    try {
      const response = await fetch(`/api/schedules/${schedule.id}/runs?limit=25&offset=0`);
      const payload = await response.json();
      if (payload.success && payload.data) {
        historyRuns = payload.data.runs as ScheduleRunItem[];
      }
    } catch (err) {
      toastStore.error(
        'Load failed',
        err instanceof Error ? err.message : 'Failed to load run history',
      );
    } finally {
      historyLoading = false;
    }
  }

  function closeHistory(): void {
    showHistoryModal = false;
    historySchedule = null;
    historyRuns = [];
  }
</script>

{#snippet statusChip(status: ScheduleStatus)}
  <Chip
    label={STATUS_LABELS[status]}
    variant={STATUS_VARIANTS[status]}
    size="sm"
  />
{/snippet}

{#snippet lastRunInfo(schedule: ScheduleSummary)}
  {#if schedule.latestRun}
    <div class="flex flex-col gap-1">
      <Chip
        label={OUTCOME_LABELS[schedule.latestRun.outcome]}
        variant={OUTCOME_VARIANTS[schedule.latestRun.outcome]}
        size="sm"
      />
      <span class="text-xs text-muted-foreground">
        {formatTimestamp(schedule.latestRun.createdAt)}
      </span>
    </div>
  {:else}
    <span class="text-sm text-muted-foreground">Never run</span>
  {/if}
{/snippet}

{#snippet rowActions(schedule: ScheduleSummary)}
  <div class="flex flex-wrap items-center gap-2">
    <Toggle
      checked={schedule.status === 'active'}
      disabled={schedule.status === 'completed'}
      onchange={(checked) => handleToggleStatus(schedule, checked)}
      variant="primary"
      size="sm"
      ariaLabel={schedule.status === 'active' ? 'Pause schedule' : 'Resume schedule'}
    />
    <Button
      size="sm"
      variant="outline-primary"
      onclick={() => handleRunNow(schedule)}
      loading={runningIds.has(schedule.id)}
      disabled={runningIds.has(schedule.id)}
    >
      Run now
    </Button>
    <Button
      size="sm"
      variant="outline-primary"
      onclick={() => openEditModal(schedule)}
      loading={editorLoadingId === schedule.id}
      disabled={editorLoadingId === schedule.id}
    >
      Edit
    </Button>
    <Button
      size="sm"
      variant="outline-primary"
      onclick={() => openHistory(schedule)}
    >
      History
    </Button>
    <Button
      size="sm"
      variant="outline-danger"
      onclick={() => openDeleteConfirm(schedule)}
    >
      Delete
    </Button>
  </div>
{/snippet}

<PageLayout
  title="Schedules"
  description="Automate recurring gallery-dl downloads."
>
  {#snippet icon()}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle
        cx="12"
        cy="13"
        r="8"
      />
      <path d="M12 9v4l2.5 2.5M9 3h6" />
    </svg>
  {/snippet}

  <div class="cursor-default">
    <div class="data-list-header">
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm font-semibold text-accent-foreground">
          {schedules.length}
          {schedules.length === 1 ? 'schedule' : 'schedules'}
        </p>
        <Button
          onclick={openCreateModal}
          variant="primary"
          size="sm"
        >
          New schedule
        </Button>
      </div>
    </div>

    {#if schedules.length === 0}
      <EmptyState
        title="No schedules yet"
        description="Create a schedule to run gallery-dl commands automatically."
        class="py-12"
      >
        <Button
          onclick={openCreateModal}
          variant="primary"
          class="mt-4"
        >
          New schedule
        </Button>
      </EmptyState>
    {:else}
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead>
            <tr
              class="border-b-strong text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Recurrence</th>
              <th class="px-3 py-2">Next run</th>
              <th class="px-3 py-2">Last run</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each schedules as schedule (schedule.id)}
              <tr class="border-b-strong">
                <td class="px-3 py-3 font-medium text-primary">{schedule.name}</td>
                <td class="px-3 py-3">{@render statusChip(schedule.status)}</td>
                <td class="px-3 py-3 text-foreground">{schedule.recurrenceSummary}</td>
                <td class="px-3 py-3 text-foreground"
                  >{formatTimestamp(schedule.nextOccurrenceAt)}</td
                >
                <td class="px-3 py-3">{@render lastRunInfo(schedule)}</td>
                <td class="px-3 py-3">{@render rowActions(schedule)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="md:hidden">
        {#each schedules as schedule (schedule.id)}
          <div class="data-list-item">
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="text-base font-medium text-primary">{schedule.name}</h3>
              {@render statusChip(schedule.status)}
            </div>
            <p class="mb-1 text-sm text-foreground">{schedule.recurrenceSummary}</p>
            <p class="mb-1 text-xs text-muted-foreground">
              Next run: {formatTimestamp(schedule.nextOccurrenceAt)}
            </p>
            <div class="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              Last run: {@render lastRunInfo(schedule)}
            </div>
            {@render rowActions(schedule)}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <ScheduleEditor
    show={showEditor}
    schedule={editingSchedule}
    onSaved={handleSaved}
    onCancel={closeEditor}
  />

  <ConfirmModal
    show={showDeleteConfirm}
    title="Delete schedule?"
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={confirmDelete}
    onCancel={cancelDelete}
  >
    {#if scheduleToDelete}
      <p class="mb-4 leading-relaxed text-foreground">
        Are you sure you want to delete <strong>{scheduleToDelete.name}</strong>?
      </p>
      <Info variant="warning">
        Run history and notifications for this schedule are retained after deletion.
      </Info>
    {/if}
  </ConfirmModal>

  <Modal
    show={showHistoryModal}
    onClose={closeHistory}
    size="lg"
  >
    {#snippet header()}
      <div class="border-b-strong px-6 py-4 pr-14">
        <h2 class="text-xl font-bold text-primary">
          Run history{historySchedule ? ` — ${historySchedule.name}` : ''}
        </h2>
      </div>
    {/snippet}

    <div class="p-6">
      {#if historyLoading}
        <div class="flex justify-center py-8">
          <Spinner size={24} />
        </div>
      {:else if historyRuns.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">No runs yet.</p>
      {:else}
        <ul class="space-y-3">
          {#each historyRuns as run (run.id)}
            <li class="rounded-sm border-strong p-3">
              <div class="mb-1 flex items-center justify-between gap-2">
                <Chip
                  label={OUTCOME_LABELS[run.outcome]}
                  variant={OUTCOME_VARIANTS[run.outcome]}
                  size="sm"
                />
                <span class="text-xs text-muted-foreground"
                  >{formatTimestamp(run.scheduledFor)}</span
                >
              </div>
              <p class="text-xs text-muted-foreground">
                Trigger: {TRIGGER_LABELS[run.trigger]} &middot; Launched {run.launchedCount} of {run.urlCount}
                URL(s)
                {#if run.jobIds.length > 0}
                  &middot; {run.jobIds.length} job{run.jobIds.length === 1 ? '' : 's'}
                {/if}
              </p>
              {#if run.error}
                <p class="mt-1 text-xs text-error">{run.error}</p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </Modal>
</PageLayout>
