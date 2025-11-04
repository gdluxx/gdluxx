/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { ensureOrigins, syncOverlayRegistrationFromPermissions } from '#src/background/permissions';
import type { ProfilesBundle } from '#src/content/lib/utils/storageProfiles';
import type { SubsBundle } from '#src/content/lib/utils/storageSubstitution';
import {
  proxyPing,
  proxyCommand,
  proxyProfilesGet,
  proxyProfilesPut,
  proxyProfilesDelete,
  proxySubsGet,
  proxySubsPut,
  proxySubsDelete,
  type ProxyApiResult,
} from '#src/background/apiProxy';

interface SendUrlMessage {
  action: 'sendUrl';
  apiUrl: string;
  apiKey: string;
  tabUrl: string;
  tabTitle?: string;
}

interface ShowNotificationMessage {
  action: 'showNotification';
  title: string;
  message: string;
}

interface SyncOverlayRegistrationMessage {
  action: 'syncOverlayRegistration';
}

interface PingMessage {
  action: 'ping';
  serverUrl: string;
  apiKey: string;
}

interface SendCommandMessage {
  action: 'sendCommand';
  serverUrl: string;
  apiKey: string;
  urls: string[];
  customDirectory?: string;
}

interface GetProfilesMessage {
  action: 'getProfiles';
  serverUrl: string;
  apiKey: string;
}

interface SaveProfilesMessage {
  action: 'saveProfiles';
  serverUrl: string;
  apiKey: string;
  bundle: ProfilesBundle;
  syncedBy?: string;
}

interface DeleteProfilesMessage {
  action: 'deleteProfiles';
  serverUrl: string;
  apiKey: string;
}

interface GetSubsMessage {
  action: 'getSubs';
  serverUrl: string;
  apiKey: string;
}

interface SaveSubsMessage {
  action: 'saveSubs';
  serverUrl: string;
  apiKey: string;
  bundle: SubsBundle;
  syncedBy?: string;
}

interface DeleteSubsMessage {
  action: 'deleteSubs';
  serverUrl: string;
  apiKey: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

type ProxyMessage =
  | PingMessage
  | SendCommandMessage
  | GetProfilesMessage
  | SaveProfilesMessage
  | DeleteProfilesMessage
  | GetSubsMessage
  | SaveSubsMessage
  | DeleteSubsMessage;

type MessageType =
  | SendUrlMessage
  | ShowNotificationMessage
  | SyncOverlayRegistrationMessage
  | ProxyMessage;

type BackgroundResponse = ApiResponse | ProxyApiResult<unknown>;

export default defineBackground((): void => {
  function formatOriginPattern(url: string): string | null {
    try {
      const { origin } = new URL(url);
      return `${origin}/*`;
    } catch {
      return null;
    }
  }

  async function toggleOverlayInTab(tabId: number): Promise<void> {
    try {
      await browser.tabs.sendMessage(tabId, { action: 'toggleOverlay' });
    } catch {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/overlay.js'],
      });
      await browser.tabs.sendMessage(tabId, { action: 'toggleOverlay' });
    }
  }

  browser.runtime.onInstalled.addListener(async () => {
    await syncOverlayRegistrationFromPermissions();
  });

  browser.permissions.onAdded.addListener(async (perms) => {
    if (!perms.origins?.length) return;
    await syncOverlayRegistrationFromPermissions();
  });

  browser.contextMenus.create({
    id: 'open-overlay-panel',
    title: 'Open gdluxx',
    contexts: ['page'],
  });

  browser.contextMenus.create({
    id: 'send-image-to-gdluxx',
    title: 'gdluxx: send image',
    contexts: ['image'],
  });

  browser.contextMenus.create({
    id: 'send-link-to-gdluxx',
    title: 'gdluxx: send URL',
    contexts: ['link'],
  });

  function isSendUrlMessage(message: MessageType): message is SendUrlMessage {
    return message && typeof message === 'object' && message.action === 'sendUrl';
  }

  function isShowNotificationMessage(message: MessageType): message is ShowNotificationMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      'action' in message &&
      message.action === 'showNotification' &&
      'title' in message &&
      typeof message.title === 'string' &&
      'message' in message &&
      typeof message.message === 'string'
    );
  }

  browser.runtime.onMessage.addListener(
    (
      message: MessageType,
      _sender,
      sendResponse: (response?: BackgroundResponse) => void,
    ): true | undefined => {
      if (isSendUrlMessage(message)) {
        (async (): Promise<void> => {
          const result = await proxyCommand(message.apiUrl, message.apiKey, [message.tabUrl]);
          if (result.success) {
            sendResponse({
              success: true,
              message: result.message ?? 'URL sent successfully!',
              data: (result.data ?? undefined) as Record<string, unknown> | undefined,
            });
          } else {
            sendResponse({
              success: false,
              message: result.error ?? 'Failed to send URL',
            });
          }
        })();

        return true;
      }

      if (isShowNotificationMessage(message)) {
        const notificationPromise = browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: message.title,
          message: message.message,
        });

        notificationPromise
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error('Failed to show notification', error);
            sendResponse({
              success: false,
              message: error instanceof Error ? error.message : String(error),
            });
          });

        return true;
      }

      if (message.action === 'syncOverlayRegistration') {
        (async () => {
          await syncOverlayRegistrationFromPermissions();
          sendResponse({ success: true, message: 'Overlay registration synced' });
        })();

        return true;
      }

      switch (message.action) {
        case 'ping':
          (async () => {
            sendResponse(await proxyPing(message.serverUrl, message.apiKey));
          })();
          return true;
        case 'sendCommand':
          (async () => {
            const urls = Array.isArray(message.urls) ? message.urls : [];
            sendResponse(
              await proxyCommand(message.serverUrl, message.apiKey, urls, message.customDirectory),
            );
          })();
          return true;
        case 'getProfiles':
          (async () => {
            sendResponse(await proxyProfilesGet(message.serverUrl, message.apiKey));
          })();
          return true;
        case 'saveProfiles':
          (async () => {
            sendResponse(
              await proxyProfilesPut(
                message.serverUrl,
                message.apiKey,
                message.bundle,
                message.syncedBy,
              ),
            );
          })();
          return true;
        case 'deleteProfiles':
          (async () => {
            sendResponse(await proxyProfilesDelete(message.serverUrl, message.apiKey));
          })();
          return true;
        case 'getSubs':
          (async () => {
            sendResponse(await proxySubsGet(message.serverUrl, message.apiKey));
          })();
          return true;
        case 'saveSubs':
          (async () => {
            sendResponse(
              await proxySubsPut(
                message.serverUrl,
                message.apiKey,
                message.bundle,
                message.syncedBy,
              ),
            );
          })();
          return true;
        case 'deleteSubs':
          (async () => {
            sendResponse(await proxySubsDelete(message.serverUrl, message.apiKey));
          })();
          return true;
        default:
          break;
      }

      return undefined;
    },
  );

  async function sendUrlToGdluxx(url: string, urlType: 'image' | 'link'): Promise<void> {
    try {
      const result = await browser.storage.local.get(['gdluxx_server_url', 'gdluxx_api_key']);

      if (!result.gdluxx_server_url || !result.gdluxx_api_key) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: 'gdluxx Extension',
          message: 'Configure gdluxx URL and API Key in extension settings.',
        });
        return;
      }

      const cleanedUrl = url.replace(/\/+$/, '');

      const sendResult = await proxyCommand(result.gdluxx_server_url, result.gdluxx_api_key, [
        cleanedUrl,
      ]);

      if (sendResult.success) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: 'gdluxx Extension',
          message:
            sendResult.message ??
            `${urlType === 'image' ? 'Image URL' : 'URL'} sent successfully to gdluxx!`,
        });
      } else {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: 'gdluxx Extension',
          message:
            sendResult.error ??
            `Failed to send ${urlType === 'image' ? 'image URL' : 'URL'} to gdluxx.`,
        });
      }
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : 'Unknown error occurred';
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'icon/48.png',
        title: 'gdluxx Extension',
        message: `Network error: ${errorMessage}`,
      });
    }
  }

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'open-overlay-panel') {
      if (!tab?.id || !tab.url) {
        return;
      }

      const originPattern = formatOriginPattern(tab.url);
      if (!originPattern) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: 'gdluxx Extension',
          message: 'Unable to determine origin for this page.',
        });
        return;
      }

      const granted = await ensureOrigins([originPattern]);
      if (!granted) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: 'gdluxx Extension',
          message: 'Permission denied. Overlay remains disabled for this site.',
        });
        return;
      }

      await syncOverlayRegistrationFromPermissions();
      await toggleOverlayInTab(tab.id);
      return;
    }

    if (info.menuItemId === 'send-image-to-gdluxx' && info.srcUrl) {
      await sendUrlToGdluxx(info.srcUrl, 'image');
      return;
    }

    if (info.menuItemId === 'send-link-to-gdluxx' && info.linkUrl) {
      if (!tab?.url) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: 'gdluxx Extension',
          message: 'Unable to resolve the link because the page URL is unavailable.',
        });
        return;
      }

      try {
        const urlObject = new URL(info.linkUrl, tab.url);

        if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'icon/48.png',
            title: 'gdluxx Extension',
            message: 'Only HTTP/HTTPS URLs can be sent to gdluxx.',
          });
          return;
        }

        await sendUrlToGdluxx(urlObject.href, 'link');
      } catch (_error) {
        // Invalid URL format
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: 'gdluxx Extension',
          message: 'Invalid URL format.',
        });
      }
    }
  });
});
