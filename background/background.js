import { initTracker } from './tracking.js';

// Service worker entry point
// Initialize tracking when extension is loaded
initTracker().then(() => {
  console.log("ChronosAnalytics Tracking Engine Initialized.");
});

// Periodic save alarm (failsafe mechanism)
chrome.alarms.create("failsafeSync", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "failsafeSync") {
    console.log("ChronosAnalytics: Failsafe state sync triggered.");
    // the tracking.js already flushes on tab switch or idle. 
    // This is just a heartbeat for future reliability additions if we need to ping server or persist temporary in-memory structures.
  }
});
