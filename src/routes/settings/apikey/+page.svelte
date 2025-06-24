<script lang="ts">
  import { ApiKeyManager } from '$lib/components/settings';
  import { PageLayout } from '$lib/components/ui';
  import { Icon } from '$lib/components';
</script>

<PageLayout title="Key Manager" description="Manage your API keys">
  {#snippet icon()}
    <Icon iconName="key" size={32} ariaLabel="keyIcon" />
  {/snippet}
  <ApiKeyManager />
</PageLayout>
