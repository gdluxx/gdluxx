<script lang="ts">
  import { CommandForm } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
  import { RunIcon } from '$lib/components/icons';
</script>

<svelte:head>
  <title>gdluxx</title>
</svelte:head>

<PageLayout title="Run" description="Retrieve your URLs">
  {#snippet icon()}
    <RunIcon />
  {/snippet}
  <CommandForm />
</PageLayout>
