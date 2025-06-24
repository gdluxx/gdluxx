export type IconName =
  | 'key'
  | 'close'
  | 'delete'
  | 'play'
  | 'double-chevron-left'
  | 'json'
  | 'version'
  | 'dark'
  | 'light'
  | 'ui'
  | 'job'
  | 'log'
  | 'loading'
  | 'chevron-right'
  | 'plus'
  | 'user'
  | 'setup';

export interface IconConfig {
  name: IconName;
  label: string;
  category: 'navigation' | 'action' | 'status' | 'object' | 'theme' | 'work';
}

export const ICON_CATALOG: IconConfig[] = [
  { name: 'key', label: 'Key', category: 'object' },
  { name: 'close', label: 'Close', category: 'navigation' },
  { name: 'delete', label: 'Delete', category: 'action' },
  { name: 'play', label: 'Play', category: 'action' },
  { name: 'double-chevron-left', label: 'Double Chevron Left', category: 'navigation' },
  { name: 'json', label: 'JSON', category: 'object' },
  { name: 'version', label: 'Version', category: 'work' },
  { name: 'dark', label: 'Dark Mode', category: 'theme' },
  { name: 'light', label: 'Light Mode', category: 'theme' },
  { name: 'ui', label: 'UI', category: 'work' },
  { name: 'job', label: 'Job', category: 'work' },
  { name: 'log', label: 'Log', category: 'work' },
  { name: 'loading', label: 'Loading', category: 'status' },
  { name: 'chevron-right', label: 'Chevron Right', category: 'navigation' },
  { name: 'plus', label: 'Plus', category: 'action' },
  { name: 'user', label: 'User', category: 'action' },
  { name: 'setup', label: 'Setup', category: 'action' },
];
