import { StorageManager } from '../background/storage.js';
import { generateAnalytics } from '../utils/analytics.js';

document.addEventListener('DOMContentLoaded', async () => {
  const btnDashboard = document.getElementById('btn-dashboard');
  
  btnDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });

  // Calculate stats for popup
  try {
    const domains = await StorageManager.get('domains') || {};
    const analytics = generateAnalytics(domains);
    
    // Update Active Today (this would ideally filter by today, but for popup MVP we show total or session)
    const sessions = await StorageManager.get('sessions') || [];
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    let todayMs = 0;
    const todaySession = sessions.find(s => s.day === todayStr);
    if (todaySession) {
      todayMs = todaySession.activeMs;
    }
    
    const h = Math.floor(todayMs / 3600000);
    const m = Math.floor((todayMs % 3600000) / 60000);
    
    document.getElementById('today-time').textContent = `${h}h ${m}m`;
    
    // Update Focus Score
    document.getElementById('focus-score').textContent = `${analytics.productivityScore}%`;
    document.getElementById('focus-fill').style.width = `${analytics.productivityScore}%`;
    
    const focusFill = document.getElementById('focus-fill');
    if (analytics.productivityScore < 40) focusFill.style.background = '#ef4444'; // Red
    else if (analytics.productivityScore < 70) focusFill.style.background = '#f59e0b'; // Amber
    else focusFill.style.background = '#10b981'; // Green

    // Top Site
    if (analytics.topDomains && analytics.topDomains.length > 0) {
      document.getElementById('top-domain').textContent = analytics.topDomains[0].domain;
    } else {
      document.getElementById('top-domain').textContent = "No data yet";
    }

  } catch (err) {
    console.error("Failed to load popup data:", err);
  }
});
