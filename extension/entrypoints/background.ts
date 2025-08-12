interface SendUrlMessage {
  action: 'sendUrl';
  apiUrl: string;
  apiKey: string;
  tabUrl: string;
  tabTitle?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

type MessageType = SendUrlMessage | Record<string, unknown>;

type SendResponseType = (response?: ApiResponse) => void;

export default defineBackground((): void => {
  const urlBuilder = {
    secureScheme: 'https://',
    endpoint: 'api/extension/external',
  };

  browser.contextMenus.create({
    id: 'send-image-to-gdluxx',
    title: 'Send to gdluxx',
    contexts: ['image'],
  });

  function isSendUrlMessage(message: MessageType): message is SendUrlMessage {
    return (
      message && typeof message === 'object' && message.action === 'sendUrl'
    );
  }

  browser.runtime.onMessage.addListener(
    (
      message: MessageType,
      _sender,
      sendResponse: SendResponseType
    ): true | undefined => {
      if (isSendUrlMessage(message)) {
        (async (): Promise<void> => {
          try {
            let baseApiUrl: string = message.apiUrl;
            if (
              !baseApiUrl.startsWith('https://') &&
              !baseApiUrl.startsWith('http://')
            ) {
              baseApiUrl = urlBuilder.secureScheme + baseApiUrl;
            }
            const fullApiUrl: string = new URL(
              urlBuilder.endpoint,
              baseApiUrl
            ).toString();

            const requestBody = {
              urlToProcess: message.tabUrl,
            };

            const fetchResponse: Response = await fetch(fullApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${message.apiKey}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (fetchResponse.ok) {
              const result: Record<string, unknown> =
                await fetchResponse.json();
              sendResponse({
                success: true,
                message: 'URL sent successfully!',
                data: result,
              });
            } else {
              const errorText: string = await fetchResponse.text();
              sendResponse({
                success: false,
                message: `Error: ${fetchResponse.status} ${fetchResponse.statusText} - ${errorText}`,
              });
            }
          } catch (error) {
            const errorMessage: string =
              error instanceof Error ? error.message : 'Unknown error occurred';
            sendResponse({
              success: false,
              message: `Network error: ${errorMessage}`,
            });
          }
        })();

        return true;
      }
    }
  );

  browser.contextMenus.onClicked.addListener(async (info, _tab) => {
    if (info.menuItemId === 'send-image-to-gdluxx' && info.srcUrl) {
      try {
        const result = await browser.storage.local.get(['apiUrl', 'apiKey']);

        if (!result.apiUrl || !result.apiKey) {
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'icon/48.png',
            title: 'gdluxx Extension',
            message:
              'Please configure API URL and API Key in extension settings first.',
          });
          return;
        }

        let baseApiUrl: string = result.apiUrl;
        if (
          !baseApiUrl.startsWith('https://') &&
          !baseApiUrl.startsWith('http://')
        ) {
          baseApiUrl = urlBuilder.secureScheme + baseApiUrl;
        }
        const fullApiUrl: string = new URL(
          urlBuilder.endpoint,
          baseApiUrl
        ).toString();

        const requestBody = {
          urlToProcess: info.srcUrl,
        };

        const fetchResponse: Response = await fetch(fullApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${result.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (fetchResponse.ok) {
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'icon/48.png',
            title: 'gdluxx Extension',
            message: 'Image URL sent successfully to gdluxx!',
          });
        } else {
          const errorText: string = await fetchResponse.text();
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'icon/48.png',
            title: 'gdluxx Extension',
            message: `Error: ${fetchResponse.status} ${fetchResponse.statusText}${errorText ? ' - ' + errorText : ''}`,
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
  });
});
