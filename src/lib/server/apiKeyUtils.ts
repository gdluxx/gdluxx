import type { ApiKey } from '$lib/types/apiKey';

export function isValidApiKey(item: unknown): item is ApiKey {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).id === 'string' &&
    typeof (item as Record<string, unknown>).name === 'string' &&
    typeof (item as Record<string, unknown>).hashedKey === 'string' &&
    typeof (item as Record<string, unknown>).createdAt === 'string'
  );
}
