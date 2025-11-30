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
  let hoveredRuleId = $state<string | null>(null);

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

  function preventCollapsePropagation(node: HTMLElement) {
    const stop = (event: Event) => {
      event.stopPropagation();
    };

    node.addEventListener('click', stop);
    node.addEventListener('keydown', stop);

    return {
      destroy() {
        node.removeEventListener('click', stop);
        node.removeEventListener('keydown', stop);
      },
    };
  }
</script>

<div class="space-y-6">
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
      {#key rule.id}
        <div class="collapse-arrow bg-base-200 card-border collapse">
          <input
            type="checkbox"
            name="collapse-rule-{rule.id}"
            checked
            aria-label="Toggle rule {index + 1} visibility"
          />
          <div
            class="collapse-title flex flex-wrap items-center justify-between gap-2 pr-12"
            onmouseenter={() => (hoveredRuleId = rule.id)}
            onmouseleave={() => (hoveredRuleId = null)}
          >
            <div class="flex items-baseline gap-2">
              <span class="text-sm font-medium">Rule {index + 1}</span>
              {#if rule.pattern}
                <span class="text-base-content/50 text-xs font-normal">
                  {rule.pattern.slice(0, 30)}{rule.pattern.length > 30 ? '...' : ''}
                </span>
              {/if}
            </div>
            <div
              class="relative z-10 flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Rule {index + 1} controls"
              use:preventCollapsePropagation
            >
              <div class="flex items-center">
                <label
                  class="text-base-content/70 mx-1 flex w-30 items-center justify-between gap-1"
                >
                  <span>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                  <Toggle
                    bind:checked={rule.enabled}
                    variant="secondary"
                  />
                </label>
              </div>
              {#if hoveredRuleId === rule.id || rules.length === 1}
                <div class="btn-group join">
                  <Button
                    size="sm"
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
                    size="sm"
                    disabled={index === rules.length - 1}
                    onclick={(e) => {
                      e.stopPropagation();
                      moveRule(rule.id, 'down');
                    }}
                    type="button"
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
                size="sm"
                square
              >
                <Icon
                  iconName="mdi-delete"
                  class="text-error"
                />
              </Button>
            </div>
          </div>

          <div class="collapse-content space-y-3">
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2">
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
              <div class="space-y-2">
                <input
                  class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
                  placeholder="Substitution text (use $1, $2 for capture groups)"
                  aria-label="Substitution text"
                  value={rule.replacement}
                  oninput={(event) => handleReplacementInput(rule.id, event)}
                />
              </div>
            </div>

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
      {/key}
    {/each}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <Button
        variant="neutral"
        size="sm"
        onclick={handleApply}
        class="whitespace-nowrap"
      >
        Apply substitutions
      </Button>
      <Button
        variant="neutral"
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
