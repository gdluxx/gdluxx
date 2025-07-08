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
              !baseApiUrl.startsWith('https://')
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
});
