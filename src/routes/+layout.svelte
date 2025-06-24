<script lang="ts">
  import '../app.css';
  import {
    JobsList,
    JobOutputModal,
    JobsIndicator,
    Sidebar,
    ThemeToggle,
    ToastContainer,
  } from '$lib/components';
  import { onMount } from 'svelte';
  import { jobStore, visibleJobs } from '$lib/stores/jobs';
  import icon from '$lib/assets/gdl-ico.png';
  import { goto } from '$app/navigation';
  import { navItems } from '$lib/var/navigation';
  import { page } from '$app/state';
  import { logger } from '$lib/shared/logger';

  const { children, data } = $props();
  const isJobListModalOpenStore = jobStore.isJobListModalOpen;

  const isAuthRoute = $derived(page.route.id?.startsWith('/auth'));
  const user = $derived(data.user);

  let isMobile = $state(false);
  let sidebarOpen = $state(false);

  interface NavigationItem {
    id: string;
    label: string;
    icon: string;
    href?: string;
    children?: NavigationItem[];
  }

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
</script>

{#if isAuthRoute}
  <!-- Auth-only layout -->
  <div
    class="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 dark:from-primary-950 dark:to-secondary-950"
  >
    {@render children()}
  </div>
{:else}
  <!-- Main layout with sidebar and header -->
  <div class="flex flex-col h-screen bg-secondary-50 dark:bg-secondary-950">
    <header
      class="sticky top-0 z-50 border-b border-secondary-300 bg-secondary-100 dark:border-secondary-700 dark:bg-secondary-900 px-6 py-4"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          {#if isMobile}
            <!-- hamburger -->
            <button
              onclick={handleSidebarToggle}
              class="p-2 rounded-md text-secondary-600 dark:text-secondary-400 hover:bg-secondary-200 dark:hover:bg-secondary-800 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={sidebarOpen}
            >
              <svg
                class="size-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {#if sidebarOpen}
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                {:else}
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                {/if}
              </svg>
            </button>
          {/if}

          <div class="flex-shrink-0 flex items-center select-none">
            <img src={icon} alt="gdluxx Logo" class="me-3 h-6 sm:h-9" />
            <span
              class="text-xl font-semibold whitespace-nowrap text-secondary-900 dark:text-secondary-100"
            >
              gdluxx
            </span>
          </div>
          <JobsIndicator />
        </div>
        <div class="flex items-center mr-4">
          <ThemeToggle />
        </div>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden relative">
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
          class="fixed inset-0 bg-blur-sm z-40 md:hidden"
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
        <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          {@render children()}
        </div>
      </main>
    </div>
  </div>
{/if}

<ToastContainer />

{#if !isAuthRoute}

  <JobsList variant="modal" isOpen={$isJobListModalOpenStore} onClose={jobStore.hideJobListModal} />

  {#each $visibleJobs as job (job.id)}
    <JobOutputModal {job} />
  {/each}
{/if}
