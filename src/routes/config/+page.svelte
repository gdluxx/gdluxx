<script lang="ts">
  import { onMount } from 'svelte';
  import { ConfigEditor } from '$lib/components';
  import { Info, PageLayout } from '$lib/components/ui';

  let theme: 'light' | 'dark' = 'light';
  let jsonContent = '';
  let isLoading = true;
  let loadError = '';
  let loadMessage = '';

  async function loadConfig() {
    try {
      const response = await fetch('/api/files/read');
      const data = await response.json();

      if (data.success) {
        jsonContent = data.content;
        if (data.message) {
          loadMessage = data.message;
        }
      } else {
        //eslint-disable-next-line
        loadError = data.error || 'Failed to load configuration';
      }
    } catch (error) {
      loadError = 'Failed to connect to server';
      console.error('Error loading config:', error);
    } finally {
      isLoading = false;
    }
  }

  async function saveJsonFile(content: string) {
    const response = await fetch('/api/files/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      //eslint-disable-next-line
      throw new Error(errorData.error || `Failed to save: ${response.statusText}`);
    }

    if (loadMessage) {
      loadMessage = '';
    }
    return response.json();
  }

  function checkTheme() {
    theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  onMount(() => {
    checkTheme();
    loadConfig();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  });
</script>

<PageLayout title="Configuration" description="Manage your config file">
  {#snippet icon()}
    <svg viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M9 16v-1m3 1v-1m3 1v-1M6.835 4q-.747.022-1.297.242a1.86 1.86 0 0 0-.857.66q-.285.438-.285 1.164V9.23q0 1.12-.594 1.802q-.593.66-1.802.88v.131q1.23.22 1.802.901q.594.66.594 1.78v3.231q0 .704.285 1.143q.286.461.835.66q.55.219 1.32.241M17.164 4q.747.022 1.297.242q.55.219.857.66q.285.438.285 1.164V9.23q0 1.12.594 1.802q.593.66 1.802.88v.131q-1.23.22-1.802.901q-.594.66-.594 1.78v3.231q0 .704-.285 1.143q-.286.461-.835.66q-.55.219-1.32.241"
      /></svg
    >
  {/snippet}

  {#if isLoading}
    <div
      class="flex h-96 flex-col items-center justify-center text-secondary-900 dark:text-secondary-100"
    >
      <div class="text-lg">Loading configuration...</div>
      <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24"
        ><circle cx="18" cy="12" r="0" fill="currentColor"
          ><animate
            attributeName="r"
            begin=".67"
            calcMode="spline"
            dur="1.5s"
            keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
            repeatCount="indefinite"
            values="0;2;0;0"
          /></circle
        ><circle cx="12" cy="12" r="0" fill="currentColor"
          ><animate
            attributeName="r"
            begin=".33"
            calcMode="spline"
            dur="1.5s"
            keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
            repeatCount="indefinite"
            values="0;2;0;0"
          /></circle
        ><circle cx="6" cy="12" r="0" fill="currentColor"
          ><animate
            attributeName="r"
            begin="0"
            calcMode="spline"
            dur="1.5s"
            keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
            repeatCount="indefinite"
            values="0;2;0;0"
          /></circle
        ></svg
      >
    </div>
  {:else if loadError}
    <Info variant="warning" size="lg">
      {loadError}
    </Info>
  {:else}
    {#if loadMessage}
      <Info variant="warning" size="lg">
        {loadMessage}
      </Info>
    {/if}

    <ConfigEditor bind:value={jsonContent} {theme} onSave={saveJsonFile} height="75vh" />
  {/if}
</PageLayout>
