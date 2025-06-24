<script lang="ts">
  import icon from '$lib/assets/gdl-ico.png';
  import { fade, slide } from 'svelte/transition';
  import { JobsIndicator, ThemeToggle } from '$lib/components';
  import { page } from '$app/state';
  import { signOut } from '$lib/auth-client';
  import { toastStore } from '$lib/stores/toast';
  // import { jobCount, runningJobCount } from '$lib/stores/jobs';

  let isMenuOpen = false;
  let showCloseIcon = false;
  let isDropdownOpen = false;

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Config', path: '/config' },
    { name: 'Jobs', path: '/jobs' },
    { name: 'Settings', path: '/settings' },
    { name: 'UI', path: '/ui' },
  ];

  function closeMenu() {
    isMenuOpen = false;
    setTimeout(() => {
      showCloseIcon = false;
    }, 100);
  }

  function toggleMenu() {
    if (isMenuOpen) {
      closeMenu();
    } else {
      isMenuOpen = true;
      setTimeout(() => {
        showCloseIcon = true;
      }, 50);
    }
  }

  function toggleDropdown() {
    isDropdownOpen = !isDropdownOpen;
  }

  function closeDropdown() {
    isDropdownOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target;
    if (target instanceof Element && !target.closest('.dropdown-container')) {
      closeDropdown();
    }
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeMenu();
    }
    if (event.key === 'Escape') {
      closeMenu();
    }
  }

  async function handleLogout() {
    try {
      await signOut();
      toastStore.success('Logged out successfully');
      window.location.href = '/auth/login';
    } catch (error) {
      toastStore.error('Logout failed', 'An error occurred while logging out');
      console.error('Logout error:', error);
    }
    closeDropdown();
  }
</script>

<svelte:window onclick={handleClickOutside} />

<nav
  class="border-b border-secondary-300 bg-secondary-100 dark:border-secondary-700 dark:bg-secondary-900 rounded-b-sm px-3"
>
  <div class="flex h-16 items-center justify-between">
    <!-- Logo section -->
    <div class="flex items-center">
      <div class="flex-shrink-0 flex items-center select-none">
        <img src={icon} alt="gdluxx Logo" class="me-3 h-6 sm:h-9" />
        <span
          class="text-xl font-semibold whitespace-nowrap text-primary-700 dark:text-primary-300"
        >
          gdluxx
        </span>
      </div>
    </div>

    <!-- Large nav -->
    <div class="hidden sm:flex items-center gap-4">
      <!-- Dropdown Menu -->
      <div class="relative dropdown-container">
        <button
          type="button"
          class="flex cursor-pointer items-center justify-center p-2 text-primary-700 hover:text-accent-700 transition-all duration-200 dark:text-primary-300 hover:dark:text-primary-300 focus:outline-none"
          onclick={toggleDropdown}
          aria-expanded={isDropdownOpen}
          aria-haspopup="true"
        >
          <span class="mr-1">Menu</span>
          <svg
            class="block h-6 w-6 transition-transform duration-200"
            class:rotate-90={isDropdownOpen}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {#if isDropdownOpen}
          <div
            class="absolute right-0 mt-2 w-48 rounded-sm shadow-lg bg-primary-50 dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
            transition:slide={{ duration: 150 }}
          >
            <div class="py-1" role="menu" aria-orientation="vertical">
              {#each navLinks as link (link.path)}
                <a
                  href={link.path}
                  class={`
                        block px-4 py-2 text-sm text-secondary-700 hover:bg-accent-200 rounded-sm m-1 hover:text-accent-700 dark:text-secondary-200 dark:hover:bg-secondary-700 dark:hover:text-accent-300 transition-colors duration-150
                        ${page.url.pathname === link.path ? 'bg-accent-200 rounded-sm text-accent-700 font-semibold dark:bg-secondary-700 dark:text-accent-300' : ''}
                      `}
                  role="menuitem"
                  onclick={closeDropdown}
                >
                  {link.name}
                </a>
              {/each}
              <div
                class="mx-1 mb-1 block text-sm text-secondary-700 hover:bg-accent-200 rounded-sm m-1 hover:text-accent-700 dark:text-secondary-200 dark:hover:bg-secondary-700 dark:hover:text-accent-300 transition-colors duration-150"
              >
                <ThemeToggle />
              </div>
              <hr class="my-1 border-secondary-300 dark:border-secondary-600" />
              <button
                type="button"
                onclick={handleLogout}
                class="w-full text-left block px-4 py-2 text-sm text-error-500 hover:bg-error-100 rounded-sm m-1 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-900 dark:hover:text-error-300 transition-colors duration-150"
                role="menuitem"
              >
                Sign out
              </button>
            </div>
          </div>
        {/if}
      </div>
      <!-- End Dropdown Menu -->
      <JobsIndicator />
    </div>

    <!-- Mobile menu button -->
    <div class="md:hidden flex">
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-sm p-2 text-primary-700 hover:text-accent-700 focus:outline-none dark:text-primary-700"
        onclick={toggleMenu}
        aria-controls="mobile-menu"
        aria-expanded={isMenuOpen}
      >
        <span class="sr-only">Open main menu</span>
        {#if showCloseIcon}
          <svg class="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        {:else}
          <svg class="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        {/if}
      </button>
      <JobsIndicator />
    </div>
  </div>
</nav>

{#if isMenuOpen}
  <div
    class="fixed inset-0 z-40 background-blur-sm md:hidden"
    transition:fade={{ duration: 150 }}
    onclick={closeMenu}
    role="button"
    tabindex="0"
    aria-label="Close menu"
    onkeydown={handleMenuKeydown}
  ></div>

  <div
    class="fixed top-16 left-0 right-0 z-50 md:hidden"
    id="mobile-menu"
    transition:slide={{ duration: 200 }}
  >
    <div
      class="border-b border-secondary-200 bg-white shadow-lg dark:border-secondary-700 dark:bg-secondary-900"
    >
      <div class="space-y-1 px-2 pt-2 pb-3">
        {#each navLinks as link (link.path)}
          <a
            href={link.path}
            onclick={closeMenu}
            class={`
              block px-3 py-2 rounded-sm text-base font-medium transition-colors duration-150
              ${
                page.url.pathname === link.path
                  ? 'bg-accent-200 text-accent-700 dark:bg-secondary-700 dark:text-accent-300'
                  : 'text-secondary-700 hover:text-accent-700 hover:bg-accent-100 dark:text-secondary-200 dark:hover:text-accent-300 dark:hover:bg-secondary-700'
              }
            `}
          >
            {link.name}
          </a>
        {/each}
        <div class="px-3 py-2">
          <ThemeToggle />
        </div>
        <hr class="my-1 border-secondary-300 dark:border-secondary-600" />
        <button
          type="button"
          onclick={() => {
            closeMenu();
            handleLogout();
          }}
          class="w-full text-left block px-3 py-2 rounded-sm text-base font-medium text-error-500 hover:text-error-700 hover:bg-error-100 dark:text-error-400 dark:hover:text-error-300 dark:hover:bg-error-900 transition-colors duration-150"
        >
          Sign out
        </button>
      </div>
    </div>
  </div>
{/if}
