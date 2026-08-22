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
  import { Button, Chip, Toggle, Tooltip } from '$lib/components/ui';
  import OverflowMenu, { type OverflowMenuItem } from '$lib/components/ui/OverflowMenu.svelte';
  import type { ScheduleRunOutcome, ScheduleSummary } from '$lib/types/schedules';
  import { OUTCOME_LABELS, outcomeDotClass, outcomeTextClass } from '$lib/utils/scheduleOutcome';
  import {
    formatPastTime,
    formatUpcomingTime,
    formatZonedTime,
    zonesShareOffset,
  } from '$lib/utils/relativeTime';

  interface Props {
    schedule: ScheduleSummary;
    now: number;
    mounted: boolean;
    running: boolean;
    editorLoading: boolean;
    onToggleStatus: (checked: boolean) => void;
    onRunNow: () => void;
    onEdit: () => void;
    onHistory: () => void;
    onDelete: () => void;
  }

  const {
    schedule,
    now,
    mounted,
    running,
    editorLoading,
    onToggleStatus,
    onRunNow,
    onEdit,
    onHistory,
    onDelete,
  }: Props = $props();

  const menuItems = $derived<OverflowMenuItem[]>([
    { label: 'Edit', onSelect: onEdit },
    { label: 'History', onSelect: onHistory },
    { label: 'Delete', onSelect: onDelete, variant: 'danger' },
  ]);

  // guarded on `mounted`: SSR never reaches this branch,
  // so Intl's local-timezone lookup never runs during render.
  const viewerTimeZone = $derived(
    mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  );

  type TimeCellDisplay =
    | { kind: 'placeholder' }
    | { kind: 'empty' }
    | { kind: 'value'; humanized: string; exact: string; iso: string; toneClass: string };

  const nextRunDisplay = $derived.by<TimeCellDisplay>(() => {
    if (!mounted) {
      return { kind: 'placeholder' };
    }
    const next = schedule.nextOccurrenceAt;
    if (next === null) {
      return { kind: 'empty' };
    }
    const iso = new Date(next).toISOString();
    const exact = new Date(next).toLocaleString();
    if (next < now) {
      return {
        kind: 'value',
        humanized: `Overdue — was due ${formatPastTime(next, now)}`,
        exact,
        iso,
        toneClass: 'text-warning',
      };
    }
    const humanized = zonesShareOffset(viewerTimeZone, schedule.timezone, next)
      ? formatUpcomingTime(next, now)
      : formatZonedTime(next, schedule.timezone);
    return { kind: 'value', humanized, exact, iso, toneClass: '' };
  });

  type LastRunDisplay =
    | { kind: 'placeholder' }
    | { kind: 'never' }
    | {
        kind: 'failed' | 'normal';
        outcome: ScheduleRunOutcome;
        humanizedTime: string;
        exact: string;
        iso: string;
      };

  const lastRunDisplay = $derived.by<LastRunDisplay>(() => {
    if (!mounted) {
      return { kind: 'placeholder' };
    }
    const run = schedule.latestRun;
    if (!run) {
      return { kind: 'never' };
    }
    return {
      kind: run.outcome === 'launch_failed' ? 'failed' : 'normal',
      outcome: run.outcome,
      humanizedTime: formatPastTime(run.createdAt, now),
      exact: new Date(run.createdAt).toLocaleString(),
      iso: new Date(run.createdAt).toISOString(),
    };
  });
</script>

{#snippet timeValue(humanized: string, exact: string, iso: string, toneClass: string)}
  <span class="hidden @2xl:inline">
    <Tooltip content={exact}>
      <!-- Focusable by design: Tooltip shows on focus, giving keyboard users
           the exact timestamp without a hover-only affordance. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <time
        datetime={iso}
        tabindex="0"
        class="cursor-help {toneClass}">{humanized}</time
      >
    </Tooltip>
  </span>
  <span class="@2xl:hidden {toneClass}">{humanized}</span>
  <span class="block text-[11px] text-muted-foreground @2xl:hidden">{exact}</span>
{/snippet}

{#snippet nextRunCell()}
  <p class="text-xs text-muted-foreground">
    <span class="font-medium">Next run</span>
    <span aria-hidden="true"> · </span>
    {#if nextRunDisplay.kind === 'placeholder'}
      <span>—</span>
    {:else if nextRunDisplay.kind === 'empty'}
      <span aria-hidden="true">—</span><span class="sr-only">No upcoming run</span>
    {:else}
      {@render timeValue(
        nextRunDisplay.humanized,
        nextRunDisplay.exact,
        nextRunDisplay.iso,
        nextRunDisplay.toneClass,
      )}
    {/if}
  </p>
{/snippet}

{#snippet lastRunCell()}
  <p class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
    <span class="font-medium">Last run</span>
    <span aria-hidden="true">·</span>
    {#if lastRunDisplay.kind === 'placeholder'}
      <span>—</span>
    {:else if lastRunDisplay.kind === 'never'}
      <span>Never run</span>
    {:else if lastRunDisplay.kind === 'failed'}
      <Chip
        label={OUTCOME_LABELS.launch_failed}
        variant="danger"
        size="sm"
        ariaLabel={`Run outcome: ${OUTCOME_LABELS.launch_failed}`}
      />
      {@render timeValue(
        lastRunDisplay.humanizedTime,
        lastRunDisplay.exact,
        lastRunDisplay.iso,
        '',
      )}
    {:else}
      <span
        class="h-3 w-3 flex-shrink-0 rounded-full {outcomeDotClass(lastRunDisplay.outcome)}"
        aria-hidden="true"
      ></span>
      <span class={outcomeTextClass(lastRunDisplay.outcome)}>
        {OUTCOME_LABELS[lastRunDisplay.outcome]}
      </span>
      {@render timeValue(
        lastRunDisplay.humanizedTime,
        lastRunDisplay.exact,
        lastRunDisplay.iso,
        '',
      )}
    {/if}
  </p>
{/snippet}

{#snippet statusSlot()}
  <div class="flex min-w-28 items-center">
    {#if schedule.status === 'completed'}
      <span class="text-sm font-medium text-muted-foreground">Completed</span>
    {:else}
      <Toggle
        checked={schedule.status === 'active'}
        label={schedule.status === 'active' ? 'Active' : 'Paused'}
        ariaLabel={`Schedule ${schedule.name} active`}
        variant="primary"
        size="default"
        onchange={onToggleStatus}
      />
    {/if}
  </div>
{/snippet}

{#snippet runNowButton()}
  <Button
    size="sm"
    variant="outline-primary"
    onclick={onRunNow}
    loading={running}
    disabled={running}
  >
    Run now
  </Button>
{/snippet}

{#snippet overflowMenu()}
  <OverflowMenu
    items={menuItems}
    ariaLabel={`Actions for ${schedule.name}`}
    busy={editorLoading}
  />
{/snippet}

<div class="data-list-item">
  <div class="grid grid-cols-1 items-center gap-x-4 gap-y-3 @2xl:grid-cols-[minmax(0,1fr)_auto]">
    <h3
      class="col-start-1 row-start-1 min-w-0 truncate text-base font-medium text-primary @2xl:col-start-1 @2xl:row-start-1"
    >
      {schedule.name}
    </h3>

    <div
      class="col-start-1 row-start-3 flex flex-wrap items-center gap-3 @2xl:col-start-2 @2xl:row-start-1 @2xl:justify-end"
    >
      {@render statusSlot()}
      {@render runNowButton()}
      {@render overflowMenu()}
    </div>

    <div class="col-start-1 row-start-2 min-w-0 @2xl:col-span-2 @2xl:row-start-2">
      <div
        class="flex flex-col gap-1 @2xl:grid @2xl:grid-cols-[minmax(0,1fr)_14rem_14rem] @2xl:items-baseline @2xl:gap-4"
      >
        <p class="text-sm text-foreground">{schedule.recurrenceSummary}</p>
        {@render nextRunCell()}
        {@render lastRunCell()}
      </div>
    </div>
  </div>
</div>
