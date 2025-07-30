import type { Load } from '@sveltejs/kit';
import { serverLogger as logger } from '$lib/server/logger';

export interface PageLoadOptions {
  endpoint: string;
  fallback?: unknown;
  errorMessage?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

export const createPageLoad = ({
  endpoint,
  fallback = null,
  errorMessage,
}: PageLoadOptions): Load => {
  return async ({ fetch }) => {
    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const apiResponse: ApiResponse = await response.json();

      if (apiResponse.success && apiResponse.data !== undefined) {
        return {
          success: true,
          ...apiResponse.data,
        };
      } else if (!apiResponse.success) {
        return {
          success: false,
          error: apiResponse.error || errorMessage || 'Failed to load data',
          ...(typeof fallback === 'object' && fallback !== null ? fallback : {}),
        };
      }

      return apiResponse;
    } catch (error) {
      logger.error(`Error loading ${endpoint}:`, error);

      return {
        success: false,
        error: errorMessage || 'Failed to load data',
        ...(typeof fallback === 'object' && fallback !== null ? fallback : {}),
      };
    }
  };
};

export const createMultiPageLoad = (endpoints: Record<string, PageLoadOptions>): Load => {
  return async ({ fetch }) => {
    const results = await Promise.allSettled(
      Object.entries(endpoints).map(async ([key, options]) => {
        const response = await fetch(options.endpoint);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const apiResponse: ApiResponse = await response.json();

        if (apiResponse.success && apiResponse.data !== undefined) {
          return [key, { success: true, ...apiResponse.data }];
        } else if (!apiResponse.success) {
          return [
            key,
            {
              success: false,
              error: apiResponse.error || options.errorMessage || 'Failed to load data',
              ...(typeof options.fallback === 'object' && options.fallback !== null
                ? options.fallback
                : {}),
            },
          ];
        }

        return [key, apiResponse];
      })
    );

    const data: Record<string, unknown> = {};

    results.forEach((result, index) => {
      const [key, options] = Object.entries(endpoints)[index];

      if (result.status === 'fulfilled') {
        const [, value] = result.value;
        data[key] = value;
      } else {
        logger.error(`Error loading ${options.endpoint}:`, result.reason);
        data[key] = {
          success: false,
          error: options.errorMessage || 'Failed to load data',
          ...(typeof options.fallback === 'object' && options.fallback !== null
            ? options.fallback
            : {}),
        };
      }
    });

    return data;
  };
};
