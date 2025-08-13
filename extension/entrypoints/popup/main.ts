/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import browser, { Tabs } from 'webextension-polyfill';
import './style.css';
import Tab = Tabs.Tab;

interface StorageResult {
  apiUrl?: string;
  apiKey?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  const apiUrlInput = document.getElementById('apiUrl') as HTMLInputElement;
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const saveSettingsBtn = document.getElementById(
    'saveSettings'
  ) as HTMLButtonElement;
  const sendUrlBtn = document.getElementById('sendUrl') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const currentUrlDiv = document.getElementById('currentUrl') as HTMLDivElement;

  async function getCurrentTab(): Promise<Tab> {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tabs[0];
  }

  const currentTab: Tab = await getCurrentTab();
  if (currentTab.url) {
    currentUrlDiv.textContent = currentTab.url;
  }

  async function loadSettings(): Promise<void> {
    const result = (await browser.storage.local.get([
      'apiUrl',
      'apiKey',
    ])) as StorageResult;
    if (result.apiUrl) {
      apiUrlInput.value = result.apiUrl;
    }
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  }

  async function saveSettings(): Promise<void> {
    const apiUrl: string = apiUrlInput.value.trim();
    const apiKey: string = apiKeyInput.value.trim();

    if (!apiUrl && !apiKey) {
      showStatus('Please fill in all fields', 'error');
      return;
    }

    await browser.storage.local.set({
      apiUrl: apiUrl,
      apiKey: apiKey,
    });

    if (!apiUrl) {
      showStatus('API key saved!', 'success');
      return;
    }

    if (!apiKey) {
      showStatus('URL saved!', 'success');
      return;
    }

    if (apiUrl && apiKey) {
      showStatus('Settings saved successfully!', 'success');
    }
  }

  async function sendCurrentUrl(): Promise<void> {
    const result = (await browser.storage.local.get([
      'apiUrl',
      'apiKey',
    ])) as StorageResult;

    if (!result.apiUrl || !result.apiKey) {
      showStatus('Please save your settings first', 'error');
      return;
    }

    const currentTab: Tab = await getCurrentTab();
    if (!currentTab.url) {
      showStatus('No active tab found', 'error');
      return;
    }

    try {
      const response = (await browser.runtime.sendMessage({
        action: 'sendUrl',
        apiUrl: result.apiUrl,
        apiKey: result.apiKey,
        tabUrl: currentTab.url,
        tabTitle: currentTab.title,
      })) as ApiResponse;

      if (response && response.success) {
        showStatus(response.message, 'success');
      } else if (response) {
        showStatus(
          response.message || 'An unknown error occurred with the API',
          'error'
        );
      } else {
        showStatus(
          'Extension error: No response from background script.',
          'error'
        );
      }
    } catch (error: unknown) {
      let errorMessage = 'An unknown extension error occurred.';
      if (error instanceof Error) {
        errorMessage = `Extension error: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `Extension error: ${error}`;
      }
      showStatus(errorMessage, 'error');
    }
  }

  function showStatus(message: string, type: 'success' | 'error'): void {
    statusDiv.textContent = message;
    statusDiv.className = `p-2 rounded text-sm text-center ${
      type === 'success'
        ? 'bg-green-100 text-green-800 border border-green-200'
        : 'bg-red-100 text-red-800 border border-red-200'
    }`;
    statusDiv.style.display = 'block';

    setTimeout((): void => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  saveSettingsBtn.addEventListener('click', saveSettings);
  sendUrlBtn.addEventListener('click', sendCurrentUrl);

  await loadSettings();

  [apiUrlInput, apiKeyInput].forEach(input => {
    input.addEventListener('keypress', (error): void => {
      if (error.key === 'Enter') {
        saveSettings();
      }
    });
  });
});

class TabManager {
  private activeTab: string = 'send';
  private readonly sendTabButton: HTMLButtonElement;
  private readonly settingsTabButton: HTMLButtonElement;
  private readonly sendTabContent: HTMLDivElement;
  private readonly settingsTabContent: HTMLDivElement;

  constructor() {
    this.sendTabButton = document.getElementById(
      'sendTab'
    ) as HTMLButtonElement;
    this.settingsTabButton = document.getElementById(
      'settingsTab'
    ) as HTMLButtonElement;
    this.sendTabContent = document.getElementById(
      'sendTabContent'
    ) as HTMLDivElement;
    this.settingsTabContent = document.getElementById(
      'settingsTabContent'
    ) as HTMLDivElement;

    this.init();
  }

  private init(): void {
    if (
      !this.sendTabButton ||
      !this.settingsTabButton ||
      !this.sendTabContent ||
      !this.settingsTabContent
    ) {
      return;
    }

    this.sendTabButton.addEventListener('click', () => this.switchTab('send'));
    this.settingsTabButton.addEventListener('click', () =>
      this.switchTab('settings')
    );
    this.loadState();
  }

  private switchTab(tab: string): void {
    this.activeTab = tab;
    this.updateUI();
    this.saveState();
  }

  private updateUI(): void {
    this.sendTabButton.classList.toggle(
      'tab-active',
      this.activeTab === 'send'
    );
    this.settingsTabButton.classList.toggle(
      'tab-active',
      this.activeTab === 'settings'
    );

    this.sendTabContent.classList.toggle(
      'tab-active',
      this.activeTab === 'send'
    );
    this.settingsTabContent.classList.toggle(
      'tab-active',
      this.activeTab === 'settings'
    );
  }

  private saveState(): void {
    browser.storage.local
      .set({ activeTab: this.activeTab })
      // eslint-disable-next-line no-console
      .catch(console.error);
  }

  private loadState(): void {
    browser.storage.local.get(['activeTab']).then(result => {
      this.activeTab = (result.activeTab as string) || 'send';
      this.updateUI();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TabManager();
});
