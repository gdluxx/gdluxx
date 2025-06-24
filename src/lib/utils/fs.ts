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
