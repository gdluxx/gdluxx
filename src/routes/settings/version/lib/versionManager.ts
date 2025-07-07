/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { mkdir, chmod, stat, rename, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { logger } from '$lib/shared/logger';
import { PATHS, GITHUB } from '$lib/server/constants';

const execAsync = promisify(exec);

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

export interface VersionInfo {
	current: string | null;
	latestAvailable: string | null;
	lastChecked: number | null;
}

export const DEFAULT_VERSION_INFO: VersionInfo = {
	current: null,
	latestAvailable: null,
	lastChecked: null,
};

async function ensureDataDir(): Promise<void> {
	try {
		await mkdir(PATHS.DATA_DIR, { recursive: true });
	} catch (error) {
		logger.error('Failed to create data directory:', PATHS.DATA_DIR, error);
		throw new Error('Failed to ensure data directory exists.');
	}
}

function getCurrentTimestamp(): number {
	return Date.now();
}

export async function readVersionInfo(): Promise<VersionInfo> {
	try {
		await ensureDataDir();
		const stmt = db.prepare(
			'SELECT current, latestAvailable, lastChecked FROM version WHERE id = 1'
		);
		const row = stmt.get() as
			| { current: string | null; latestAvailable: string | null; lastChecked: number | null }
			| undefined;

		if (row) {
			return {
				current: row.current,
				latestAvailable: row.latestAvailable,
				lastChecked: row.lastChecked,
			};
		}
		return { ...DEFAULT_VERSION_INFO };
	} catch (error) {
		logger.error('Error reading version from database:', error);
		return { ...DEFAULT_VERSION_INFO };
	}
}

export async function writeVersionInfo(info: VersionInfo): Promise<void> {
	try {
		await ensureDataDir();
		const now = getCurrentTimestamp();

		const stmt = db.prepare(`
			INSERT OR REPLACE INTO version (id, current, latestAvailable, lastChecked, createdAt, updatedAt)
			VALUES (1, ?, ?, ?, 
				COALESCE((SELECT createdAt FROM version WHERE id = 1), ?),
				?)
		`);

		stmt.run(info.current, info.latestAvailable, info.lastChecked, now, now);
	} catch (error) {
		logger.error('Error writing version to database:', error);
		throw new Error('Failed to write version information.');
	}
}

export async function getCurrentVersionFromBinary(): Promise<string | null> {
	try {
		await mkdir(PATHS.DATA_DIR, { recursive: true });
		await stat(PATHS.BIN_FILE);

		const { stdout } = await execAsync(`"${PATHS.BIN_FILE}" --version`);
		const versionMatch = stdout.trim().match(/(\d+\.\d+\.\d+)/);
		return versionMatch ? versionMatch[1] : null;
	} catch (error) {
		if (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			(error as { code?: string }).code === 'ENOENT'
		) {
			logger.info('gallery-dl.bin not found at:', PATHS.BIN_FILE);
		} else {
			logger.error('Error getting current version from binary:', error);
		}
		return null;
	}
}

export async function getLatestVersionFromGithub(): Promise<string | null> {
	try {
		const response = await fetch(GITHUB.LATEST_RELEASE_URL, {
			headers: { 'User-Agent': 'gdluxx' },
		});
		if (!response.ok) {
			logger.error(`GitHub API error: ${response.status} ${await response.text()}`);
			throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
		}
		const data = await response.json();
		const tagName = data.tag_name?.trim();
		if (!tagName) {
			return null;
		}
		return tagName.startsWith('v') ? tagName.slice(1) : tagName;
	} catch (error) {
		logger.error('Error fetching latest version from GitHub:', error);
		return null;
	}
}

export async function downloadAndInstallBinary(): Promise<boolean> {
	logger.info('Downloading latest gallery-dl binary...');
	const TEMP_BIN_FILE_PATH = `${PATHS.BIN_FILE}.tmp`;
	try {
		const response: Response = await fetch(GITHUB.BINARY_DOWNLOAD_URL);
		logger.info('Download response:', response.status, response.statusText);
		logger.info('Github download url', GITHUB.BINARY_DOWNLOAD_URL);
		if (!response.ok || !response.body) {
			throw new Error(`Download failed: ${response.status} ${response.statusText}`);
		}
		const arrayBuffer: ArrayBuffer = await response.arrayBuffer();
		const buffer: Buffer<ArrayBuffer> = Buffer.from(arrayBuffer);

		await mkdir(PATHS.DATA_DIR, { recursive: true });

		await writeFile(TEMP_BIN_FILE_PATH, buffer);
		await chmod(TEMP_BIN_FILE_PATH, 0o755);

		await rename(TEMP_BIN_FILE_PATH, PATHS.BIN_FILE);

		logger.info(`Binary downloaded and saved to: ${PATHS.BIN_FILE}`);
		return true;
	} catch (error) {
		logger.error('Error downloading or installing binary:', error);

		try {
			await stat(TEMP_BIN_FILE_PATH);
			await unlink(TEMP_BIN_FILE_PATH);
		} catch (cleanupError) {
			logger.error('Error cleaning up temporary binary file:', cleanupError);
		}
		return false;
	}
}

export function compareVersions(a: string | null, b: string | null): number {
	if (a === null && b === null) {
		return 0;
	}
	if (a === null) {
		return -1;
	} // a is older
	if (b === null) {
		return 1;
	} // a is newer

	const parse: (v: string) => number[] = (v: string): number[] =>
		v.split('.').map(num => parseInt(num, 10) || 0);
	const versionA: number[] = parse(a);
	const versionB: number[] = parse(b);

	for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
		const numA: number = versionA[i] || 0;
		const numB: number = versionB[i] || 0;
		if (numA > numB) {
			return 1;
		}
		if (numA < numB) {
			return -1;
		}
	}
	return 0;
}