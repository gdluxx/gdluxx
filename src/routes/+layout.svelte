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
  import '../app.css';
  import '$lib/themes/css';
  import { Icon, Sidebar, ThemeToggle } from '$lib/components';
  import { ToastContainer } from '$lib/components/toast';
  import { JobsIndicator, JobOutputModal } from '$lib/components/jobs';
  import { onMount } from 'svelte';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import icon from '$lib/assets/gdl-ico.png';
  import { goto } from '$app/navigation';
  import { navItems } from './navigation';
  import { page } from '$app/state';
  import { clientLogger as logger } from '$lib/client/logger';
  import {
    initializeThemeStore,
    initializeThemeStoreFallback,
    validateThemeSystem,
  } from '$lib/themes/themeStore';

  const { children, data } = $props();

  const visibleJobs = $derived(jobStore.visibleJobs);

  const isAuthRoute = $derived(page.route.id?.startsWith('/auth'));
  const user = $derived(data.user);

  let isMobile = $state(false);
  let sidebarOpen = $state(false);

  import type { NavigationItem } from './navigation';

  function handleNavigate(item: NavigationItem) {
    logger.info('Navigating to:', item);
    if (item.href) {
      goto(item.href);
    }
    if (isMobile) {
      sidebarOpen = false;
    }
  }

  function handleSidebarToggle() {
    sidebarOpen = !sidebarOpen;
  }

  function closeSidebar() {
    if (isMobile) {
      sidebarOpen = false;
    }
  }

  function checkMobile() {
    if (typeof window !== 'undefined') {
      isMobile = window.innerWidth < 768;
      if (isMobile && sidebarOpen === false) {
        sidebarOpen = false;
      }
    }
  }

  onMount(() => {
    document.body.classList.remove('preload');

    checkMobile();

    const validation = validateThemeSystem();
    if (!validation.valid) {
      logger.warn('Theme system validation failed:', validation.errors);
    }

    (async () => {
      if (user) {
        try {
          await initializeThemeStore();
        } catch (error) {
          logger.warn('Failed to initialize theme from database, using fallback:', error);
          initializeThemeStoreFallback();
        }
      } else {
        initializeThemeStoreFallback();
      }
    })();

    const handleResize = () => {
      const wasMobile = isMobile;
      checkMobile();

      if (wasMobile && !isMobile) {
        sidebarOpen = true;
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  $effect(() => {
    if (typeof window !== 'undefined') {
      if (user) {
        initializeThemeStore().catch(() => {
          initializeThemeStoreFallback();
        });
      } else {
        initializeThemeStoreFallback();
      }
    }
  });
</script>

{#if isAuthRoute}
  <!-- Auth-only layout -->
  <div class="min-h-screen bg-background">
    {@render children()}
  </div>
{:else}
  <!-- Main layout with sidebar and header -->
  <div class="flex h-screen flex-col bg-background">
    <header class="sticky top-0 z-50 bg-surface px-6 py-4 border-b-strong">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          {#if isMobile}
            <!-- hamburger -->
            <button
              onclick={handleSidebarToggle}
              class="rounded-md p-2 text-muted-foreground hover:bg-surface-hover focus:outline-hidden focus:border-focus"
              aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={sidebarOpen}
            >
              <Icon
                iconName={sidebarOpen ? 'close' : 'menu'}
                size={24}
                ariaLabel={sidebarOpen ? 'Close menu' : 'Open menu'}
              />
            </button>
          {/if}

          <div class="flex flex-shrink-0 items-center select-none">
            <img
              src={icon}
              alt="gdluxx Logo"
              class="me-3 h-6 sm:h-9"
            />
            <span class="text-xl font-semibold whitespace-nowrap text-foreground"> gdluxx </span>
          </div>
          <JobsIndicator />
        </div>
        <div class="mr-4 flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>

    <div class="relative flex flex-1 overflow-hidden">
      {#if !isMobile}
        <Sidebar
          items={navItems}
          defaultCollapsed={false}
          onNavigate={handleNavigate}
          {isMobile}
          {user}
        />
      {/if}

      <!-- Mobile sidebar is overlay so there's no squishing -->
      {#if isMobile && sidebarOpen}
        <div
          class="bg-blur-sm fixed inset-0 z-40 md:hidden"
          onclick={closeSidebar}
          aria-hidden="true"
        ></div>

        <div class="fixed inset-y-0 left-0 z-50 md:hidden">
          <Sidebar
            items={navItems}
            defaultCollapsed={false}
            onNavigate={handleNavigate}
            {isMobile}
          />
        </div>
      {/if}

      <main class="flex-1 overflow-auto">
        <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {@render children()}
        </div>
      </main>
    </div>
  </div>
{/if}

<ToastContainer />

{#if !isAuthRoute}
  {#each visibleJobs as job (job.id)}
    <JobOutputModal {job} />
  {/each}
{/if}
