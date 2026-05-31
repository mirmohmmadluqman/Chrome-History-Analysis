import { CATEGORIES } from './constants.js';

// Pre-defined mapping of known domains
const DOMAIN_MAP = {
  'github.com': CATEGORIES.DEVELOPMENT,
  'stackoverflow.com': CATEGORIES.DEVELOPMENT,
  'vercel.com': CATEGORIES.DEVELOPMENT,
  'vercel.app': CATEGORIES.DEVELOPMENT,
  'wakatime.com': CATEGORIES.DEVELOPMENT,
  'localhost': CATEGORIES.DEVELOPMENT,
  '127.0.0.1': CATEGORIES.DEVELOPMENT,
  
  'chatgpt.com': CATEGORIES.AI,
  'openai.com': CATEGORIES.AI,
  'claude.ai': CATEGORIES.AI,
  'anthropic.com': CATEGORIES.AI,
  'manus.im': CATEGORIES.AI,
  'gemini.google.com': CATEGORIES.AI,

  'mail.google.com': CATEGORIES.PRODUCTIVITY,
  'drive.google.com': CATEGORIES.PRODUCTIVITY,
  'docs.google.com': CATEGORIES.PRODUCTIVITY,
  'notion.so': CATEGORIES.PRODUCTIVITY,
  'linear.app': CATEGORIES.PRODUCTIVITY,
  'slack.com': CATEGORIES.PRODUCTIVITY,
  'trello.com': CATEGORIES.PRODUCTIVITY,

  'youtube.com': CATEGORIES.ENTERTAINMENT,
  'netflix.com': CATEGORIES.ENTERTAINMENT,
  'spotify.com': CATEGORIES.ENTERTAINMENT,
  'primevideo.com': CATEGORIES.ENTERTAINMENT,
  'twitch.tv': CATEGORIES.ENTERTAINMENT,

  'instagram.com': CATEGORIES.SOCIAL,
  'x.com': CATEGORIES.SOCIAL,
  'twitter.com': CATEGORIES.SOCIAL,
  'discord.com': CATEGORIES.SOCIAL,
  'reddit.com': CATEGORIES.SOCIAL,
  'facebook.com': CATEGORIES.SOCIAL,
  'linkedin.com': CATEGORIES.SOCIAL,

  'google.com': CATEGORIES.RESEARCH,
  'bing.com': CATEGORIES.RESEARCH,
  'wikipedia.org': CATEGORIES.RESEARCH,

  'coursera.org': CATEGORIES.LEARNING,
  'udemy.com': CATEGORIES.LEARNING,

  'etherscan.io': CATEGORIES.WEB3,
  'book.getfoundry.sh': CATEGORIES.WEB3,
  'dexscreener.com': CATEGORIES.WEB3
};

/**
 * Extracts the primary domain name from a full URL
 * @param {string} url - The URL string
 * @returns {string} The normalized domain
 */
export function extractDomain(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return null;
    }
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

/**
 * Categorizes a given domain based on predefined mappings and user overrides.
 * @param {string} domain - The domain to categorize
 * @param {Object} customRules - User-defined mappings (Domain -> Category)
 * @returns {string} The category name
 */
export function categorizeDomain(domain, customRules = {}) {
  if (!domain) return CATEGORIES.OTHER;
  
  // Check user rules first
  if (customRules[domain]) return customRules[domain];
  
  // Check predefined rules
  if (DOMAIN_MAP[domain]) return DOMAIN_MAP[domain];

  // Try to match partial domain (e.g. *.github.io)
  for (const [key, category] of Object.entries(DOMAIN_MAP)) {
    if (domain.endsWith('.' + key)) {
      return category;
    }
  }

  return CATEGORIES.OTHER;
}
