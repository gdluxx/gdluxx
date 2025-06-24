<script lang="ts">
  import { LogSettings } from '$lib/components/settings';
  import { Icon } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
</script>

<PageLayout title="Debug Manager" description="Manage your log settings">
  {#snippet icon()}
    <Icon iconName="log" size={32} ariaLabel="logIcon" />
  {/snippet}
  <LogSettings />
</PageLayout>
