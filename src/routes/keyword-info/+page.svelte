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
  import { Icon, KeywordInfo } from '$lib/components';
  import { PageLayout } from '$lib/components/ui';
</script>

<PageLayout title="Keyword Info" description="Get keywords and extractor info for a supported URL">
  {#snippet icon()}
    <Icon iconName="extract" size={32} />
  {/snippet}
  <KeywordInfo />
</PageLayout>
