import { StorageManager } from './storage.js';
import { extractDomain, categorizeDomain } from '../utils/categorization.js';
import { DEFAULT_SETTINGS } from '../utils/constants.js';

let activeTabId = null;
let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let currentDomain = null;
let currentDomainCategory = null;
let trackingStartTime = Date.now();
let isIdle = false;
let userSettings = DEFAULT_SETTINGS;

export async function initTracker() {
  await StorageManager.initStorage();
  userSettings = await StorageManager.get('userSettings') || DEFAULT_SETTINGS;
  
  // Initialize idle state
  chrome.idle.setDetectionInterval(userSettings.idleTimeout || 60);

  // Discover initial active tab
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs.length > 0) {
    handleTabActivation(tabs[0]);
  }
}

async function handleTabActivation(tab) {
  if (isIdle) return; // Don't track if device is idle
  
  const now = Date.now();
  
  // Flush previous domain time
  flushTime(now);

  activeTabId = tab.id;
  activeWindowId = tab.windowId;
  trackingStartTime = now;
  
  currentDomain = extractDomain(tab.url);
  currentDomainCategory = categorizeDomain(currentDomain, userSettings.customRules);
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function flushTime(nowTime) {
  if (currentDomain && !isIdle) {
    const elapsed = nowTime - trackingStartTime;
    if (elapsed > 1000) { // Only track if active for more than 1 second to avoid rapid switch noise
      await StorageManager.updateDomainActiveTime(
        currentDomain, 
        elapsed, 
        currentDomainCategory,
        getTodayString()
      );
    }
  }
}

// ----------------------------------------------------
// Listeners
// ----------------------------------------------------

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabActivation(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    handleTabActivation(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const now = Date.now();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus completely
    flushTime(now);
    currentDomain = null;
    activeWindowId = windowId;
  } else {
    // Focus shifted to another Chrome window
    activeWindowId = windowId;
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      handleTabActivation(tabs[0]);
    }
  }
});

chrome.idle.onStateChanged.addListener((newState) => {
  const now = Date.now();
  if (newState === 'active') {
    isIdle = false;
    trackingStartTime = now; // Resume tracking
  } else { // 'idle' or 'locked'
    flushTime(now);
    isIdle = true;
  }
});

// Settings update receiver
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.userSettings) {
    userSettings = changes.userSettings.newValue;
    chrome.idle.setDetectionInterval(userSettings.idleTimeout || 60);
  }
});
