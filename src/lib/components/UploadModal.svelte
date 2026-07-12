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
  import { Button, Modal } from '$lib/components/ui';
  import { Icon } from '$lib/components';
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

  let fileInput: HTMLInputElement | undefined = $state();
  let selectedFile: File | null = $state(null);
  let isDragOver = $state(false);
  let isUploading = $state(false);

  const uploadConfig = $derived(
    type === 'config'
      ? {
          title: 'Upload Configuration File',
          description: 'Select an existing gallery-dl config',
          acceptedTypes: '.json',
          endpoint: '/config',
        }
      : type === 'urls'
        ? {
            title: 'Upload URL File',
            description: 'Upload a text file containing URLs to download',
            acceptedTypes: '.txt,.text',
            endpoint: '/',
          }
        : {
            title: 'Upload File',
            description: 'Upload a file',
            acceptedTypes: '*',
            endpoint: '/upload',
          },
  );

  // Reset transient state whenever the modal is (re)opened.
  $effect(() => {
    if (show) {
      selectedFile = null;
      isDragOver = false;
      isUploading = false;
    }
  });

  function handleClose(): void {
    onClose();
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files?.[0]) {
      selectedFile = target.files[0];
    }
  }

  function handleButtonClick() {
    fileInput?.click();
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    if (!(event.currentTarget as Element)?.contains(event.relatedTarget as Node | null)) {
      isDragOver = false;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files?.[0]) {
      selectedFile = files[0];
    }
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
    if (fileInput) {
      fileInput.value = '';
    }
  }
</script>

<Modal
  {show}
  {size}
  closeOnEscape={!preventEscapeClose}
  onClose={handleClose}
>
  <div class="flex w-full flex-col">
    <!-- Header -->
    <div class="flex items-center border-b px-6 py-4 pr-14">
      <h3
        id="modal-title"
        class="text-lg font-semibold text-foreground"
      >
        {uploadConfig.title}
      </h3>
    </div>

    <!-- Content -->
    <div class="p-6">
      <p
        id="modal-description"
        class="mb-6 text-foreground"
      >
        {uploadConfig.description}
      </p>

      <!-- file input -->
      <input
        bind:this={fileInput}
        type="file"
        accept={uploadConfig.acceptedTypes}
        class="sr-only"
        onchange={handleFileSelect}
        aria-label="Select file to upload"
      />

      <!-- Drop zone -->
      <div
        class="relative cursor-pointer rounded-sm border-2 border-dashed p-8 text-center transition-colors {isDragOver
          ? 'bg-primary'
          : selectedFile
            ? 'border-solid border-success bg-success/10'
            : 'border-primary'}"
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        role="button"
        tabindex="0"
        onclick={handleButtonClick}
        onkeydown={(e) => e.key === 'Enter' && handleButtonClick()}
        aria-label="Click to select file or drag and drop"
      >
        <div class="space-y-4">
          {#if selectedFile}
            <!-- Display selected file -->
            <div class="flex items-center justify-center">
              <Icon
                iconName="circle"
                size={48}
                class="text-success"
                ariaLabel="File selected"
              />
            </div>
            <div>
              <p class="text-lg font-medium text-success">
                {selectedFile.name}
              </p>
              <p class="text-sm text-success">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          {:else}
            <!-- Upload prompt -->
            <div class="flex items-center justify-center">
              <Icon
                iconName="plus"
                size={48}
                class="text-primary"
                ariaLabel="Upload icon"
              />
            </div>
            <div>
              <p class="text-lg font-medium text-muted-foreground">
                Click to upload or drag and drop
              </p>
            </div>
          {/if}
        </div>

        {#if isDragOver}
          <div class="absolute inset-0 rounded-sm opacity-50"></div>
        {/if}
      </div>
    </div>

    <!-- Footer -->
    {#if selectedFile}
      <div class="flex items-center justify-end gap-3 border-t px-6 py-4">
        <Button
          variant="outline-warning"
          size="sm"
          onclick={handleRemoveFile}
        >
          Remove file
        </Button>
        <Button
          variant="default"
          size="sm"
          onclick={handleClose}
          type="button"
        >
          Cancel
        </Button>

        <Button
          variant="primary"
          size="sm"
          loading={isUploading}
          disabled={!selectedFile}
          onclick={handleUpload}
          type="button"
        >
          {isUploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </div>
    {/if}
  </div>
</Modal>
