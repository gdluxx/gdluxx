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

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastData {
  id: string;
  type: ToastType;
  title?: string;
  message?: string;
  dismissible?: boolean;
  autoHide?: boolean;
  duration?: number;
}

const toastsStore = writable<ToastData[]>([]);

function show(toast: Omit<ToastData, 'id'>) {
  const id = crypto.randomUUID();
  const newToast: ToastData = {
    id,
    dismissible: true,
    autoHide: true,
    duration: 5000,
    ...toast,
  };

  toastsStore.update((current) => [...current, newToast]);
  return id;
}

function dismiss(id: string) {
  toastsStore.update((current) => current.filter((toast) => toast.id !== id));
}

function clear() {
  toastsStore.set([]);
}

function info(message: string, title?: string, options?: Partial<ToastData>) {
  return show({ type: 'info', message, title, ...options });
}

function success(message: string, title?: string, options?: Partial<ToastData>) {
  return show({ type: 'success', message, title, ...options });
}

function warning(message: string, title?: string, options?: Partial<ToastData>) {
  return show({ type: 'warning', message, title, ...options });
}

function error(message: string, title?: string, options?: Partial<ToastData>) {
  return show({ type: 'error', message, title, ...options });
}

export const toastStore = {
  subscribe: toastsStore.subscribe,
  show,
  dismiss,
  clear,
  info,
  success,
  warning,
  error,
};

export { show, dismiss, clear, info, success, warning, error };
