<script lang="ts">
  import { PageLayout } from '$lib/components/ui';
  import { UserManager } from '$lib/components/settings';
  import { Icon } from '$lib/components';

  const { data } = $props();

  const user = $derived(data.user);
</script>

<PageLayout title="User Manager" description="Manage user accounts">
  {#snippet icon()}
    <Icon iconName="user" size={40} ariaLabel="userIcon" />
  {/snippet}
  <UserManager {user} />
</PageLayout>
