<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  import { Icon } from '$lib/components';
  import { JobsList } from '$lib/components/jobs';
  import { PageLayout } from '$lib/components/ui';

  const { data } = $props();
</script>

<PageLayout title="Jobs" description="Manage your job logs">
  {#snippet icon()}
    <Icon iconName="job" size={32} />
  {/snippet}
  <JobsList initialJobs={data.success ? data.jobs : []} />
</PageLayout>
