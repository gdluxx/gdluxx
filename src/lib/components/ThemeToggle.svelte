<script>
  import { onMount } from 'svelte';

  let isDark = $state(false);

  function handleThemeChange() {
    const htmlEl = document.documentElement;
    if (isDark) {
      htmlEl.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      htmlEl.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  $effect(() => {
    if (typeof window !== 'undefined') {
      handleThemeChange();
    }
  });

  onMount(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDark = storedTheme === 'dark' || (!storedTheme && prefersDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  });
</script>


<label
  class="flex swap relative swap-rotate cursor-pointer items-center"
  aria-label="Toggle Dark Mode"
>
  <!-- this hidden checkbox controls the state -->
  <input type="checkbox" bind:checked={isDark} class="sr-only" name="Theme Toggle" />

  <!-- Sun icon -->
  <div
    class="swap-off w-6 h-6 bg-accent-600 transition-all duration-200 hover:scale-110"
    style:mask="url('/icons/white-balance-sunny.svg') no-repeat center"
    style:mask-size="contain"
  ></div>

  <!-- Moon icon -->
  <div
    class="swap-on w-6 h-6 bg-accent-400 transition-all duration-200 hover:scale-110"
    style:mask="url('/icons/weather-night.svg') no-repeat center"
    style:mask-size="contain"
  ></div>
</label>

<style>
  .swap-rotate {
    transition: transform 0.3s ease-in-out;
  }

  .swap input {
    opacity: 0;
    pointer-events: none;
  }

  .swap-off,
  .swap-on {
    position: absolute;
    transition:
      opacity 0.3s ease-in-out,
      transform 0.3s ease-in-out;
  }

  .swap input:not(:checked) ~ .swap-off {
    opacity: 1;
    transform: rotate(0deg);
    pointer-events: auto;
  }

  .swap input:not(:checked) ~ .swap-on {
    opacity: 0;
    transform: rotate(180deg);
    pointer-events: none;
  }

  .swap input:checked ~ .swap-off {
    opacity: 0;
    transform: rotate(-180deg);
    pointer-events: none;
  }

  .swap input:checked ~ .swap-on {
    opacity: 1;
    transform: rotate(0deg);
    pointer-events: auto;
  }
</style>
