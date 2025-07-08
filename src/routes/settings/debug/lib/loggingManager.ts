/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { createSettingsManager } from '$lib/server/settingsManager';

export interface LoggingConfig {
	enabled: boolean;
	level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
	enabled: process.env.NODE_ENV === 'development',
	level: 'INFO',
};

const settingsManager = createSettingsManager(
	'logging',
	DEFAULT_LOGGING_CONFIG,
	(row) => ({
		enabled: Boolean(row.enabled),
		level: row.level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
	})
);

export const readLoggingConfig = settingsManager.read;
export const writeLoggingConfig = settingsManager.write;