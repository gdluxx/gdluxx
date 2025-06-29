/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// import { mkdir } from 'fs/promises';
// import { mkdirSync, existsSync } from 'fs';

export async function ensureDir(dirPath: string): Promise<boolean> {
  try {
    const { mkdir } = await import('fs/promises');
    await mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    const errorCode: string | undefined = (error as { code?: string })?.code;
    return errorCode === 'EEXIST';
  }
}
