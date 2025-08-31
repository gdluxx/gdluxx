/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  allowHtml?: boolean;
}

export interface ToastStoreMethods {
  subscribe: (run: (value: Toast[]) => void, invalidate?: () => void) => () => void;
  addToast: (toast: Omit<Toast, 'id'>) => string; // addToast returns the id
  removeToast: (id: string) => void;
  success: (title: string, message?: string, duration?: number, allowHtml?: boolean) => string;
  error: (title: string, message?: string, duration?: number, allowHtml?: boolean) => string;
  warning: (title: string, message?: string, duration?: number, allowHtml?: boolean) => string;
  info: (title: string, message?: string, duration?: number, allowHtml?: boolean) => string;
}

function createToastStore(): ToastStoreMethods {
  const { subscribe, update } = writable<Toast[]>([]);

  function addToast(toast: Omit<Toast, 'id'>): string {
    const id: string = uuidv4();
    const { duration, ...restToast } = toast;
    const newToast: Toast = {
      id,
      duration: duration ?? 7000,
      allowHtml: false,
      ...restToast,
    };

    update((toasts) => [...toasts, newToast]);

    // Auto remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout((): void => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }

  function removeToast(id: string): void {
    update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  function success(title: string, message?: string, duration?: number, allowHtml?: boolean) {
    return addToast({ type: 'success', title, message, duration, allowHtml });
  }

  function error(title: string, message?: string, duration?: number, allowHtml?: boolean) {
    return addToast({ type: 'error', title, message, duration, allowHtml });
  }

  function warning(title: string, message?: string, duration?: number, allowHtml?: boolean) {
    return addToast({ type: 'warning', title, message, duration, allowHtml });
  }

  function info(title: string, message?: string, duration?: number, allowHtml?: boolean) {
    return addToast({ type: 'info', title, message, duration, allowHtml });
  }

  return {
    subscribe,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}

export const toastStore: ToastStoreMethods = createToastStore();
