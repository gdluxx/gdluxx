/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { serverLogger as logger } from '$lib/server/logger';
import { PATHS } from '$lib/server/constants';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { keywordInfoSchema } from '$lib/server/validation/keyword-validation';

// `execFile` (no shell) so the user-supplied URL is passed as a discrete argv
// entry and can never be interpreted as shell syntax. The validation schema
// only enforces an `^https?://.+` prefix, which does NOT block shell
// metacharacters (`;`, `|`, `$()`, backticks, spaces, ...), so a shell-string
// invocation would be injectable.
const execFileAsync = promisify(execFile);

interface KeywordInfoRequestBody {
  url: unknown;
  command: unknown;
}

export interface KeywordSection {
  title: string;
  keywords: Array<{ name: string; example: string }>;
}

interface KeywordInfoResponse {
  output: string;
  sections?: KeywordSection[];
}

const DASHES_RE = /^-{3,}\s*$/;

/**
 * Parse the stdout of `gallery-dl --list-keywords` into structured sections.
 *
 * The output is a series of sections, each introduced by a header line
 * ("Keywords for directory names:") immediately followed by a line of dashes,
 * then keyword/example pairs where the keyword sits at column 0 and its example
 * value is on the next line, indented by two spaces (the example may be empty).
 * Keyword names may be nested dict/list paths, e.g. `account['id']` or
 * `media_asset['variants'][N]['url']`; these are preserved verbatim so wrapping
 * them in braces yields a valid gallery-dl format string.
 *
 * Defensive: returns `null` when nothing sensible was parsed (e.g. the input is
 * `--extractor-info` output or an error blob), so the caller can fall back to
 * the raw text view.
 */
function parseListKeywords(raw: string): KeywordSection[] | null {
  const lines = raw.split('\n');
  const sections: KeywordSection[] = [];
  let current: KeywordSection | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : '';

    // Section header: non-indented, non-empty line followed by a dashes line.
    if (line.trim() !== '' && !/^\s/.test(line) && DASHES_RE.test(next)) {
      current = { title: line.replace(/:\s*$/, '').trim(), keywords: [] };
      sections.push(current);
      i += 2; // skip header + dashes
      continue;
    }

    // Keyword / example pair: a non-indented, non-empty, non-dashes line whose
    // example value is the (indented) line that follows.
    if (current && line.trim() !== '' && !/^\s/.test(line) && !DASHES_RE.test(line)) {
      const name = line.trim();
      let example = '';
      if (i + 1 < lines.length && /^\s/.test(lines[i + 1])) {
        example = lines[i + 1].trim();
        i += 2;
      } else {
        i += 1;
      }
      current.keywords.push({ name, example });
      continue;
    }

    i += 1; // blank line / separator / unexpected content
  }

  const usable = sections.filter((section) => section.keywords.length > 0);
  return usable.length > 0 ? usable : null;
}

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  let body: KeywordInfoRequestBody;

  try {
    try {
      body = await request.json();
    } catch (jsonParseError) {
      logger.warn('Failed to parse request body as JSON for /api/keyword-info:', jsonParseError);
      return handleApiError(new Error('Invalid request body. Expected valid JSON.'));
    }

    if (typeof body !== 'object' || body === null) {
      logger.warn('Request body is not a valid JSON object for /api/keyword-info:', body);
      return handleApiError(new Error('Invalid request body. Expected a JSON object.'));
    }

    try {
      validateInput(
        {
          url: body.url,
          command: body.command,
        },
        keywordInfoSchema,
      );
    } catch (error) {
      return handleApiError(error as Error);
    }
  } catch (error) {
    logger.warn('Unexpected error processing keyword-info request:', error);
    return handleApiError(error as Error);
  }

  const url = body.url as string;
  const command = body.command as string;

  const galleryDlFlag = command === 'list-keywords' ? '--list-keywords' : '--extractor-info';
  const commandArgs = [galleryDlFlag, url, '--config', PATHS.CONFIG_FILE];

  logger.info(`Executing keyword info command: ${PATHS.BIN_FILE} ${commandArgs.join(' ')}`);

  try {
    const { stdout, stderr } = await execFileAsync(PATHS.BIN_FILE, commandArgs, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    });

    const output = stdout.trim() || stderr.trim();

    if (!output) {
      logger.warn(
        `Empty output from gallery-dl command: ${PATHS.BIN_FILE} ${commandArgs.join(' ')}`,
      );
      return handleApiError(new Error('No output received from gallery-dl command.'));
    }

    logger.info(`Keyword info command completed successfully for URL: ${url}, command: ${command}`);

    const response: KeywordInfoResponse = {
      output,
    };

    // For list-keywords, attach structured sections alongside the raw output.
    // Parse from stdout only (stderr may hold warnings). If parsing yields
    // nothing usable, omit `sections` and the client falls back to raw text
    if (command === 'list-keywords') {
      const sections = parseListKeywords(stdout);
      if (sections) {
        response.sections = sections;
      } else {
        logger.warn(`Could not parse --list-keywords output into sections for URL: ${url}`);
      }
    }

    return createApiResponse(response);
  } catch (error: unknown) {
    logger.error(
      `Failed to execute gallery-dl command: ${PATHS.BIN_FILE} ${commandArgs.join(' ')}`,
      error,
    );

    // Is this a gallery-dl error? unsupported URL, etc.
    const stderr =
      error && typeof error === 'object' && 'stderr' in error && typeof error.stderr === 'string'
        ? error.stderr
        : '';
    const message = error instanceof Error ? error.message : '';

    if (
      stderr.includes('Unsupported URL') ||
      message.includes('Unsupported URL') ||
      stderr.includes('gallery-dl: Unsupported URL') ||
      message.includes('gallery-dl: Unsupported URL') ||
      stderr.includes('No suitable extractor') ||
      message.includes('No suitable extractor')
    ) {
      logger.info(`Gallery-dl domain error detected for URL: ${url}`);
      // When it's a gallery-dl domain result and not an app error return 200 OK with success: false
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "This URL is not supported by gallery-dl or you've entered it incorrectly. Check the supported sites list and try a different URL.",
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        return handleApiError(
          new Error("gallery-dl binary not found. Go to 'Settings -> Version' to download it."),
        );
      }
      if (error.message.includes('timeout')) {
        return handleApiError(new Error('Command timed out. Try again.'));
      }
      if (error.message.includes('No module named')) {
        return handleApiError(new Error('Unsupported URL or extractor not available.'));
      }
    }

    return handleApiError(
      new Error('Failed to execute gallery-dl command. Please check the URL and try again.'),
    );
  }
};
