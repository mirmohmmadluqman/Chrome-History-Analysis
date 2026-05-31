export const CATEGORIES = {
  DEVELOPMENT: 'Development & Coding',
  AI: 'AI Assistants',
  PRODUCTIVITY: 'Productivity & Workspace',
  ENTERTAINMENT: 'Entertainment',
  SOCIAL: 'Social Media & Communication',
  RESEARCH: 'Search & Research',
  LEARNING: 'Learning',
  WEB3: 'Web3 & Security',
  OTHER: 'Other Web Browsing'
};

export const DEFAULT_GOALS = {
  [CATEGORIES.DEVELOPMENT]: 30,
  [CATEGORIES.AI]: 10,
  [CATEGORIES.PRODUCTIVITY]: 20,
  [CATEGORIES.RESEARCH]: 15,
  [CATEGORIES.LEARNING]: 10,
  [CATEGORIES.ENTERTAINMENT]: 10,
  [CATEGORIES.SOCIAL]: 5,
  [CATEGORIES.WEB3]: 0,
  [CATEGORIES.OTHER]: 0
};

export const CATEGORY_COLORS = {
  [CATEGORIES.DEVELOPMENT]: '#10b981', // Emerald
  [CATEGORIES.AI]: '#8b5cf6', // Violet
  [CATEGORIES.PRODUCTIVITY]: '#3b82f6', // Blue
  [CATEGORIES.ENTERTAINMENT]: '#ef4444', // Red
  [CATEGORIES.SOCIAL]: '#f59e0b', // Amber
  [CATEGORIES.RESEARCH]: '#0ea5e9', // Sky
  [CATEGORIES.LEARNING]: '#14b8a6', // Teal
  [CATEGORIES.WEB3]: '#f97316', // Orange
  [CATEGORIES.OTHER]: '#64748b' // Slate
};

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  idleTimeout: 60, // seconds until idle
  goals: DEFAULT_GOALS,
  customRules: {} // Domain -> Category overrides
};
