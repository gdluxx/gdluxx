/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface ParsedHotkey {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface HotkeyValidationResult {
  valid: boolean;
  error?: string;
}

export function parseHotkey(hotkey: string): ParsedHotkey {
  const parts = hotkey.trim().split('+');
  const key = parts.pop() || '';
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));

  return {
    key: key.toLowerCase(),
    ctrl: modifiers.has('ctrl') || modifiers.has('control'),
    alt: modifiers.has('alt'),
    shift: modifiers.has('shift'),
    meta: modifiers.has('meta') || modifiers.has('cmd') || modifiers.has('command'),
  };
}

export function matchesHotkey(event: KeyboardEvent, definition: string): boolean {
  const hotkey = parseHotkey(definition);
  if (!!hotkey.ctrl !== event.ctrlKey) return false;
  if (!!hotkey.alt !== event.altKey) return false;
  if (!!hotkey.shift !== event.shiftKey) return false;
  if (!!hotkey.meta !== event.metaKey) return false;
  return (event.key ?? '').toLowerCase() === hotkey.key;
}

export function captureHotkey(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');

  let key = event.key;
  if (key === ' ') key = 'Space';
  if (key.startsWith('Arrow')) {
    key = `Arrow${key.slice(5, 6).toUpperCase()}${key.slice(6)}`;
  }
  if (key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
    parts.push(normalizedKey);
  }

  return parts.length > 1 ? parts.join('+') : null;
}

export function shouldIgnoreForTyping(target: Element | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    element.isContentEditable ||
    (element as HTMLInputElement).type === 'text'
  );
}

export function validateHotkey(hotkey: string): HotkeyValidationResult {
  if (!hotkey || hotkey.trim() === '') {
    return { valid: false, error: 'Hotkey cannot be empty' };
  }

  const parts = hotkey.trim().split('+');
  if (parts.length < 2) {
    return {
      valid: false,
      error: 'Hotkey must include at least one modifier (Ctrl/Alt/Shift/Meta) and one key',
    };
  }

  return { valid: true };
}

export function formatHotkeyForDisplay(hotkey: string): string {
  return hotkey;
}
