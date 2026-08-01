/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Shared behavioral helpers for the auth forms (LoginForm, SetupForm).
 * Kept as plain TS (no runes) since these are pure functions/closures,
 * not reactive state.
 */

/**
 * Returns a keydown handler that invokes `submit` when Enter is pressed.
 * Used on individual form inputs so Enter submits from any field.
 */
export function submitOnEnter(submit: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      submit();
    }
  };
}

interface LoadingGuardOptions {
  isLoading: () => boolean;
  setLoading: (value: boolean) => void;
}

/**
 * Wraps an async submit handler so it: no-ops while already loading,
 * sets the loading flag before running, and guarantees it's reset via
 * `finally` regardless of success/failure.
 */
export function withLoadingGuard(
  fn: () => Promise<void>,
  { isLoading, setLoading }: LoadingGuardOptions,
) {
  return async () => {
    if (isLoading()) {
      return;
    }

    setLoading(true);

    try {
      await fn();
    } finally {
      setLoading(false);
    }
  };
}
