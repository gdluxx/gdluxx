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
  import { Badge, Button, Dropdown } from '#components/ui';
  import Icon from '#components/ui/Icon.svelte';
  import type { DropdownOption } from '#components/ui/Dropdown.svelte';
  import type { ProfileScope } from '#utils/storageExtractionProfiles';

  interface ProfileControlsProps {
    scope?: ProfileScope;
    hasContent?: boolean;
    hasActiveProfile?: boolean;
    activeProfileDiffers?: boolean;
    statusMessage?: string | null;
    autoAppliedProfile?: boolean;
    isSaving?: boolean;
    applyToPreview?: boolean;
    onsaveprofile?: () => void;
    ondeleteprofile?: () => void;
    onignoreprofile?: () => void;
    onscopechange?: (scope: ProfileScope) => void;
    onshowscopehelp?: () => void;
    onapplytopreviewchange?: (value: boolean) => void;
  }

  let {
    scope = $bindable<ProfileScope>('host'),
    hasContent = false,
    hasActiveProfile = false,
    activeProfileDiffers = false,
    statusMessage = null,
    autoAppliedProfile = false,
    isSaving = false,
    applyToPreview = $bindable(false),
    onsaveprofile,
    ondeleteprofile,
    onignoreprofile,
    onscopechange,
    onshowscopehelp,
    onapplytopreviewchange,
  }: ProfileControlsProps = $props();

  const scopeOptions: DropdownOption<ProfileScope>[] = [
    { value: 'host', label: 'Host' },
    { value: 'origin', label: 'Origin' },
    { value: 'path', label: 'Path' },
  ];

  function handleScopeChange(s: ProfileScope) {
    scope = s;
    onscopechange?.(s);
  }

  function handleApplyToPreviewChange() {
    onapplytopreviewchange?.(!applyToPreview);
  }
</script>

<div class="mt-2 space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <div class="join">
        <Button
          variant="neutral"
          onclick={onshowscopehelp}
          title="Scope Help"
          aria-label="Show scope help"
          class="join-item w-4"
          size="sm"
        >
          <Icon
            iconName="question"
            class="h-4 w-4"
          />
        </Button>
        <Dropdown
          options={scopeOptions}
          selected={scope}
          onSelect={(value) => handleScopeChange(value as ProfileScope)}
          width="w-30"
          size="sm"
          placeholder="Scope"
          class="join-item"
          variant="neutral"
        />
      </div>
      <Button
        class="whitespace-nowrap"
        variant="primary"
        onclick={onsaveprofile}
        disabled={isSaving || !hasContent || (hasActiveProfile && !activeProfileDiffers)}
        title={hasActiveProfile ? 'Update saved extraction profile' : 'Save extraction profile'}
        aria-label={hasActiveProfile ? 'Update profile' : 'Save profile'}
        type="button"
        size="sm"
      >
        {#if isSaving}
          <span class="loading loading-sm loading-spinner"></span>
          Saving…
        {:else if hasActiveProfile}
          {activeProfileDiffers ? 'Update Profile' : 'Profile Saved'}
        {:else}
          Save Profile
        {/if}
      </Button>
    </div>

    {#if hasActiveProfile}
      <div class="flex flex-row items-center gap-2">
        <Button
          class="whitespace-nowrap"
          variant="ghost"
          onclick={ondeleteprofile}
          title="Delete saved extraction profile"
          aria-label="Delete profile"
          type="button"
          size="sm"
        >
          Delete
        </Button>
        <Button
          class="whitespace-nowrap"
          variant="ghost"
          onclick={onignoreprofile}
          disabled={!autoAppliedProfile}
          title="Ignore auto-applied profile for this session"
          aria-label="Ignore profile"
          type="button"
          size="sm"
        >
          Ignore
        </Button>
      </div>
    {/if}
  </div>

  <div class="flex flex-wrap items-center gap-4 text-xs">
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        class="checkbox checkbox-xs checkbox-secondary rounded-sm"
        checked={applyToPreview}
        onchange={handleApplyToPreviewChange}
        aria-label="Apply substitution results to previews"
      />
      <span class="text-base-content/70">Apply to previews</span>
    </label>
  </div>

  {#if hasActiveProfile}
    <div class="text-base-content/70 flex flex-wrap items-center gap-3 text-xs">
      {#if statusMessage}
        <Badge
          label={statusMessage}
          variant="outline-primary"
        />
      {/if}
      {#if activeProfileDiffers}
        <span class="text-warning font-semibold">Unsaved changes</span>
      {:else}
        <span class="text-success font-semibold">In sync</span>
      {/if}
      {#if autoAppliedProfile}
        <span class="text-info">Auto-applied</span>
      {/if}
    </div>
  {/if}
</div>
