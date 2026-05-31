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
let currentUserSettings = null; // Store settings

export async function refreshDashboard() {
  const domainsDB = await StorageManager.get('domains') || {};
  currentUserSettings = await StorageManager.get('userSettings') || DEFAULT_SETTINGS;
  const analytics = generateAnalytics(domainsDB);

  updateKPIs(analytics);
  populateGoalsEditor();
  initAISettings();
  
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

  const activeGoals = currentUserSettings.goals || DEFAULT_GOALS;
  const labels = Object.keys(activeGoals);
  const targetData = Object.values(activeGoals);
  const bgColors = labels.map(label => CATEGORY_COLORS[label] || '#64748b');

  charts['target'] = new Chart(ctxTarget, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: targetData, backgroundColor: bgColors, borderWidth: 0 }] },
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
    data: { labels: labels, datasets: [{ data: actualData, backgroundColor: bgColors, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderHourlyPlaceholder(range = 'day') {
  const ctx = document.getElementById('hourly-chart').getContext('2d');
  if (charts['hourly']) charts['hourly'].destroy();
  
  let labels = [];
  let data = [];
  
  if (range === 'day') {
    labels = ['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'];
    data = [5, 2, 0, 0, 10, 40, 120, 180, 250, 140, 320, 200, 190, 80, 160, 280, 450, 120, 90, 60, 200, 150, 50, 20];
  } else if (range === 'week') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    data = [420, 510, 390, 600, 550, 200, 150]; // Minutes per day
  } else if (range === 'month') {
    labels = Array.from({length: 30}, (_, i) => `Day ${i+1}`);
    data = Array.from({length: 30}, () => Math.floor(Math.random() * 500) + 100);
  } else { // forever
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    data = [12000, 15000, 11000, 18000, 22000, 25000]; // Minutes per month
  }
  
  charts['hourly'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Active Minutes',
        data: data,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0,
        pointRadius: range === 'month' ? 0 : 3,
        pointHoverRadius: 6,
        stepped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: 'rgba(148, 163, 184, 0.05)' },
          title: { display: true, text: range === 'forever' ? 'Minutes' : 'Active Minutes', font: { size: 10 } }
        },
        x: { 
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        }
      }
    }
  });
}

// Range selection listener
document.getElementById('temporal-range-select').addEventListener('change', (e) => {
  renderHourlyPlaceholder(e.target.value);
});

// Data management binds
document.getElementById('reset-data-btn').addEventListener('click', async () => {
  if (confirm("Are you sure you want to reset all tracked analytics? This cannot be undone.")) {
    await StorageManager.set('domains', {});
    await StorageManager.set('sessions', []);
    alert("Data reset successfully.");
    refreshDashboard();
  }
});

function populateGoalsEditor() {
  const container = document.getElementById('goals-editor-container');
  if (!container) return;
  container.innerHTML = '';
  
  const activeGoals = currentUserSettings.goals || DEFAULT_GOALS;
  Object.keys(activeGoals).forEach(category => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text-muted);">${category}</label>
      <input type="number" data-category="${category}" value="${activeGoals[category]}" 
             style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--bg-app); color:var(--text-main);">
    `;
    container.appendChild(wrapper);
  });
}

document.getElementById('save-goals-btn').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('#goals-editor-container input');
  let newGoals = {};
  inputs.forEach(input => {
    newGoals[input.dataset.category] = parseInt(input.value, 10) || 0;
  });
  
  currentUserSettings.goals = newGoals;
  await StorageManager.set('userSettings', currentUserSettings);
  alert("Target optimization goals updated!");
  refreshDashboard();
});

// JSON Export Logic
document.getElementById('export-btn').addEventListener('click', exportData);
if (document.getElementById('export-file-btn')) {
  document.getElementById('export-file-btn').addEventListener('click', exportData);
}

async function exportData() {
  const domains = await StorageManager.get('domains');
  const sessions = await StorageManager.get('sessions');
  const userSettings = await StorageManager.get('userSettings');
  
  const data = JSON.stringify({ domains, sessions, userSettings }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ChronosAnalytics_Export_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// JSON Import Logic
document.getElementById('import-file-btn').addEventListener('click', () => {
  document.getElementById('file-import-input').click();
});

document.getElementById('file-import-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (imported.domains) {
        const existingDomains = await StorageManager.get('domains') || {};
        // Merge strategy: Overwrite matching domains with imported data if it has more active time, or just combine
        Object.keys(imported.domains).forEach(dom => {
          if (!existingDomains[dom]) {
            existingDomains[dom] = imported.domains[dom];
          } else {
            existingDomains[dom].totalActiveTimeMs += imported.domains[dom].totalActiveTimeMs || 0;
            existingDomains[dom].visitCount += imported.domains[dom].visitCount || 0;
            if (imported.domains[dom].lastVisit > existingDomains[dom].lastVisit) {
              existingDomains[dom].lastVisit = imported.domains[dom].lastVisit;
            }
          }
        });
        await StorageManager.set('domains', existingDomains);
      }
      
      if (imported.sessions) {
        const existingSessions = await StorageManager.get('sessions') || [];
        imported.sessions.forEach(isession => {
          const match = existingSessions.find(s => s.day === isession.day);
          if (match) {
             match.activeMs += isession.activeMs || 0;
          } else {
             existingSessions.push(isession);
          }
        });
        await StorageManager.set('sessions', existingSessions);
      }
      
      alert("Data successfully merged from file.");
      refreshDashboard();
      
    } catch(err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
});

// Sync Chrome History button manually dumps browsing history into domains to prime the UI
document.getElementById('import-history-btn').addEventListener('click', () => {
  chrome.history.search({text: '', maxResults: 1000, startTime: Date.now() - (90 * 24 * 60 * 60 * 1000)}, async (results) => {
    let imported = 0;
    const { extractDomain, categorizeDomain } = await import('../utils/categorization.js');
    const domainsDB = await StorageManager.get('domains') || {};
    
    results.forEach(item => {
      const domain = extractDomain(item.url);
      if (domain) {
        if (!domainsDB[domain]) {
          domainsDB[domain] = {
             domain: domain,
             totalActiveTimeMs: item.visitCount * 60000, 
             category: categorizeDomain(domain, currentUserSettings?.customRules || {}),
             visitCount: item.visitCount,
             lastVisit: item.lastVisitTime
          };
          imported++;
        } else {
          // If already exists, safely bump stats based on history difference if necessary
          // Note: Since history lacks direct active time, we just update visit counts strictly missing
          domainsDB[domain].visitCount += item.visitCount;
          if (item.lastVisitTime > domainsDB[domain].lastVisit) {
            domainsDB[domain].lastVisit = item.lastVisitTime;
          }
        }
      }
    });
    
    await StorageManager.set('domains', domainsDB);
    alert(`Successfully synced and merged historical data. Processed ${imported} new domains.`);
    refreshDashboard();
  });
});

function initAISettings() {
  const apiKeyInput = document.getElementById('gemini-api-key');
  const profileInput = document.getElementById('user-profile');
  if (apiKeyInput && profileInput) {
    apiKeyInput.value = currentUserSettings.geminiApiKey || '';
    profileInput.value = currentUserSettings.userProfile || '';
  }
}

document.getElementById('save-ai-settings-btn').addEventListener('click', async () => {
  const apiKey = document.getElementById('gemini-api-key').value.trim();
  const profile = document.getElementById('user-profile').value.trim();
  
  currentUserSettings.geminiApiKey = apiKey;
  currentUserSettings.userProfile = profile;
  
  await StorageManager.set('userSettings', currentUserSettings);
  alert("AI settings saved!");
});

async function runAIOptimization(btnId) {
  const apiKey = currentUserSettings.geminiApiKey;
  const profile = currentUserSettings.userProfile;
  
  if (!apiKey) {
    alert("Please set your Gemini API Key in Settings first.");
    // Redirect to settings tab
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.dataset.tab === 'settings') btn.click();
    });
    return;
  }
  
  const btn = document.getElementById(btnId);
  const originalText = btn.innerText;
  btn.innerText = "Analyzing with AI...";
  btn.disabled = true;

  try {
    const domainsDB = await StorageManager.get('domains') || {};
    const analytics = generateAnalytics(domainsDB);
    
    const suggestedGoals = await callGeminiAI(apiKey, profile, analytics);
    
    if (suggestedGoals) {
      const summary = Object.entries(suggestedGoals)
        .map(([cat, val]) => `${cat}: ${val}%`)
        .join('\n');
        
      if (confirm(`Gemini suggests the following target goals:\n\n${summary}\n\nDo you want to apply these?`)) {
        currentUserSettings.goals = suggestedGoals;
        await StorageManager.set('userSettings', currentUserSettings);
        refreshDashboard();
      }
    }
  } catch (error) {
    console.error("AI Optimization failed:", error);
    alert(`AI Optimization failed: ${error.message}`);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

const aiBtn = document.getElementById('optimize-ai-btn');
if (aiBtn) aiBtn.addEventListener('click', () => runAIOptimization('optimize-ai-btn'));

const aiBtnMain = document.getElementById('optimize-ai-btn-main');
if (aiBtnMain) aiBtnMain.addEventListener('click', () => runAIOptimization('optimize-ai-btn-main'));

async function callGeminiAI(apiKey, profile, analytics) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const categories = Object.values(CATEGORIES).join(', ');
  const actualUsage = Object.entries(analytics.categoryTime)
    .map(([cat, ms]) => `${cat}: ${Math.round(ms / 60000)}m`)
    .join(', ');

  const prompt = `
    User Profile: ${profile}
    Current Local Browsing Usage (last few days): ${actualUsage}
    Available Categories: ${categories}
    
    Task: suggest ideal target goal percentages for each category that would improve productivity and match the user's professional profile.
    Constraints:
    1. The percentages MUST sum to exactly 100%.
    2. Return ONLY a valid JSON object where keys are the category names and values are integers.
    3. Do not include any other text or explanation.
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg = errData.error?.message || response.statusText;
    throw new Error(`API Error (${response.status}): ${msg}`);
  }

  const result = await response.json();
  if (!result.candidates || !result.candidates[0]) {
    throw new Error("No response candidates received from Gemini.");
  }

  const content = result.candidates[0].content.parts[0].text;
  
  // Clean potential markdown code blocks
  const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", content);
    throw new Error("AI returned an invalid format. Please try again.");
  }
}

document.addEventListener('DOMContentLoaded', refreshDashboard);
