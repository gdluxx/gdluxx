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
  import { Button, FileDropzone, Modal } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast';

  type UploadType = 'config' | 'urls';
  type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

  interface UploadModalProps {
    show: boolean;
    type: UploadType;
    size?: ModalSize;
    showCloseButton?: boolean;
    preventEscapeClose?: boolean;
    preventBackdropClose?: boolean;
    onClose: () => void;
    onUploadSuccess?: (file: File) => void;
  }

  const {
    show = false,
    type,
    size = 'md',
    showCloseButton: _showCloseButton = true,
    preventEscapeClose = false,
    preventBackdropClose: _preventBackdropClose = false,
    onClose,
    onUploadSuccess,
  }: UploadModalProps = $props();

  let selectedFile: File | null = $state(null);
  let isUploading = $state(false);

  const uploadConfig = $derived(
    type === 'config'
      ? {
          title: 'Upload configuration file',
          description: 'Upload a gallery-dl config file (.json)',
          acceptedTypes: '.json',
          endpoint: '/config',
        }
      : type === 'urls'
        ? {
            title: 'Upload URL file',
            description: 'Upload a text file containing URLs to download',
            acceptedTypes: '.txt,.text',
            endpoint: '/',
          }
        : {
            title: 'Upload file',
            description: 'Upload a file',
            acceptedTypes: '*',
            endpoint: '/upload',
          },
  );

  // Reset transient state whenever the modal is (re)opened.
  $effect(() => {
    if (show) {
      selectedFile = null;
      isUploading = false;
    }
  });

  function handleClose(): void {
    onClose();
  }

  async function handleUpload() {
    if (!selectedFile) {
      toastStore.error('Please select a file to upload');
      return;
    }

    isUploading = true;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(uploadConfig.endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toastStore.success(`File "${selectedFile.name}" uploaded successfully`);

      onUploadSuccess?.(selectedFile);
      handleClose();
    } catch (error) {
      toastStore.error(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      isUploading = false;
    }
  }

  function handleRemoveFile() {
    selectedFile = null;
  }
</script>

<Modal
  {show}
  {size}
  closeOnEscape={!preventEscapeClose}
  onClose={handleClose}
>
  {#snippet header()}
    <div class="flex items-center border-b-strong px-6 py-4 pr-14">
      <h2
        id="modal-title"
        class="text-xl font-semibold text-foreground"
      >
        {uploadConfig.title}
      </h2>
    </div>
  {/snippet}

  <div class="p-6">
    <p
      id="modal-description"
      class="mb-6 text-foreground"
    >
      {uploadConfig.description}
    </p>

    <FileDropzone
      bind:selectedFile
      accept={uploadConfig.acceptedTypes}
      ariaLabel="Click to select file or drag and drop"
    />
  </div>

  {#snippet footer()}
    <div class="flex items-center justify-end gap-3 border-t-strong px-6 py-4">
      {#if selectedFile}
        <Button
          variant="outline-warning"
          onclick={handleRemoveFile}
        >
          Remove file
        </Button>
      {/if}
      <Button
        variant="default"
        onclick={handleClose}
        type="button"
      >
        Cancel
      </Button>

      <Button
        variant="primary"
        loading={isUploading}
        disabled={!selectedFile}
        onclick={handleUpload}
        type="button"
      >
        {isUploading ? 'Uploading...' : 'Upload file'}
      </Button>
    </div>
  {/snippet}
</Modal>
