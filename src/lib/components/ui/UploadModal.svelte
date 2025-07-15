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
  import { scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { Button } from '$lib/components/ui';
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
    showCloseButton = true,
    preventEscapeClose = false,
    preventBackdropClose = false,
    onClose,
    onUploadSuccess,
  }: UploadModalProps = $props();

  let modalElement: HTMLDivElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();
  let selectedFile: File | null = $state(null);
  let isDragOver = $state(false);
  let isUploading = $state(false);
  let previouslyFocusedElement: HTMLElement | null = $state(null);

  const sizeClasses: Record<ModalSize, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
  };

  const uploadConfig = $derived(
    type === 'config'
      ? {
          title: 'Upload Configuration File',
          description: 'Upload a JSON configuration file for gallery-dl',
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
          }
  );

  // Focus
  $effect(() => {
    if (show) {
      previouslyFocusedElement = document.activeElement as HTMLElement;
      selectedFile = null;
      isDragOver = false;
      isUploading = false;

      setTimeout(() => {
        if (modalElement) {
          const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          if (firstElement) {
            firstElement.focus();
          } else {
            modalElement.focus();
          }
        }
      }, 100);
    } else if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !preventEscapeClose) {
      event.preventDefault();
      handleClose();
      return;
    }

    if (event.key === 'Tab' && modalElement) {
      const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !preventBackdropClose) {
      handleClose();
    }
  }

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
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  const dialogClasses = $derived(
    [
      'w-full',
      'flex',
      'flex-col',
      'bg-white',
      'border',
      'border-secondary-200',
      'shadow-xl',
      'rounded-lg',
      'pointer-events-auto',
      'dark:bg-secondary-800',
      'dark:border-secondary-700',
      sizeClasses[size],
    ].join(' ')
  );
</script>

{#if show}
  <div
    bind:this={modalElement}
    class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    aria-describedby="modal-description"
    tabindex="0"
  >
    <!-- Modal dialog -->
    <div
      class={dialogClasses}
      transition:scale={{ duration: 200, easing: quintOut, start: 0.95 }}
      role="document"
    >
      <!-- Header -->
      <div
        class="flex justify-between items-center py-4 px-6 border-b border-secondary-200 dark:border-secondary-700"
      >
        <h3
          id="modal-title"
          class="text-lg font-semibold text-secondary-900 dark:text-secondary-100"
        >
          {uploadConfig.title}
        </h3>

        {#if showCloseButton}
          <button
            type="button"
            onclick={handleClose}
            class="cursor-pointer flex-shrink-0 w-8 h-8 inline-flex justify-center items-center rounded-full border border-transparent bg-secondary-100 text-secondary-800 hover:bg-secondary-200 focus:outline-hidden focus:bg-secondary-200 focus:ring-2 focus:ring-secondary-300 transition-all dark:bg-secondary-700 dark:hover:bg-secondary-600 dark:text-secondary-400 dark:focus:bg-secondary-600 dark:focus:ring-secondary-500"
            aria-label="Close modal"
          >
            <span class="sr-only">Close</span>
            <Icon iconName="close" size={12} />
          </button>
        {/if}
      </div>

      <!-- Content -->
      <div class="p-6">
        <p id="modal-description" class="text-secondary-700 dark:text-secondary-300 mb-6">
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
          class="relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer {isDragOver
            ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950'
            : selectedFile
              ? 'border-success-400 bg-success-50 dark:border-success-500 dark:bg-success-950'
              : 'border-secondary-300 hover:border-secondary-400 dark:border-secondary-600 dark:hover:border-secondary-500'}"
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          role="button"
          tabindex="0"
          onclick={handleButtonClick}
          onkeydown={e => e.key === 'Enter' && handleButtonClick()}
          aria-label="Click to select file or drag and drop"
        >
          <div class="space-y-4">
            {#if selectedFile}
              <!-- Display selected file -->
              <div class="flex items-center justify-center">
                <Icon
                  iconName="circle"
                  size={48}
                  class="text-success-500"
                  ariaLabel="File selected"
                />
              </div>
              <div>
                <p class="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                  {selectedFile.name}
                </p>
                <p class="text-sm text-secondary-500 dark:text-secondary-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button variant="outline-secondary" size="sm" onclick={handleRemoveFile}>
                Remove file
              </Button>
            {:else}
              <!-- Upload prompt -->
              <div class="flex items-center justify-center">
                <Icon
                  iconName="plus"
                  size={48}
                  class="text-secondary-400 dark:text-secondary-500"
                  ariaLabel="Upload icon"
                />
              </div>
              <div>
                <p class="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                  Click to upload or drag and drop
                </p>
                <p class="text-sm text-secondary-500 dark:text-secondary-400">
                  Select a {type === 'config' ? 'configuration' : 'text'} file from your computer
                </p>
              </div>
            {/if}
          </div>

          {#if isDragOver}
            <div
              class="absolute inset-0 bg-primary-100 dark:bg-primary-900 opacity-50 rounded-lg"
            ></div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      {#if selectedFile}
        <div
          class="flex justify-end items-center gap-3 py-4 px-6 border-t border-secondary-200 dark:border-secondary-700"
        >
          <Button variant="outline-secondary" size="sm" onclick={handleClose} type="button"
            >Cancel</Button
          >

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
  </div>
{/if}
