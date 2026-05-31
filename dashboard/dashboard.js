import { StorageManager } from '../background/storage.js';
import { generateAnalytics } from '../utils/analytics.js';
import { CATEGORIES, CATEGORY_COLORS, DEFAULT_GOALS } from '../utils/constants.js';

// Setup Tab Navigation
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    // Nav logic
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    // Tab logic
    document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
    
    // Update header Title
    document.getElementById('page-title').textContent = button.textContent.trim();
  });
});

let charts = {}; // Store chart instances to destroy and recreate

export async function refreshDashboard() {
  const domainsDB = await StorageManager.get('domains') || {};
  const analytics = generateAnalytics(domainsDB);

  updateKPIs(analytics);
  
  // Wait to ensure DOM guarantees and Chart.js lib loading
  if (window.Chart) {
    renderCharts(analytics);
  } else {
    // load Chart.js dynamically from lib/chart.umd.js if not available
    loadChartJS().then(() => renderCharts(analytics));
  }
}

function loadChartJS() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../lib/chart.umd.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function msToHoursFormat(ms) {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m}m`;
}

function updateKPIs(analytics) {
  document.getElementById('kpi-domains').textContent = analytics.totalDomainsCount.toString();
  document.getElementById('kpi-time').textContent = msToHoursFormat(analytics.totalActiveTime);
  document.getElementById('kpi-focus').textContent = `${analytics.productivityScore}%`;
  document.getElementById('kpi-distraction').textContent = `${analytics.distractionRatio}%`;
}

function renderCharts(analytics) {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = '-apple-system, system-ui, sans-serif';

  renderCategoryChart(analytics);
  renderTopDomainsChart(analytics);
  renderAllocationCharts(analytics);
  renderHourlyPlaceholder();
}

function renderCategoryChart(analytics) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  
  if (charts['category']) charts['category'].destroy();
  
  const labels = Object.keys(analytics.categoryTime);
  const data = Object.values(analytics.categoryTime).map(ms => ms / 3600000); // in hours
  const bgColors = labels.map(label => CATEGORY_COLORS[label] || '#64748b');

  charts['category'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Hours Active',
        data: data,
        backgroundColor: bgColors,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#2b303b' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderTopDomainsChart(analytics) {
  const ctx = document.getElementById('top-domains-chart').getContext('2d');
  
  if (charts['domains']) charts['domains'].destroy();
  
  const top10 = analytics.topDomains.slice(0, 10);
  const labels = top10.map(d => d.domain);
  const data = top10.map(d => d.totalActiveTimeMs / 3600000); // hours

  charts['domains'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#14b8a6', '#f97316', '#64748b', '#475569'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      },
      cutout: '70%'
    }
  });
}

function renderAllocationCharts(analytics) {
  const ctxTarget = document.getElementById('target-allocation-chart').getContext('2d');
  const ctxActual = document.getElementById('actual-allocation-chart').getContext('2d');
  
  if (charts['target']) charts['target'].destroy();
  if (charts['actual']) charts['actual'].destroy();

  const labels = Object.keys(DEFAULT_GOALS);
  const targetData = Object.values(DEFAULT_GOALS);
  const bgColors = labels.map(label => CATEGORY_COLORS[label] || '#64748b');

  charts['target'] = new Chart(ctxTarget, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: targetData, backgroundColor: bgColors, borderWidth: 1, borderColor: '#1a1d24' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  // Calculate actual percentage distribution
  let actualData = [];
  if (analytics.totalActiveTime === 0) {
    actualData = labels.map(() => 0);
  } else {
    actualData = labels.map(cat => Math.round((analytics.categoryTime[cat] / analytics.totalActiveTime) * 100));
  }

  charts['actual'] = new Chart(ctxActual, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: actualData, backgroundColor: bgColors, borderWidth: 1, borderColor: '#1a1d24' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderHourlyPlaceholder() {
  const ctx = document.getElementById('hourly-chart').getContext('2d');
  if (charts['hourly']) charts['hourly'].destroy();
  
  // Basic mock data for hourly to demonstrate UI aesthetics since Chrome doesn't provide precise historical active time granular to hours unless tracked deeply over days.
  charts['hourly'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['12am','3am','6am','9am','12pm','3pm','6pm','9pm'],
      datasets: [{
        label: 'Active Minutes',
        data: [10, 5, 20, 120, 180, 160, 45, 60],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#2b303b' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// Data management binds
document.getElementById('reset-data-btn').addEventListener('click', async () => {
  if (confirm("Are you sure you want to reset all tracked analytics? This cannot be undone.")) {
    await StorageManager.set('domains', {});
    await StorageManager.set('sessions', []);
    alert("Data reset successfully.");
    refreshDashboard();
  }
});

// Import history button manually dumps browsing history into domains to prime the UI
document.getElementById('import-history-btn').addEventListener('click', () => {
  chrome.history.search({text: '', maxResults: 1000, startTime: Date.now() - (30 * 24 * 60 * 60 * 1000)}, async (results) => {
    let imported = 0;
    const { extractDomain, categorizeDomain } = await import('../utils/categorization.js');
    const domainsDB = await StorageManager.get('domains') || {};
    
    results.forEach(item => {
      const domain = extractDomain(item.url);
      if (domain && !domainsDB[domain]) {
        // Mock some active time based on visit count as baseline import
        domainsDB[domain] = {
           domain: domain,
           totalActiveTimeMs: item.visitCount * 60000, // guess 1 min per visit
           category: categorizeDomain(domain, {}),
           visitCount: item.visitCount,
           lastVisit: item.lastVisitTime
        };
        imported++;
      }
    });
    
    await StorageManager.set('domains', domainsDB);
    alert(`Imported and populated baseline stats for ${imported} new domains from history.`);
    refreshDashboard();
  });
});

document.addEventListener('DOMContentLoaded', refreshDashboard);
