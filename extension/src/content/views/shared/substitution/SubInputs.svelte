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
  import { createSubRule, validateRegexPattern, type SubRule } from '#utils/substitution';
  import { SvelteSet } from 'svelte/reactivity';
  import { MAX_RULES_PER_PROFILE } from '#utils/storageSubstitution';
  import Toggle from '#components/ui/Toggle.svelte';

  interface SubInputsProps {
    rules?: SubRule[];
    onapply?: () => void;
    onreset?: () => void;
    onshowregexhelp?: () => void;
  }

  let {
    rules = $bindable<SubRule[]>([]),
    onapply,
    onreset,
    onshowregexhelp,
  }: SubInputsProps = $props();

  let validationErrors = $state<Record<string, string>>({});
  const touchedRules = new SvelteSet<string>();
  const canAddMoreRules = $derived(rules.length < MAX_RULES_PER_PROFILE);

  const FLAG_OPTIONS = [
    { flag: 'g', label: 'global' },
    { flag: 'i', label: 'ignore case' },
  ];

  function showRegexHelp() {
    onshowregexhelp?.();
  }

  function ensureBaselineRules() {
    if (!rules.length) {
      rules = [createSubRule('', '', 'g', 0)];
      validationErrors = {};
      touchedRules.clear();
      return;
    }

    const sorted = [...rules].sort((a, b) => a.order - b.order);
    let needsUpdate = sorted.length !== rules.length;

    for (let index = 0; index < sorted.length; index += 1) {
      const rule = sorted[index];
      if (rule.order !== index || sorted[index] !== rules[index]) {
        needsUpdate = true;
      }
      if (!(rule.id in validationErrors)) {
        validationErrors = { ...validationErrors, [rule.id]: '' };
      }
    }

    if (needsUpdate) {
      rules = sorted.map((rule, index) => ({
        ...rule,
        order: index,
      }));
    }
  }

  ensureBaselineRules();

  $effect(() => {
    ensureBaselineRules();
  });

  function markTouched(id: string) {
    if (!touchedRules.has(id)) {
      touchedRules.add(id);
    }
  }

  function setValidationError(id: string, message: string | null) {
    validationErrors = {
      ...validationErrors,
      [id]: message ?? '',
    };
  }

  function validateRule(rule: SubRule): boolean {
    const trimmed = rule.pattern.trim();
    if (!trimmed) {
      setValidationError(rule.id, 'Pattern cannot be empty');
      return false;
    }
    const result = validateRegexPattern(trimmed, rule.flags);
    if (result.valid) {
      setValidationError(rule.id, '');
      return true;
    }
    setValidationError(rule.id, result.error ?? 'Invalid regex pattern');
    return false;
  }

  function updateRule(id: string, updates: Partial<SubRule>) {
    const index = rules.findIndex((rule) => rule.id === id);
    if (index === -1) return;

    const next = [...rules];
    next[index] = {
      ...next[index],
      ...updates,
    };

    next.forEach((rule, idx) => {
      rule.order = idx;
    });

    rules = next;

    if (updates.pattern !== undefined || updates.flags !== undefined) {
      validateRule(next[index]);
    }
  }

  function handlePatternInput(id: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    markTouched(id);
    updateRule(id, { pattern: value });
  }

  function handleReplacementInput(id: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    updateRule(id, { replacement: value });
  }

  function toggleFlag(id: string, flag: string) {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;

    const existing = rule.flags.split('').filter(Boolean);
    const index = existing.indexOf(flag);
    if (index !== -1) {
      existing.splice(index, 1);
    } else {
      existing.push(flag);
    }
    const updatedFlags = existing.join('');
    markTouched(id);
    updateRule(id, { flags: updatedFlags });
  }

  function addRule() {
    if (!canAddMoreRules) return;
    const next = [...rules, createSubRule('', '', 'g', rules.length)];
    rules = next.map((rule, index) => ({ ...rule, order: index }));
  }

  function removeRule(id: string) {
    if (rules.length === 1) {
      updateRule(id, {
        pattern: '',
        replacement: '',
        flags: 'g',
        enabled: true,
      });
      setValidationError(id, '');
      touchedRules.delete(id);
      return;
    }

    const next = rules.filter((rule) => rule.id !== id);
    rules = next.map((rule, index) => ({ ...rule, order: index }));

    const { [id]: _, ...rest } = validationErrors;
    validationErrors = rest;
    touchedRules.delete(id);
  }

  function moveRule(id: string, direction: 'up' | 'down') {
    const index = rules.findIndex((rule) => rule.id === id);
    if (index === -1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= rules.length) return;

    const reordered = [...rules];
    const [rule] = reordered.splice(index, 1);
    reordered.splice(target, 0, rule);

    rules = reordered.map((item, idx) => ({ ...item, order: idx }));
  }

  function handleApply() {
    let valid = true;
    for (const rule of rules) {
      markTouched(rule.id);
      if (!validateRule(rule)) {
        valid = false;
      }
    }
    if (!valid) return;
    onapply?.();
  }

  function handleReset() {
    onreset?.();
  }

  function flagChecked(rule: SubRule, flag: string): boolean {
    return rule.flags.includes(flag);
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
      onclick={showRegexHelp}
      title="CSS Selector Help"
      aria-label="Show CSS selector help"
    >
      <Icon
        iconName="question"
        class="h-4 w-4"
      />
      Regex help
    </Button>
  </div>

  <div class="space-y-3">
    {#each rules as rule, index (rule.id)}
      <div class="collapse-arrow bg-base-200 card-border collapse">
        <input
          type="checkbox"
          id="collapse-rule-{rule.id}"
          name="collapse-rule-{rule.id}"
          checked
          aria-label="Toggle rule {index + 1} visibility"
        />
        <div
          class="collapse-title border-accent flex flex-wrap items-center justify-between gap-2 py-3 pr-12"
          role="group"
          aria-label="Substitution rule {index + 1}"
        >
          <label
            for="collapse-rule-{rule.id}"
            class="flex cursor-pointer items-baseline gap-2"
          >
            <span class="text-sm font-medium">Rule {index + 1}</span>
            {#if rule.pattern}
              <span class="text-base-content/50 text-xs font-normal">
                {rule.pattern.slice(0, 30)}{rule.pattern.length > 30 ? '...' : ''}
              </span>
            {/if}
          </label>
        </div>

        <div class="collapse-content space-y-3">
          <div class="flex flex-wrap items-start gap-3">
            <!-- Inputs section -->
            <div class="flex min-w-0 flex-1 gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <input
                  class={`input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 ${touchedRules.has(rule.id) && validationErrors[rule.id] ? 'input-error focus:input-error' : ''}`}
                  placeholder="Regular expression pattern"
                  aria-label="Regex pattern"
                  value={rule.pattern}
                  oninput={(event) => handlePatternInput(rule.id, event)}
                />
                <p class="text-error ml-2 h-4 text-sm">
                  {#if touchedRules.has(rule.id) && validationErrors[rule.id]}
                    {validationErrors[rule.id]}
                  {/if}
                </p>
              </div>
              <div class="min-w-0 flex-1">
                <input
                  class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
                  placeholder="Substitution text (use $1, $2 for capture groups)"
                  aria-label="Substitution text"
                  value={rule.replacement}
                  oninput={(event) => handleReplacementInput(rule.id, event)}
                />
              </div>
            </div>

            <!-- Actions section -->
            <div class="flex shrink-0 items-center gap-2">
              <label class="text-base-content/70 flex items-center gap-1">
                <span class="text-xs">{rule.enabled ? 'On' : 'Off'}</span>
                <Toggle
                  bind:checked={rule.enabled}
                  variant="secondary"
                />
              </label>
              {#if rules.length > 1}
                <div class="btn-group join">
                  <Button
                    disabled={index === 0}
                    onclick={(e) => {
                      e.stopPropagation();
                      moveRule(rule.id, 'up');
                    }}
                    type="button"
                    title="Move rule up"
                    aria-label="Move rule up"
                    class="join-item"
                    square
                  >
                    <Icon iconName="move-up" />
                  </Button>
                  <Button
                    disabled={index === rules.length - 1}
                    onclick={(e) => {
                      e.stopPropagation();
                      moveRule(rule.id, 'down');
                    }}
                    title="Move rule down"
                    aria-label="Move rule down"
                    class="join-item"
                    square
                  >
                    <Icon iconName="move-down" />
                  </Button>
                </div>
              {/if}
              <Button
                variant="ghost"
                type="button"
                onclick={(e) => {
                  e.stopPropagation();
                  removeRule(rule.id);
                }}
                title="Delete rule"
                aria-label="Delete rule"
                square
              >
                <Icon
                  iconName="mdi-delete"
                  class="text-error"
                />
              </Button>
            </div>
          </div>
          <!-- end actions -->

          <div class="ml-2 flex flex-wrap items-center gap-3">
            <div class="join">
              {#each FLAG_OPTIONS as { flag, label } (flag)}
                <input
                  class="join-item btn btn-xs"
                  type="checkbox"
                  name="flags-{rule.id}"
                  aria-label="{flag}/{label}"
                  checked={flagChecked(rule, flag)}
                  onchange={() => toggleFlag(rule.id, flag)}
                />
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <Button
        variant="primary-outline"
        size="sm"
        onclick={handleApply}
        class="whitespace-nowrap"
      >
        Apply substitutions
      </Button>
      <Button
        variant="secondary-outline"
        size="sm"
        onclick={handleReset}
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
  </div>
</div>

<style>
  .collapse-arrow > input ~ .collapse-title::after {
    top: 1.4rem;
  }
</style>
