export function detectSitePattern(url: string): string {
  const hostname = new URL(url).hostname;

  if (hostname.startsWith('www.')) {
    return `*.${hostname.slice(4)}`;
  }

  const parts = hostname.split('.');
  if (parts.length > 2) {
    return `*.${parts.slice(-2).join('.')}`;
  }

  return hostname;
}

export function extractUniquePatterns(urls: string[]): string[] {
  const patterns = new Set<string>();
  urls.forEach(url => {
    try {
      patterns.add(detectSitePattern(url));
    } catch {
      // Skip invalid URLs
    }
  });
  return Array.from(patterns);
}