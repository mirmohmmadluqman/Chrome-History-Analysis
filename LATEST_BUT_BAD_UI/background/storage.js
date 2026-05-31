import { DEFAULT_SETTINGS } from '../utils/constants.js';

/**
 * Storage Manager for ChronosAnalytics
 */
export class StorageManager {
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  static async getMultiple(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  static async initStorage() {
    const data = await this.getMultiple(['appVersion', 'userSettings', 'domains', 'sessions']);
    
    let updates = {};
    if (!data.appVersion) updates.appVersion = '1.0.0';
    if (!data.userSettings) updates.userSettings = DEFAULT_SETTINGS;
    if (!data.domains) updates.domains = {};
    if (!data.sessions) updates.sessions = [];
    
    if (Object.keys(updates).length > 0) {
      await new Promise(resolve => chrome.storage.local.set(updates, resolve));
    }
  }

  static async getDomain(domainName) {
    const data = await this.get('domains');
    return (data && data[domainName]) ? data[domainName] : null;
  }

  static async saveDomain(domainName, domainData) {
    const data = await this.get('domains') || {};
    data[domainName] = domainData;
    await this.set('domains', data);
  }

  static async updateDomainActiveTime(domainName, addedTimeMs, category, sessionDateStr) {
    if (!domainName || addedTimeMs <= 0) return;
    
    const data = await this.get('domains') || {};
    if (!data[domainName]) {
      data[domainName] = { 
        domain: domainName, 
        totalActiveTimeMs: 0, 
        category: category, 
        visitCount: 1, 
        lastVisit: Date.now() 
      };
    }
    
    data[domainName].totalActiveTimeMs += addedTimeMs;
    data[domainName].lastVisit = Date.now();
    data[domainName].category = category; // Ensure category stays updated based on rules

    // Update session tracking as well
    const sessions = await this.get('sessions') || [];
    let currentSession = sessions.find(s => s.day === sessionDateStr);
    if (!currentSession) {
      currentSession = { day: sessionDateStr, activeMs: 0 };
      sessions.push(currentSession);
    }
    currentSession.activeMs += addedTimeMs;
    
    // Batch set
    await chrome.storage.local.set({ 
      domains: data,
      sessions: sessions 
    });
  }
}
