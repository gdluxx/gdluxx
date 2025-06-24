import fs from 'node:fs';
import type { ReadableStreamDefaultController } from 'node:stream/web';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import { logger } from '$lib/shared/logger';
import { PATHS, TERMINAL } from '$lib/server/constants';

export async function GET({ request }: { request: Request }): Promise<Response> {
  const { spawn } = await import('@homebridge/node-pty-prebuilt-multiarch');
  const requestUrl = new URL(request.url);
  const commandToRunUrl: string | null = requestUrl.searchParams.get('url');
  const useUserConfigPath: boolean = requestUrl.searchParams.get('useUserConfigPath') === 'true';

  logger.info(
    `[SERVER STREAM] URL: ${commandToRunUrl}, Use User Config Path: ${useUserConfigPath}`
  );

  if (!commandToRunUrl) {
    const stream = new ReadableStream({
      start(controller: ReadableStreamDefaultController<Uint8Array>): void {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: 'URL parameter is required' })}\n\n`
          )
        );
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
      const encoder = new TextEncoder();
      function sendEvent(type: string, data: unknown): void {
        let eventString = '';
        if (type !== 'message') {
          eventString += `event: ${type}\n`;
        }
        eventString += `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(eventString));
      }

      sendEvent('info', `gallery-dl path: ${PATHS.BIN_FILE}`);
      sendEvent('info', `Attempting to download: ${commandToRunUrl}`);
      sendEvent('info', `User requests to use their config path: ${useUserConfigPath}`);

      try {
        fs.accessSync(PATHS.BIN_FILE, fs.constants.X_OK);
      } catch (err) {
        let errorMessage = 'An unknown error occurred during fs.accessSync.';
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        sendEvent('error', `gallery-dl.bin not found or not executable. Error: ${errorMessage}`);
        sendEvent('fatal', { message: 'gallery-dl binary misconfigured.' });
        controller.close();
        return;
      }

      const args: string[] = [commandToRunUrl, '--config', './data/config.json'];
      const effectiveCwd: string | undefined = undefined; // Default to project root

      // if (useUserConfigPath) {
      //   sendEvent(
      //     'info',
      //     `Relying on user's gallery-dl config for output path. No '-o' flag set by server.`
      //   );
      //   // Optional: Set a specific CWD if user's config might use relative paths
      //   // effectiveCwd = path.join(os.tmpdir(), 'gdl-web-user-config-runs');
      //   // if (!fs.existsSync(effectiveCwd)) fs.mkdirSync(effectiveCwd, { recursive: true });
      // } else {
      //   // Server defines output path
      //   if (!fs.existsSync(serverDefinedOutputBase)) {
      //     fs.mkdirSync(serverDefinedOutputBase, { recursive: true });
      //     sendEvent('info', `Created server base output directory: ${serverDefinedOutputBase}`);
      //   }
      //   const safeUrlPart: string = commandToRunUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      //   const timestamp: string = new Date().toISOString().replace(/[:.]/g, '-');
      //   const uniqueOutputDir: string = path.join(
      //     serverDefinedOutputBase,
      //     `${timestamp}_${safeUrlPart}`
      //   );
      //   if (!fs.existsSync(uniqueOutputDir)) {
      //     fs.mkdirSync(uniqueOutputDir, { recursive: true });
      //   }
      //   args.push(
      //     '-o',
      //     `output-format=${path.join(uniqueOutputDir, '%(extractor)s/%(category)s/%(artist)s/%(album)s/%(filename)s.%(ext)s')}`
      //   );
      //   sendEvent('info', `Server-defined output directory: ${uniqueOutputDir}`);
      //   // effectiveCwd = uniqueOutputDir; // Or serverDefinedOutputBase or undefined
      // }

      sendEvent(
        'info',
        `Executing in PTY: ${PATHS.BIN_FILE} ${args.join(' ')} ${effectiveCwd ? `(CWD: ${effectiveCwd})` : '(CWD: project root or default)'}`
      );

      try {
        const ptyProcess: IPty = spawn(PATHS.BIN_FILE, args, {
          name: TERMINAL.NAME,
          cols: TERMINAL.COLS,
          rows: TERMINAL.ROWS,
          cwd: effectiveCwd,
          env: {
            ...process.env,
            NO_COLOR: '0',
            TERM: TERMINAL.NAME,
          },
        });

        ptyProcess.onData((data: string): void => {
          // All output stdout & stderr from a job comes through here
          logger.info('[PTY RAW DATA]:', JSON.stringify(data)); // For debugging ANSI codes

          sendEvent('message', data);
        });

        ptyProcess.onExit(
          ({ exitCode, signal }: { exitCode: number; signal?: number | undefined }) => {
            sendEvent(
              'info',
              `Process exited with code ${exitCode}${signal ? ` (signal ${signal})` : ''}.`
            );
            sendEvent('close', { code: exitCode });
            controller.close();
          }
        );

        request.signal.addEventListener('abort', (): void => {
          sendEvent('info', 'Client disconnected. Terminating gallery-dl process.');
          if (ptyProcess?.pid) {
            ptyProcess.kill();
          }
          controller.close();
        });
      } catch (spawnError) {
        let errorMessage = 'Failed to spawn PTY process.';
        if (spawnError instanceof Error) {
          errorMessage = spawnError.message;
        } else if (typeof spawnError === 'string') {
          errorMessage = spawnError;
        }
        logger.error('PTY Spawn Error:', spawnError);
        sendEvent('error', `Failed to start subprocess with PTY: ${errorMessage}`);
        sendEvent('fatal', { message: `PTY process error: ${errorMessage}` });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
