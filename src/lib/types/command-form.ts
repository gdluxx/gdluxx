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

export interface Conflict {
  optionId: string;
  userValue: string | number | boolean;
  siteRuleValue: string | number | boolean;
  sitePattern: string;
  configName?: string;
}
