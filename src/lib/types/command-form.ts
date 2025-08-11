export interface OptionWithSource {
  value: string | number | boolean;
  source: 'site-config' | 'user';
  sitePattern?: string;
  configName?: string;
}

export interface SiteConfigData {
  url: string;
  hostname: string;
  hasMatch: boolean;
  matchedPattern?: string;
  configName?: string;
  options: Record<string, string | number | boolean>;
}
