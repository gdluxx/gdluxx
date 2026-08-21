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
  import { untrack } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { Button, Field, Info, Modal } from '$lib/components/ui';
  import type {
    MaskedOptionValue,
    MisfirePolicy,
    Recurrence,
    ScheduleDetail,
    SchedulePreviewResponse,
  } from '$lib/types/schedules';
  import type { Conflict, OptionWithSource, SiteConfigData } from '$lib/types/command-form';
  import { getEmptyValueOptions, SENSITIVE_MASK } from '$lib/utils/commandOptions';
  import { parseUrls } from '$lib/utils/parseUrls';
  import OptionsManager from '../OptionsManager.svelte';

  interface Props {
    show: boolean;
    schedule: ScheduleDetail | null;
    seedUrls?: string[];
    seedUserOptions?: Array<[string, string | number | boolean]>;
    seedExcludedOptions?: string[];
    onSaved: (schedule: ScheduleDetail) => void;
    onCancel: () => void;
  }

  const {
    show,
    schedule,
    seedUrls,
    seedUserOptions,
    seedExcludedOptions,
    onSaved,
    onCancel,
  }: Props = $props();

  const FORM_ID = 'schedule-editor-form';

  // Mirrors schedules-validation.ts's MIN_INTERVAL_MINUTES; duplicated because
  // $lib/server modules cannot be imported from client-bundled components.
  const MIN_INTERVAL_MINUTES = 5;

  type IntervalUnit = 'minutes' | 'hours';

  const WEEKDAY_OPTIONS: Array<{ day: number; label: string }> = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 7, label: 'Sun' },
  ];

  let name = $state('');
  let timezone = $state('');
  let startDate = $state('');
  let endDate = $state<string | null>(null);
  let misfirePolicy = $state<MisfirePolicy>('skip');

  let recurrenceKind = $state<Recurrence['kind']>('once');
  let time = $state('09:00');
  let intervalUnit = $state<IntervalUnit>('hours');
  let intervalEvery = $state(1);
  let weekdays = $state<Set<number>>(new Set());
  let dayOfMonth = $state(1);

  let urlsText = $state('');

  let selectedOptions = $state(new Map<string, OptionWithSource>());
  let conflicts = $state<Conflict[]>([]);
  let conflictWarnings = $state(new Map<string, string>());
  let dismissedSiteRuleOptions = $state(new Set<string>());
  let untouchedSensitiveIds = $state(new Set<string>());

  let isSaving = $state(false);
  let saveError = $state<string | null>(null);

  let previewOccurrences = $state<number[]>([]);
  let previewSummary = $state('');
  let previewRequestId = 0;

  let siteRuleMatches = $state<SiteConfigData[]>([]);
  let siteRuleRequestId = 0;

  const emptyValueOptionIds = $derived(
    new Set(getEmptyValueOptions(selectedOptions).map((option) => option.id)),
  );
  const parsedUrls = $derived(parseUrls(urlsText));
  const saveDisabled = $derived(
    isSaving ||
      emptyValueOptionIds.size > 0 ||
      parsedUrls.length === 0 ||
      name.trim().length === 0 ||
      (recurrenceKind === 'weekly' && weekdays.size === 0) ||
      (recurrenceKind === 'interval' && (!Number.isFinite(intervalEvery) || intervalEvery < 1)),
  );

  function isMaskedValue(value: MaskedOptionValue): value is { sensitive: true; hasValue: true } {
    return typeof value === 'object' && value !== null && 'sensitive' in value;
  }

  function todayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function hydrateRecurrence(recurrence: Recurrence) {
    recurrenceKind = recurrence.kind;
    time = recurrence.time;
    intervalUnit = recurrence.kind === 'interval' ? recurrence.unit : 'hours';
    intervalEvery = recurrence.kind === 'interval' ? recurrence.every : 1;
    weekdays = recurrence.kind === 'weekly' ? new SvelteSet(recurrence.weekdays) : new SvelteSet();
    dayOfMonth = recurrence.kind === 'monthly' ? recurrence.dayOfMonth : 1;
  }

  function seedForm(): void {
    saveError = null;
    isSaving = false;

    if (schedule) {
      name = schedule.name;
      timezone = schedule.timezone;
      startDate = schedule.startDate;
      endDate = schedule.endDate;
      misfirePolicy = schedule.misfirePolicy;
      hydrateRecurrence(schedule.recurrence);
      urlsText = schedule.commandSource.urls.join('\n');

      const nextSelected = new SvelteMap<string, OptionWithSource>();
      const nextUntouched = new SvelteSet<string>();
      for (const [id, value] of schedule.commandSource.userOptions) {
        if (isMaskedValue(value)) {
          nextSelected.set(id, { value: SENSITIVE_MASK, source: 'user' });
          nextUntouched.add(id);
        } else {
          nextSelected.set(id, { value, source: 'user' });
        }
      }
      selectedOptions = nextSelected;
      untouchedSensitiveIds = nextUntouched;
      dismissedSiteRuleOptions = new SvelteSet(schedule.commandSource.excludedOptions);
    } else {
      name = '';
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      startDate = todayDateString();
      endDate = null;
      misfirePolicy = 'skip';
      recurrenceKind = 'once';
      time = '09:00';
      intervalUnit = 'hours';
      intervalEvery = 1;
      weekdays = new SvelteSet();
      dayOfMonth = 1;
      urlsText = (seedUrls ?? []).join('\n');

      const nextSelected = new SvelteMap<string, OptionWithSource>();
      for (const [id, value] of seedUserOptions ?? []) {
        nextSelected.set(id, { value, source: 'user' });
      }
      selectedOptions = nextSelected;
      untouchedSensitiveIds = new SvelteSet();
      dismissedSiteRuleOptions = new SvelteSet(seedExcludedOptions ?? []);
    }

    conflicts = [];
    conflictWarnings = new SvelteMap();
    previewOccurrences = [];
    previewSummary = '';
    siteRuleMatches = [];
  }

  // Re-seed whenever the dialog opens on a (possibly different) schedule, so a
  // second Edit never shows the previous schedule's data. Only `show` and
  // `schedule?.id` are tracked dependencies; the rest of the read happens
  // inside untrack so unrelated reference changes on `schedule` don't re-fire.
  $effect(() => {
    const key = show ? (schedule?.id ?? 'new') : null;
    if (key === null) {
      return;
    }
    untrack(seedForm);
  });

  // 'once' schedules cannot carry an end date.
  $effect(() => {
    if (recurrenceKind === 'once' && endDate !== null) {
      endDate = null;
    }
  });

  // A value that drifted away from the mask sentinel means the user edited
  // it; stop treating it as untouched so the real value reaches the payload.
  $effect(() => {
    const drifted: string[] = [];
    for (const id of untouchedSensitiveIds) {
      const current = selectedOptions.get(id);
      if (current?.value !== SENSITIVE_MASK) {
        drifted.push(id);
      }
    }
    if (drifted.length > 0) {
      const next = new SvelteSet(untouchedSensitiveIds);
      for (const id of drifted) {
        next.delete(id);
      }
      untouchedSensitiveIds = next;
    }
  });

  function buildRecurrence(): Recurrence {
    switch (recurrenceKind) {
      case 'once':
        return { kind: 'once', time };
      case 'interval':
        return { kind: 'interval', time, unit: intervalUnit, every: intervalEvery };
      case 'daily':
        return { kind: 'daily', time };
      case 'weekly':
        return { kind: 'weekly', time, weekdays: Array.from(weekdays) };
      case 'monthly':
        return { kind: 'monthly', time, dayOfMonth };
    }
  }

  function toggleWeekday(day: number) {
    const next = new SvelteSet(weekdays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    weekdays = next;
  }

  async function fetchPreview(body: {
    recurrence: Recurrence;
    timezone: string;
    startDate: string;
    endDate?: string;
  }): Promise<SchedulePreviewResponse | null> {
    const response = await fetch('/api/schedules/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return null;
    }
    const envelope = await response.json();
    return envelope.success ? (envelope.data as SchedulePreviewResponse) : null;
  }

  $effect(() => {
    if (!show) {
      return;
    }
    const recurrence = buildRecurrence();
    const tz = timezone;
    const sd = startDate;
    const ed = endDate;

    if (!sd || !tz) {
      previewOccurrences = [];
      previewSummary = '';
      return;
    }

    const timer = setTimeout(() => {
      const requestId = ++previewRequestId;
      void fetchPreview({ recurrence, timezone: tz, startDate: sd, endDate: ed ?? undefined })
        .then((result) => {
          if (requestId !== previewRequestId) {
            return;
          }
          previewOccurrences = result?.occurrences ?? [];
          previewSummary = result?.recurrenceSummary ?? '';
        })
        .catch(() => {
          if (requestId !== previewRequestId) {
            return;
          }
          previewOccurrences = [];
          previewSummary = '';
        });
    }, 400);

    return () => clearTimeout(timer);
  });

  function formatOccurrence(ms: number): string {
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(ms));
    } catch {
      return new Date(ms).toISOString();
    }
  }

  async function fetchSiteRuleMatches(urls: string[]): Promise<SiteConfigData[]> {
    const response = await fetch('/api/site-configs/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
    if (!response.ok) {
      return [];
    }
    const envelope = await response.json();
    return envelope.success ? (envelope.data as SiteConfigData[]) : [];
  }

  $effect(() => {
    if (!show) {
      return;
    }
    const urls = parsedUrls;
    if (urls.length === 0) {
      siteRuleMatches = [];
      return;
    }

    const timer = setTimeout(() => {
      const requestId = ++siteRuleRequestId;
      void fetchSiteRuleMatches(urls)
        .then((matches) => {
          if (requestId === siteRuleRequestId) {
            siteRuleMatches = matches;
          }
        })
        .catch(() => {
          if (requestId === siteRuleRequestId) {
            siteRuleMatches = [];
          }
        });
    }, 450);

    return () => clearTimeout(timer);
  });

  function buildUserOptionsPayload(): Array<[string, string | number | boolean | { keep: true }]> {
    const payload: Array<[string, string | number | boolean | { keep: true }]> = [];
    for (const [id, data] of selectedOptions) {
      if (untouchedSensitiveIds.has(id)) {
        payload.push([id, { keep: true }]);
        continue;
      }
      // Fail closed: the mask sentinel can never be persisted as a real
      // value, even if this id somehow fell out of untouchedSensitiveIds.
      if (data.value === SENSITIVE_MASK) {
        payload.push([id, { keep: true }]);
        continue;
      }
      payload.push([id, data.value]);
    }
    return payload;
  }

  async function handleSave() {
    if (saveDisabled) {
      return;
    }
    isSaving = true;
    saveError = null;

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        timezone,
        recurrence: buildRecurrence(),
        startDate,
        misfirePolicy,
        commandSource: {
          urls: parsedUrls,
          userOptions: buildUserOptionsPayload(),
          excludedOptions: Array.from(dismissedSiteRuleOptions),
        },
      };

      if (schedule) {
        // PUT is a full re-representation of the form; an explicit null
        // clears the end date rather than leaving it untouched.
        body.endDate = endDate;
      } else if (endDate !== null) {
        body.endDate = endDate;
      }

      const url = schedule ? `/api/schedules/${schedule.id}` : '/api/schedules';
      const method = schedule ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const envelope = await response.json();

      if (!response.ok || !envelope.success) {
        saveError = envelope.error ?? 'Failed to save schedule.';
        return;
      }

      onSaved(envelope.data as ScheduleDetail);
    } catch (error) {
      saveError = error instanceof Error ? error.message : 'An unexpected error occurred.';
    } finally {
      isSaving = false;
    }
  }

  async function handleSubmitForm(event: SubmitEvent) {
    event.preventDefault();
    await handleSave();
  }
</script>

<Modal
  {show}
  size="xl"
  onClose={onCancel}
>
  {#snippet header()}
    <div class="border-b-strong px-6 py-4 pr-14">
      <h2 class="cursor-default text-xl font-bold text-primary">
        {schedule ? 'Edit' : 'New'} schedule
      </h2>
    </div>
  {/snippet}

  <form
    id={FORM_ID}
    onsubmit={handleSubmitForm}
    class="space-y-6 p-6"
  >
    <Field
      label="Name"
      required
      id="schedule-editor-name"
    >
      {#snippet control({ id })}
        <input
          {id}
          type="text"
          bind:value={name}
          placeholder="e.g. Nightly backup"
          autocomplete="off"
          class="form-input"
        />
      {/snippet}
    </Field>

    <Field
      label="Recurrence"
      id="schedule-editor-kind"
    >
      {#snippet control({ id })}
        <select
          {id}
          bind:value={recurrenceKind}
          class="form-select"
        >
          <option value="once">Once</option>
          <option value="interval">Interval</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      {/snippet}
    </Field>

    <Field
      label="Time"
      id="schedule-editor-time"
      description={recurrenceKind === 'interval'
        ? 'Anchors the first occurrence on the start date; the interval then repeats from that instant — this is not a daily time-of-day.'
        : undefined}
    >
      {#snippet control({ id })}
        <input
          {id}
          type="time"
          bind:value={time}
          class="form-input"
        />
      {/snippet}
    </Field>

    {#if recurrenceKind === 'interval'}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Every"
          id="schedule-editor-every"
          description={`Minimum total interval is ${MIN_INTERVAL_MINUTES} minutes.`}
        >
          {#snippet control({ id })}
            <input
              {id}
              type="number"
              min={intervalUnit === 'minutes' ? MIN_INTERVAL_MINUTES : 1}
              bind:value={intervalEvery}
              class="form-input"
            />
          {/snippet}
        </Field>
        <Field
          label="Unit"
          id="schedule-editor-unit"
        >
          {#snippet control({ id })}
            <select
              {id}
              bind:value={intervalUnit}
              class="form-select"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          {/snippet}
        </Field>
      </div>
    {/if}

    {#if recurrenceKind === 'weekly'}
      <Field
        label="Days of week"
        required
        id="schedule-editor-weekdays"
      >
        {#snippet control({ id })}
          <div
            {id}
            class="flex flex-wrap gap-2"
            role="group"
            aria-label="Days of week"
          >
            {#each WEEKDAY_OPTIONS as option (option.day)}
              <button
                type="button"
                onclick={() => toggleWeekday(option.day)}
                aria-pressed={weekdays.has(option.day)}
                class="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
                class:bg-primary={weekdays.has(option.day)}
                class:text-on-primary={weekdays.has(option.day)}
                class:border-primary={weekdays.has(option.day)}
                class:bg-surface={!weekdays.has(option.day)}
                class:text-foreground={!weekdays.has(option.day)}
                class:border-strong={!weekdays.has(option.day)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        {/snippet}
      </Field>
    {/if}

    {#if recurrenceKind === 'monthly'}
      <Field
        label="Day of month"
        id="schedule-editor-day-of-month"
        description="Months shorter than this day use their last day instead."
      >
        {#snippet control({ id })}
          <input
            {id}
            type="number"
            min="1"
            max="31"
            bind:value={dayOfMonth}
            class="form-input"
          />
        {/snippet}
      </Field>
    {/if}

    <Field
      label="Timezone"
      id="schedule-editor-timezone"
      description="Defaults to your browser's timezone."
    >
      {#snippet control({ id })}
        <input
          {id}
          type="text"
          bind:value={timezone}
          autocomplete="off"
          class="form-input"
        />
      {/snippet}
    </Field>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Start date"
        required
        id="schedule-editor-start-date"
      >
        {#snippet control({ id })}
          <input
            {id}
            type="date"
            bind:value={startDate}
            class="form-input"
          />
        {/snippet}
      </Field>

      <div>
        <span class="mb-1 block text-sm font-medium text-foreground">End date</span>
        {#if recurrenceKind === 'once'}
          <p class="text-xs text-muted-foreground">Not available for a one-time schedule.</p>
        {:else if endDate === null}
          <Button
            type="button"
            variant="outline-primary"
            size="sm"
            onclick={() => (endDate = startDate)}
          >
            Add end date
          </Button>
        {:else}
          <div class="flex items-center gap-2">
            <input
              type="date"
              bind:value={endDate}
              class="form-input"
            />
            <Button
              type="button"
              variant="outline-danger"
              size="sm"
              onclick={() => (endDate = null)}
            >
              Clear
            </Button>
          </div>
        {/if}
      </div>
    </div>

    <Field
      label="On misfire"
      id="schedule-editor-misfire"
      description="What happens to occurrences missed while the server was down."
    >
      {#snippet control({ id })}
        <select
          {id}
          bind:value={misfirePolicy}
          class="form-select"
        >
          <option value="skip">Skip missed occurrences</option>
          <option value="catch_up">Catch up (run once)</option>
        </select>
      {/snippet}
    </Field>

    <div class="rounded-sm bg-surface p-4 border-strong">
      <p class="mb-2 text-sm font-medium text-foreground">
        {previewSummary || 'Recurrence preview'}
      </p>
      {#if previewOccurrences.length > 0}
        <ul class="space-y-1 text-sm text-muted-foreground">
          {#each previewOccurrences as occurrence (occurrence)}
            <li>{formatOccurrence(occurrence)}</li>
          {/each}
        </ul>
      {:else}
        <p class="text-sm text-muted-foreground">No upcoming occurrences</p>
      {/if}
    </div>

    <div>
      <label
        for="schedule-editor-urls"
        class="mb-2 block text-sm font-medium text-foreground"
      >
        URL(s) <span class="text-xs text-muted-foreground">
          (one per line or space-separated)
        </span>
      </label>
      <textarea
        id="schedule-editor-urls"
        bind:value={urlsText}
        placeholder="https://example.com/gallery1&#10;https://example.com/image.jpg https://othersite.com/album"
        autocomplete="off"
        rows="5"
        class="form-textarea"></textarea>
    </div>

    <!-- Site-rule note (informational only; no conflict interstitial) -->
    {#if siteRuleMatches.length > 0}
      <Info
        variant="info"
        title="Site rules matched"
      >
        <p class="mb-2 text-xs text-muted-foreground">
          Matched rules are frozen into the schedule when you save, and re-frozen whenever the
          command's URLs or options change.
        </p>
        <ul class="space-y-1 text-sm text-foreground">
          {#each siteRuleMatches as match (match.url)}
            <li>{match.configName ?? match.matchedPattern} — {match.url}</li>
          {/each}
        </ul>
      </Info>
    {/if}

    <OptionsManager
      bind:selectedOptions
      bind:conflicts
      bind:conflictWarnings
      bind:dismissedSiteRuleOptions
      siteConfigData={[]}
      userWarningSetting={false}
      showSubmit={false}
      showSaveAsSiteRule={false}
      idPrefix="schedule-editor-option"
      commandUrlsInput={urlsText}
      {emptyValueOptionIds}
    />

    <Info
      variant="warning"
      title="Stored for unattended execution"
    >
      Option values entered here — including any credentials — are stored on the server so this
      schedule can run without you present. Job output from scheduled runs is visible to every user
      of this instance.
    </Info>

    {#if saveError}
      <Info
        variant="error"
        dismissible
        onDismiss={() => (saveError = null)}
      >
        {saveError}
      </Info>
    {/if}
  </form>

  {#snippet footer()}
    <div class="flex items-center justify-end gap-3 border-t-strong px-6 py-4">
      <Button
        type="button"
        onclick={onCancel}
        variant="default"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form={FORM_ID}
        disabled={saveDisabled}
        variant="primary"
      >
        {isSaving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  {/snippet}
</Modal>
