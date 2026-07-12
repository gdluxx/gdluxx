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
 * Copies text to the clipboard using the modern Clipboard API when available
 * in a secure context, falling back to a legacy `execCommand('copy')` approach
 * (via an off-screen textarea) otherwise or if the modern API fails.
 *
 * Throws if both the modern and fallback approaches fail, so callers can
 * surface the failure to the user.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (clipboardError) {
      // eslint-disable-next-line no-console
      console.warn('Clipboard API failed, falling back to execCommand:', clipboardError);
    }
  }

  fallbackCopy(text);
}

function fallbackCopy(text: string): void {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  textArea.setAttribute('aria-hidden', 'true');
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const successful = document.execCommand('copy');
  document.body.removeChild(textArea);

  if (!successful) {
    throw new Error('Fallback copy method failed');
  }
}
