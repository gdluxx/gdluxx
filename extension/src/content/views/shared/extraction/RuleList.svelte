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
  import { Button, Icon } from '#components/ui';
  import RuleRow from './RuleRow.svelte';
  import { createSubRule, validateRegexPattern, type SubRule } from '#utils/substitution';
  import { SvelteSet } from 'svelte/reactivity';
  import { MAX_RULES_PER_PROFILE } from '#utils/storageExtractionProfiles';

  interface RuleListProps {
    rules?: SubRule[];
    selectedCount?: number;
    modifiedCount?: number;
    onapply?: () => void;
    onreset?: () => void;
    onshowregexhelp?: () => void;
  }

  let {
    rules = $bindable<SubRule[]>([]),
    selectedCount = 0,
    modifiedCount = 0,
    onapply,
    onreset,
    onshowregexhelp,
  }: RuleListProps = $props();

  let validationErrors = $state<Record<string, string>>({});
  const touchedRules = new SvelteSet<string>();
  const canAddMoreRules = $derived(rules.length < MAX_RULES_PER_PROFILE);

  const hasUsableRule = $derived(rules.some((r) => r.enabled && r.pattern.trim().length > 0));
  const hasAnyPattern = $derived(rules.some((r) => r.pattern.trim().length > 0));
  const canApply = $derived(selectedCount > 0 && hasUsableRule);
  const canReset = $derived(modifiedCount > 0);

  const applyLabel = $derived(
    selectedCount > 0 ? `Apply to ${selectedCount} selected` : 'Apply to selected',
  );

  const applyHint = $derived.by(() => {
    if (!hasUsableRule && selectedCount === 0) {
      return hasAnyPattern
        ? 'Enable a substitution rule and select URLs or images to apply.'
        : 'Enter a regex pattern and select URLs or images to apply.';
    }
    if (!hasUsableRule) {
      return hasAnyPattern
        ? 'Enable at least one substitution rule to apply.'
        : 'Enter a regex pattern in at least one rule to apply.';
    }
    if (selectedCount === 0) return 'Select URLs or images in the list to apply.';
    return '';
  });

  const resetHint = $derived(canReset ? '' : 'No URL modifications to reset.');

  const applyHintId = 'sub-apply-hint';

  function ensureBaselineRules() {
    if (!rules.length) {
      rules = [createSubRule('', '', 'g', 0)];
      validationErrors = {};
      touchedRules.clear();
      return;
    }

    const sorted = [...rules].sort((a, b) => a.order - b.order);
    let needsUpdate = sorted.length !== rules.length;

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].order !== i || sorted[i] !== rules[i]) needsUpdate = true;
      if (!(sorted[i].id in validationErrors)) {
        validationErrors = { ...validationErrors, [sorted[i].id]: '' };
      }
    }

    if (needsUpdate) {
      rules = sorted.map((r, i) => ({ ...r, order: i }));
    }
  }

  ensureBaselineRules();

  $effect(() => {
    ensureBaselineRules();
  });

  function validateRule(rule: SubRule): boolean {
    const trimmed = rule.pattern.trim();
    if (!trimmed) {
      validationErrors = { ...validationErrors, [rule.id]: 'Pattern cannot be empty' };
      return false;
    }
    const result = validateRegexPattern(trimmed, rule.flags);
    if (result.valid) {
      validationErrors = { ...validationErrors, [rule.id]: '' };
      return true;
    }
    validationErrors = {
      ...validationErrors,
      [rule.id]: result.error ?? 'Invalid regex pattern',
    };
    return false;
  }

  function isBlankRule(rule: SubRule): boolean {
    return !rule.pattern.trim() && !rule.replacement.trim();
  }

  function handleUpdate(id: string, updates: Partial<SubRule>) {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const next = [...rules];
    next[idx] = { ...next[idx], ...updates };
    next.forEach((r, i) => {
      r.order = i;
    });
    rules = next;
    if (
      updates.pattern !== undefined ||
      updates.flags !== undefined ||
      updates.replacement !== undefined
    ) {
      if (isBlankRule(next[idx])) {
        validationErrors = { ...validationErrors, [next[idx].id]: '' };
      } else {
        validateRule(next[idx]);
      }
    }
  }

  function handleRemove(id: string) {
    if (rules.length === 1) {
      handleUpdate(id, { pattern: '', replacement: '', flags: 'g', enabled: true });
      validationErrors = { ...validationErrors, [id]: '' };
      touchedRules.delete(id);
      return;
    }
    const next = rules.filter((r) => r.id !== id).map((r, i) => ({ ...r, order: i }));
    rules = next;
    const { [id]: _, ...rest } = validationErrors;
    validationErrors = rest;
    touchedRules.delete(id);
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= rules.length) return;
    const reordered = [...rules];
    const [rule] = reordered.splice(idx, 1);
    reordered.splice(target, 0, rule);
    rules = reordered.map((r, i) => ({ ...r, order: i }));
  }

  function handleTouch(id: string) {
    touchedRules.add(id);
  }

  function addRule() {
    if (!canAddMoreRules) return;
    rules = [...rules, createSubRule('', '', 'g', rules.length)].map((r, i) => ({
      ...r,
      order: i,
    }));
  }

  function handleApply() {
    let valid = true;
    for (const rule of rules) {
      if (isBlankRule(rule)) {
        validationErrors = { ...validationErrors, [rule.id]: '' };
        continue;
      }
      touchedRules.add(rule.id);
      if (!validateRule(rule)) valid = false;
    }
    if (!valid) return;
    onapply?.();
  }
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <p class="text-base-content/70 text-sm">
      Apply regex-based substitutions to selected URLs. Rules run in order from top to bottom.
    </p>
    <Button
      size="sm"
      variant="ghost"
      onclick={onshowregexhelp}
      title="Regex Help"
      aria-label="Show regex help"
    >
      <Icon
        iconName="question"
        class="h-4 w-4"
      />
      Regex help
    </Button>
  </div>

  <div class="space-y-3">
    {#each rules as rule, i (rule.id)}
      <RuleRow
        {rule}
        index={i}
        ruleCount={rules.length}
        validationError={validationErrors[rule.id] ?? ''}
        touched={touchedRules.has(rule.id)}
        onupdate={handleUpdate}
        onremove={handleRemove}
        onmove={handleMove}
        ontouch={handleTouch}
      />
    {/each}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <Button
        variant={canApply ? 'primary-outline' : 'neutral'}
        size="sm"
        onclick={handleApply}
        disabled={!canApply}
        title={canApply
          ? `Apply substitution rules to ${selectedCount} selected URL${selectedCount === 1 ? '' : 's'}`
          : applyHint}
        aria-describedby={canApply ? undefined : applyHintId}
        class="whitespace-nowrap"
      >
        {applyLabel}
      </Button>
      <Button
        variant={canReset ? 'secondary-outline' : 'neutral'}
        size="sm"
        onclick={onreset}
        disabled={!canReset}
        title={canReset
          ? `Restore the original values of ${modifiedCount} modified URL${modifiedCount === 1 ? '' : 's'}`
          : resetHint}
        class="whitespace-nowrap"
      >
        Reset URLs
      </Button>
    </div>
    <Button
      variant="ghost"
      size="sm"
      onclick={addRule}
      class="gap-2"
      disabled={!canAddMoreRules}
    >
      <Icon iconName="box-add" />
      Add Rule
    </Button>
    {#if !canAddMoreRules}
      <span class="text-base-content/50 text-xs">
        Maximum of {MAX_RULES_PER_PROFILE} rules per profile.
      </span>
    {/if}
    {#if applyHint}
      <p
        id={applyHintId}
        class="text-base-content/60 basis-full text-xs"
      >
        {applyHint}
      </p>
    {/if}
  </div>
</div>
