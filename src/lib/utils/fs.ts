import { mkdir } from 'fs/promises';
import { mkdirSync, existsSync } from 'fs';

export async function ensureDir(dirPath: string): Promise<boolean> {
  try {
    await mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    const errorCode: string | undefined = (error as { code?: string })?.code;
    return errorCode === 'EEXIST';
  }
}

export function ensureDirSync(dirPath: string): boolean {
  try {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}
