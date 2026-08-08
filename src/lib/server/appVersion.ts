/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// Vite resolves this JSON import at build time (see `resolveJsonModule` in
// tsconfig.json), so there is no runtime file read involved. This is the
// gdluxx *application* version and unrelated to the gallery-dl binary version
// tracked by `$lib/server/version/versionManager.ts` and the `version` table.
import packageJson from '../../../package.json';

export const APP_VERSION: string = packageJson.version;
