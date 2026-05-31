import { CATEGORIES } from './constants.js';

/**
 * Calculates aggregated analytics from the raw domains data
 * @param {Object} domainsDB - The hash map of domain data from storage
 * @returns {Object} Aggregated metrics
 */
export function generateAnalytics(domainsDB) {
  let totalActiveTime = 0;
  let categoryTime = {};
  let totalVisits = 0;
  
  // Initialize category times to 0
  Object.values(CATEGORIES).forEach(cat => categoryTime[cat] = 0);

  const domainArray = Object.values(domainsDB);
  
  domainArray.forEach(domain => {
    totalActiveTime += domain.totalActiveTimeMs || 0;
    totalVisits += domain.visitCount || 0;
    
    if (domain.category && categoryTime[domain.category] !== undefined) {
      categoryTime[domain.category] += (domain.totalActiveTimeMs || 0);
    }
  });

  // Calculate Productivity Score
  // (Development + AI + Productivity + Learning) / Total Time
  const productiveCategories = [
    CATEGORIES.DEVELOPMENT, 
    CATEGORIES.AI, 
    CATEGORIES.PRODUCTIVITY,
    CATEGORIES.LEARNING
  ];
  const distractingCategories = [
    CATEGORIES.ENTERTAINMENT,
    CATEGORIES.SOCIAL
  ];

  let productiveTime = 0;
  let distractingTime = 0;

  productiveCategories.forEach(c => productiveTime += categoryTime[c]);
  distractingCategories.forEach(c => distractingTime += categoryTime[c]);

  const productivityScore = totalActiveTime > 0 
    ? Math.round((productiveTime / totalActiveTime) * 100) 
    : 0;
  
  const distractionRatio = totalActiveTime > 0 
    ? Math.round((distractingTime / totalActiveTime) * 100) 
    : 0;

  // Find Top Domains
  const topDomains = [...domainArray]
    .sort((a, b) => (b.totalActiveTimeMs || 0) - (a.totalActiveTimeMs || 0))
    .slice(0, 10);

  return {
    totalActiveTime,
    totalVisits,
    categoryTime,
    productivityScore,
    distractionRatio,
    topDomains,
    totalDomainsCount: domainArray.length
  };
}
