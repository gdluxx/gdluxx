/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export {
  type ThemeName,
  type ThemeMode,
  type ThemeConfig,
  AVAILABLE_THEMES,
  DEFAULT_THEME,
  DEFAULT_MODE,
  getCurrentTheme,
  getCurrentMode,
  getThemeConfig,
  applyTheme,
  toggleMode,
  initializeTheme,
  saveThemePreference,
  setupSystemThemeListener,
  validateTheme,
  validateThemeSystemHealth,
  getSemanticTokenValues,
} from './themeUtils';

export * from './themeUtils';
