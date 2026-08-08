/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const EXTENSION_PROTOCOL_VERSION = 1;

export const EXTENSION_CAPABILITIES = [
  'cookies.sync', // /api/extension/cookies exists
  'jobs.polling', // /api/extension/jobs exists
  'extraction.directorySource', // backup schema preserves this field
  'extraction.accumulate', // backup schema preserves this field
] as const;
