export interface OptionWithSource {
  value: string | number | boolean;
  source: 'site-config' | 'user';
  sitePattern?: string;
  configName?: string;
}
