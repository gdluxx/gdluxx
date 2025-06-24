<script lang="ts">
  import { LoginForm } from '$lib/components/auth';
  import icon from '$lib/assets/gdl-ico.png';
</script>

<svelte:head>
  <title>Sign In - gdluxx</title>
</svelte:head>

<div class="flex items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <div class="flex justify-center items-center mb-6">
        <img src={icon} alt="gdluxx Logo" class="h-12 w-12 mr-3" />
        <h1 class="text-2xl font-bold text-secondary-900 dark:text-secondary-100">gdluxx</h1>
      </div>
    </div>
    <LoginForm />
  </div>
</div>
