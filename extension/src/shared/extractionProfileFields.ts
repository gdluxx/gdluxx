/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const OPTIONAL_PROFILE_FIELDS = ['directorySource', 'accumulate'] as const;

export type OptionalProfileField = (typeof OPTIONAL_PROFILE_FIELDS)[number];

export const OPTIONAL_PROFILE_FIELD_LABELS: Record<OptionalProfileField, string> = {
  directorySource: 'directory source',
  accumulate: 'accumulate',
};

export const OPTIONAL_PROFILE_FIELD_CAPABILITIES: Record<OptionalProfileField, string> = {
  directorySource: 'extraction.directorySource',
  accumulate: 'extraction.accumulate',
};

export function describeOptionalFields(fields: readonly OptionalProfileField[]): string {
  return fields.map((field) => OPTIONAL_PROFILE_FIELD_LABELS[field] ?? field).join(', ');
}

export function fieldsUnsupportedMessage(fields: readonly OptionalProfileField[]): string {
  return `This server will not preserve some newer profile fields (${describeOptionalFields(
    fields,
  )}).`;
}

export function fieldsStrippedMessage(fields: readonly OptionalProfileField[]): string {
  return `gdluxx did not store some newer profile fields (${describeOptionalFields(
    fields,
  )}) — update gdluxx to keep them.`;
}

export interface StrippedFieldReport {
  fields: OptionalProfileField[];
  profileIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readProfiles(bundle: unknown): Record<string, unknown> {
  if (!isRecord(bundle)) return {};
  const profiles = bundle.profiles;
  return isRecord(profiles) ? profiles : {};
}

export function diffStrippedOptionalFields(sent: unknown, echoed: unknown): StrippedFieldReport {
  const sentProfiles = readProfiles(sent);
  const echoedProfiles = readProfiles(echoed);

  const fields = new Set<OptionalProfileField>();
  const profileIds: string[] = [];

  for (const [id, sentProfile] of Object.entries(sentProfiles)) {
    if (!isRecord(sentProfile)) continue;
    const echoedProfile = echoedProfiles[id];
    if (!isRecord(echoedProfile)) continue; // skipped/absent profile - see above

    let lostHere = false;
    for (const field of OPTIONAL_PROFILE_FIELDS) {
      if (sentProfile[field] === undefined) continue;
      if (echoedProfile[field] === undefined) {
        fields.add(field);
        lostHere = true;
      }
    }
    if (lostHere) profileIds.push(id);
  }

  return {
    fields: OPTIONAL_PROFILE_FIELDS.filter((field) => fields.has(field)),
    profileIds,
  };
}
