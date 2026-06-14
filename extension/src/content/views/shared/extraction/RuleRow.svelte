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
  import Toggle from '#components/ui/Toggle.svelte';
  import type { SubRule } from '#utils/substitution';

  interface RuleRowProps {
    rule: SubRule;
    index: number;
    ruleCount: number;
    validationError?: string;
    touched?: boolean;
    onupdate: (id: string, updates: Partial<SubRule>) => void;
    onremove: (id: string) => void;
    onmove: (id: string, direction: 'up' | 'down') => void;
    ontouch: (id: string) => void;
  }

  let {
    rule,
    index,
    ruleCount,
    validationError = '',
    touched = false,
    onupdate,
    onremove,
    onmove,
    ontouch,
  }: RuleRowProps = $props();

  const FLAG_OPTIONS = [
    { flag: 'g', label: 'global' },
    { flag: 'i', label: 'ignore case' },
  ];

  function handlePatternInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    ontouch(rule.id);
    onupdate(rule.id, { pattern: value });
  }

  function handleReplacementInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    onupdate(rule.id, { replacement: value });
  }

  function toggleFlag(flag: string) {
    const existing = rule.flags.split('').filter(Boolean);
    const idx = existing.indexOf(flag);
    if (idx !== -1) {
      existing.splice(idx, 1);
    } else {
      existing.push(flag);
    }
    ontouch(rule.id);
    onupdate(rule.id, { flags: existing.join('') });
  }

  function flagChecked(flag: string): boolean {
    return rule.flags.includes(flag);
  }

  const showError = $derived(touched && !!validationError);
</script>

<div class="collapse-arrow bg-base-200 card-border collapse">
  <input
    type="checkbox"
    id="extract-rule-{rule.id}"
    name="extract-rule-{rule.id}"
    checked
    aria-label="Toggle rule {index + 1} visibility"
  />
  <div
    class="collapse-title border-accent flex flex-wrap items-center justify-between gap-2 py-3 pr-12"
    role="group"
    aria-label="Substitution rule {index + 1}"
  >
    <label
      for="extract-rule-{rule.id}"
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
            class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 {showError
              ? 'input-error focus:input-error'
              : ''}"
            placeholder="Regular expression pattern"
            aria-label="Regex pattern"
            value={rule.pattern}
            oninput={handlePatternInput}
          />
          <p class="text-error ml-2 h-4 text-sm">
            {#if showError}
              {validationError}
            {/if}
          </p>
        </div>
        <div class="min-w-0 flex-1">
          <input
            class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
            placeholder="Substitution text (use $1, $2 for capture groups)"
            aria-label="Substitution text"
            value={rule.replacement}
            oninput={handleReplacementInput}
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
        {#if ruleCount > 1}
          <div class="btn-group join">
            <Button
              disabled={index === 0}
              onclick={(e) => {
                e.stopPropagation();
                onmove(rule.id, 'up');
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
              disabled={index === ruleCount - 1}
              onclick={(e) => {
                e.stopPropagation();
                onmove(rule.id, 'down');
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
            onremove(rule.id);
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

    <div class="ml-2 flex flex-wrap items-center gap-3">
      <div class="join">
        {#each FLAG_OPTIONS as { flag, label } (flag)}
          <input
            class="join-item btn btn-xs"
            type="checkbox"
            name="extract-flags-{rule.id}"
            aria-label="{flag}/{label}"
            checked={flagChecked(flag)}
            onchange={() => toggleFlag(flag)}
          />
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .collapse-arrow > input ~ .collapse-title::after {
    top: 1.4rem;
  }
</style>
