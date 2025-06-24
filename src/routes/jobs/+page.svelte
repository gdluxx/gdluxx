<script lang="ts">
  import { Icon, JobsList } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
</script>

<PageLayout title="Jobs" description="Manage your job logs">
  {#snippet icon()}
    <Icon iconName="job" size={32} />
  {/snippet}
  <JobsList variant="page" />
</PageLayout>
