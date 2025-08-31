/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { siteConfigManager } from './siteConfigManager';

interface SiteTableRow {
  site: string;
  url: string;
  capabilities: string;
  authentication: string;
}

export class SiteDataFetcher {
  private static readonly GITHUB_URL =
    'https://raw.githubusercontent.com/mikf/gallery-dl/refs/heads/master/docs/supportedsites.md';

  async fetchAndParseSites(): Promise<void> {
    const now = Date.now();

    try {
      // eslint-disable-next-line no-console
      console.log('Fetching supported sites from gallery-dl documentation...');

      const response = await fetch(SiteDataFetcher.GITHUB_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const markdown = await response.text();
      const sites = this.parseMarkdownTable(markdown);

      // eslint-disable-next-line no-console
      console.log(`Parsed ${sites.length} sites from gallery-dl documentation`);

      // Clear old data before inserting new data
      await siteConfigManager.clearSupportedSites();

      for (const site of sites) {
        await siteConfigManager.upsertSupportedSite({
          name: site.site,
          url: site.url,
          url_pattern: this.generateUrlPattern(site.url),
          category: this.categorizeSite(site.site),
          capabilities: this.parseCapabilities(site.capabilities),
          auth_supported: site.authentication.toLowerCase().includes('supported'),
          last_fetched: now,
        });
      }

      await siteConfigManager.updateSiteDataMeta({
        last_fetch_attempt: now,
        last_successful_fetch: now,
        sites_count: sites.length,
        fetch_error: undefined,
      });

      // eslint-disable-next-line no-console
      console.log('Successfully updated supported sites database');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch supported sites:', error);

      await siteConfigManager.updateSiteDataMeta({
        last_fetch_attempt: now,
        fetch_error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private parseMarkdownTable(markdown: string): SiteTableRow[] {
    const sites: SiteTableRow[] = [];

    const tableRowRegex =
      /<tr[^>]*>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/g;

    let match;

    while ((match = tableRowRegex.exec(markdown)) !== null) {
      if (match[0].includes('colspan')) {
        continue;
      }

      const [, site, url, capabilities, authentication] = match;

      const cleanedSite = this.cleanHtmlText(site);
      const cleanedUrl = this.extractUrl(this.cleanHtmlText(url));

      if (!cleanedSite.trim() || !cleanedUrl.trim()) {
        continue;
      }

      sites.push({
        site: cleanedSite,
        url: cleanedUrl,
        capabilities: this.cleanHtmlText(capabilities),
        authentication: this.cleanHtmlText(authentication),
      });
    }

    return sites;
  }

  private cleanHtmlText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&') // Decode HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private cleanMarkdownText(text: string): string {
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
      .replace(/`([^`]+)`/g, '$1') // Remove code formatting
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .trim();
  }

  private extractUrl(text: string): string {
    const markdownLinkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (markdownLinkMatch) {
      return markdownLinkMatch[2];
    }

    const htmlLinkMatch = text.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    if (htmlLinkMatch) {
      return htmlLinkMatch[1];
    }

    if (text.startsWith('http')) {
      return text;
    }

    return text.trim();
  }

  private generateUrlPattern(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const hostname = urlObj.hostname.toLowerCase();

      // For subdomains
      const parts = hostname.split('.');
      if (parts.length > 2 && !['www', 'mobile', 'm'].includes(parts[0])) {
        return `*.${parts.slice(1).join('.')}`;
      }

      return hostname;
    } catch {
      return url.toLowerCase();
    }
  }

  private categorizeSite(siteName: string): string {
    const name = siteName.toLowerCase();

    if (name.includes('twitter') || name.includes('instagram') || name.includes('facebook')) {
      return 'Social Media';
    }
    if (name.includes('youtube') || name.includes('vimeo') || name.includes('twitch')) {
      return 'Video Platforms';
    }
    if (name.includes('danbooru') || name.includes('gelbooru') || name.includes('booru')) {
      return 'Imageboards';
    }
    if (name.includes('deviantart') || name.includes('artstation')) {
      return 'Art Platforms';
    }
    if (name.includes('reddit')) {
      return 'Forums';
    }
    if (name.includes('imgur') || name.includes('flickr')) {
      return 'Image Hosting';
    }
    if (name.includes('mangadex') || name.includes('manga')) {
      return 'Manga/Comics';
    }

    return 'Other';
  }

  private parseCapabilities(capabilities: string): string[] {
    return capabilities
      .split(/[,;]/)
      .map((cap) => cap.trim())
      .filter((cap) => cap.length > 0);
  }
}

export const siteDataFetcher = new SiteDataFetcher();
