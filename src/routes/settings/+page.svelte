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
    VersionManager,
    ApiKeyManager,
    LogSettings,
    UserManager,
  } from '$lib/components/settings';
  import { PageLayout } from '$lib/components/ui';
  import { ToastContainer } from '$lib/components';
  import { VersionIcon, DebugIcon, KeyIcon } from '$lib/components/icons';

  const { data } = $props();

  const tabs = [
    {
      name: 'Version',
      title: 'Version Manager',
      description: 'Manage your <i>gallery-dl</i> version',
      icon: VersionIcon,
      component: VersionManager,
    },
    {
      name: 'User',
      title: 'User Manager',
      description: 'Manage user accounts',
      icon: VersionIcon,
      component: UserManager,
    },
    {
      name: 'API Keys',
      title: 'Key Manager',
      description: 'Manage your API keys',
      icon: KeyIcon,
      component: ApiKeyManager,
    },
    {
      name: 'Debug',
      title: 'Debug Manager',
      description: 'Manage your log settings',
      icon: DebugIcon,
      component: LogSettings,
    },
  ];

  let activeTabIdx = $state(0);

  const CurrentTab = $derived(tabs[activeTabIdx]);
  const getTabClasses = $derived(
    (isActive: boolean) =>
      `inline-block p-4 rounded-t-lg border-b-2 focus:outline-none cursor-pointer ${
        isActive
          ? 'border-primary-600 text-primary-700 dark:text-primary-300 dark:border-primary-300 font-semibold'
          : 'border-transparent text-secondary-500 hover:text-primary-600 hover:border-primary-300 dark:text-secondary-400 dark:hover:text-primary-300 dark:hover:border-primary-300'
      }`
  );

  // keyboard nav for accessibility
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') {
      activeTabIdx = (activeTabIdx + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      activeTabIdx = (activeTabIdx - 1 + tabs.length) % tabs.length;
    }
  }
</script>

<div class="w-full mx-auto">
  <nav
    class="text-sm font-medium text-center border-b border-secondary-200 dark:border-secondary-700"
    aria-label="Settings tabs"
  >
    <ul class="flex flex-wrap -mb-px" role="tablist">
      {#each tabs as tab, idx (tab.name)}
        <li class="me-2">
          <button
            type="button"
            class={getTabClasses(activeTabIdx === idx)}
            role="tab"
            aria-selected={activeTabIdx === idx}
            aria-controls={`tabpanel-${idx}`}
            tabindex={activeTabIdx === idx ? 0 : -1}
            onclick={() => (activeTabIdx = idx)}
            onkeydown={handleKeydown}
          >
            {tab.name}
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <!-- Tab content -->
  <section id={`tabpanel-${activeTabIdx}`} role="tabpanel" tabindex="0" class="pt-6">
    <PageLayout title={CurrentTab.title} description={CurrentTab.description}>
      {#snippet icon()}
        <CurrentTab.icon />
      {/snippet}
      {#if CurrentTab.name === 'User'}
        <UserManager user={data.user} />
      {:else}
        <CurrentTab.component />
      {/if}
    </PageLayout>
  </section>
</div>

<ToastContainer />
