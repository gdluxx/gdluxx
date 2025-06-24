<script lang="ts">
  import { VersionManager } from '$lib/components/settings';
  import { Icon } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
</script>

<PageLayout title="Version Manager" description="Manage your <i>gallery-dl</i> version">
  {#snippet icon()}
    <Icon iconName="version" size={32} ariaLabel="versionIcon" />
  {/snippet}
  <VersionManager />
</PageLayout>
