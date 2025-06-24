import { type Writable, writable } from 'svelte/store';

export const hasJsonLintErrors: Writable<boolean> = writable(false);
