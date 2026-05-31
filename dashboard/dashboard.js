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
let currentTrackerDomainsArr = []; // Store current filtered domains for AI analysis

export async function refreshDashboard() {
  const domainsDB = await StorageManager.get('domains') || {};
  currentUserSettings = await StorageManager.get('userSettings') || DEFAULT_SETTINGS;
  const analytics = generateAnalytics(domainsDB);

  updateKPIs(analytics);
  populateGoalsEditor();
  initAISettings();
  refreshTrackerTable();

  // Auto-sync history in background if it hasn't been done yet
  if (!currentUserSettings.hasSyncedHistory) {
    autoSyncHistory();
  }
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

// Vibrant chart palette — used for all charts and category badges
const CHART_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
  '#8b5cf6', '#f97316', '#14b8a6', '#ef4444', '#06b6d4'
];

// Dark-mode-aware color for text
function getChartTextColor() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? '#a3a3a3'
    : '#888888';
}

function renderCharts(analytics) {
  Chart.defaults.color = getChartTextColor();
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  Chart.defaults.font.size = 12;

  renderCategoryChart(analytics);
  renderTopDomainsChart(analytics);
  renderAllocationCharts(analytics);
  renderHourlyPlaceholder();
}

function renderCategoryChart(analytics) {
  const canvas = document.getElementById('category-chart');
  const ctx = canvas.getContext('2d');

  if (charts['category']) charts['category'].destroy();

  const labels = Object.keys(CATEGORIES).map(id => currentUserSettings.categoryNames?.[id] || id);
  const data = Object.keys(CATEGORIES).map(id => (analytics.categoryTime[CATEGORIES[id]] || 0) / 3600000);

  charts['category'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Hours Active',
        data: data,
        backgroundColor: CHART_COLORS,
        borderRadius: 4,
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { padding: 10, cornerRadius: 6 }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(128,128,128,0.1)', drawBorder: false },
          ticks: { callback: value => value + 'h' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderTopDomainsChart(analytics) {
  const canvas = document.getElementById('top-domains-chart');
  const ctx = canvas.getContext('2d');

  if (charts['domains']) charts['domains'].destroy();

  const top10 = analytics.topDomains.slice(0, 10);
  const labels = top10.map(d => d.domain);
  const data = top10.map(d => d.totalActiveTimeMs / 3600000);

  charts['domains'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: CHART_COLORS,
        hoverOffset: 8,
        borderWidth: 2,
        borderColor: 'rgba(128, 128, 128, 0.1)',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, padding: 16, font: { size: 11 } } },
        tooltip: { padding: 10, cornerRadius: 6 }
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

  const labels = Object.keys(CATEGORIES).map(id => currentUserSettings.categoryNames?.[id] || id);

  const targetData = Object.keys(CATEGORIES).map(id => {
    const label = currentUserSettings.categoryNames?.[id] || id;
    return currentUserSettings.goals?.[label] || 0;
  });

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 10 } } },
      tooltip: { padding: 10 }
    },
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.1)'
  };

  charts['target'] = new Chart(ctxTarget, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: targetData, backgroundColor: CHART_COLORS }] },
    options: sharedOptions
  });

  let actualData = labels.map(() => 0);
  if (analytics.totalActiveTime > 0) {
    actualData = Object.keys(CATEGORIES).map(id => {
      const internalName = CATEGORIES[id];
      const timeMs = analytics.categoryTime[internalName] || 0;
      return Math.round((timeMs / analytics.totalActiveTime) * 100);
    });
  }

  charts['actual'] = new Chart(ctxActual, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: actualData, backgroundColor: CHART_COLORS }] },
    options: sharedOptions
  });
}

function renderHourlyPlaceholder(range = 'day') {
  const canvas = document.getElementById('hourly-chart');
  const ctx = canvas.getContext('2d');
  if (charts['hourly']) charts['hourly'].destroy();

  let labels = [];
  let data = [];

  if (range === 'day') {
    labels = Array.from({ length: 24 }, (_, i) => i === 0 ? '12am' : i < 12 ? i + 'am' : i === 12 ? '12pm' : (i - 12) + 'pm');
    data = [5, 2, 0, 0, 10, 40, 120, 180, 250, 140, 320, 200, 190, 80, 160, 280, 450, 120, 90, 60, 200, 150, 50, 20];
  } else if (range === 'week') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    data = [420, 510, 390, 600, 550, 200, 150];
  } else if (range === 'month') {
    labels = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    data = Array.from({ length: 30 }, () => Math.floor(Math.random() * 500) + 100);
  } else {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    data = [12000, 15000, 11000, 18000, 22000, 25000];
  }

  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const lineColor = isDark ? '#888888' : '#555555';
  const fillColor = isDark ? 'rgba(136,136,136,0.15)' : 'rgba(85,85,85,0.1)';

  charts['hourly'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Active Minutes',
        data: data,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: range === 'month' ? 0 : 3,
        pointHoverRadius: 6,
        pointBackgroundColor: lineColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(128,128,128,0.05)', drawBorder: false },
          ticks: { font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { autoSkip: true, maxTicksLimit: 12, font: { size: 10 } }
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

  Object.keys(CATEGORIES).forEach(id => {
    const currentLabel = currentUserSettings.categoryNames?.[id] || id;
    const currentVal = currentUserSettings.goals?.[currentLabel] || 0;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '4px';
    wrapper.innerHTML = `
      <input type="text" data-id="${id}" class="category-name-input" value="${currentLabel}" 
             style="font-size:11px; border:none; background:transparent; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px; outline:none;">
      <input type="number" data-id="${id}" class="category-goal-input" value="${currentVal}" 
             style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--bg-app); color:var(--text-main);">
    `;
    container.appendChild(wrapper);
  });
}

document.getElementById('save-goals-btn').addEventListener('click', async () => {
  const nameInputs = document.querySelectorAll('.category-name-input');
  const goalInputs = document.querySelectorAll('.category-goal-input');

  let newNames = {};
  let newGoals = {};

  nameInputs.forEach((input, i) => {
    const id = input.dataset.id;
    const newName = input.value.trim() || id;
    const newVal = parseInt(goalInputs[i].value, 10) || 0;

    newNames[id] = newName;
    newGoals[newName] = newVal;
  });

  currentUserSettings.categoryNames = newNames;
  currentUserSettings.goals = newGoals;

  await StorageManager.set('userSettings', currentUserSettings);
  alert("Custom categories and goals saved!");
  refreshDashboard();
});

document.getElementById('reset-categories-btn').addEventListener('click', async () => {
  if (confirm("Reset all category labels to defaults?")) {
    currentUserSettings.categoryNames = { ...CATEGORIES };
    currentUserSettings.goals = { ...DEFAULT_GOALS };
    await StorageManager.set('userSettings', currentUserSettings);
    refreshDashboard();
  }
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

    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
});

// Auto-Sync History logic (run once to prime the dataset)
async function autoSyncHistory() {
  chrome.history.search({ text: '', maxResults: 100000, startTime: 0 }, async (results) => {
    const { extractDomain, categorizeDomain } = await import('../utils/categorization.js');
    const domainsDB = await StorageManager.get('domains') || {};

    results.forEach(item => {
      const domain = extractDomain(item.url);
      if (domain) {
        if (!domainsDB[domain]) {
          domainsDB[domain] = {
            domain: domain,
            totalActiveTimeMs: item.visitCount * 180000, // Heuristic: 3 mins per visit
            category: categorizeDomain(domain, currentUserSettings?.customRules || {}),
            visitCount: item.visitCount,
            lastVisit: item.lastVisitTime
          };
        } else {
          domainsDB[domain].visitCount += item.visitCount;
          if (item.lastVisitTime > (domainsDB[domain].lastVisit || 0)) {
            domainsDB[domain].lastVisit = item.lastVisitTime;
          }
        }
      }
    });

    await StorageManager.set('domains', domainsDB);
    currentUserSettings.hasSyncedHistory = true;
    await StorageManager.set('userSettings', currentUserSettings);
    refreshDashboard();
  });
}

// ─── Tracker Tab ──────────────────────────────────────────────────────────────

let currentTrackerPeriod = 'all_time';

async function refreshTrackerTable() {
  const filter = document.getElementById('tracker-time-filter');
  const hideLow = document.getElementById('hide-low-usage')?.checked;
  if (filter) currentTrackerPeriod = filter.value;

  if (currentTrackerPeriod === 'all_time') {
    let domainsDB = await StorageManager.get('domains') || {};
    if (hideLow) {
      const filtered = {};
      Object.keys(domainsDB).forEach(k => {
        if (domainsDB[k].totalActiveTimeMs >= 300000) filtered[k] = domainsDB[k];
      });
      domainsDB = filtered;
    }
    renderTrackerTable(domainsDB);
  } else {
    const now = new Date();
    let startTime = 0;

    now.setHours(0, 0, 0, 0); // Start of today
    if (currentTrackerPeriod === 'today') {
      startTime = now.getTime();
    } else if (currentTrackerPeriod === 'yesterday') {
      startTime = now.getTime() - (24 * 3600000);
    } else if (currentTrackerPeriod === 'this_week') {
      startTime = now.getTime() - (now.getDay() * 24 * 3600000);
    } else if (currentTrackerPeriod === 'this_year') {
      const thisYear = new Date(now.getFullYear(), 0, 1);
      startTime = thisYear.getTime();
    }

    chrome.history.search({ text: '', maxResults: 100000, startTime: startTime }, async (results) => {
      const { extractDomain, categorizeDomain } = await import('../utils/categorization.js');
      const tempDB = {};

      results.forEach(item => {
        if (currentTrackerPeriod === 'yesterday' && item.lastVisitTime > now.getTime()) return;

        const domain = extractDomain(item.url);
        if (domain) {
          if (!tempDB[domain]) {
            tempDB[domain] = {
              domain: domain,
              totalActiveTimeMs: item.visitCount * 180000,
              category: categorizeDomain(domain, currentUserSettings?.customRules || {}),
              visitCount: item.visitCount,
              lastVisit: item.lastVisitTime
            };
          } else {
            tempDB[domain].visitCount += item.visitCount;
            tempDB[domain].totalActiveTimeMs += (item.visitCount * 180000);
          }
        }
      });

      let finalDB = tempDB;
      if (hideLow) {
        finalDB = {};
        Object.keys(tempDB).forEach(k => {
          if (tempDB[k].totalActiveTimeMs >= 300000) finalDB[k] = tempDB[k];
        });
      }

      renderTrackerTable(finalDB, true);
    });
  }
}

document.getElementById('tracker-time-filter')?.addEventListener('change', refreshTrackerTable);
document.getElementById('hide-low-usage')?.addEventListener('change', refreshTrackerTable);

function renderTrackerTable(domainsDB, isFilterView = false) {
  const tbody = document.getElementById('tracker-table-body');
  const isCompare = document.getElementById('compare-all-time')?.checked;
  if (!tbody) return;
  tbody.innerHTML = '';

  const domainsArr = Object.values(domainsDB).sort((a, b) => b.totalActiveTimeMs - a.totalActiveTimeMs).slice(0, 50);

  StorageManager.get('domains').then(allTimeDB => {
    domainsArr.forEach(d => {
      const tr = document.createElement('tr');
      const catIds = Object.keys(CATEGORIES);
      const catId = catIds.find(key => CATEGORIES[key] === d.category) || 'OTHER';
      const catIndex = catIds.indexOf(catId);
      const displayCat = currentUserSettings.categoryNames?.[catId] || catId;
      const minutes = Math.floor(d.totalActiveTimeMs / 60000);
      const badgeColor = CHART_COLORS[catIndex % CHART_COLORS.length];

      let compareHtml = '';
      if (isCompare && isFilterView) {
        const allTime = allTimeDB?.[d.domain]?.totalActiveTimeMs || 0;
        const diff = d.totalActiveTimeMs - allTime;
        const diffMins = Math.floor(Math.abs(diff) / 60000);
        const color = diff >= 0 ? 'var(--green)' : 'var(--red)';
        const sign = diff >= 0 ? '+' : '-';
        compareHtml = `<span style="font-size: 10px; color: ${color}; margin-left: 8px;">(${sign}${diffMins}m vs life)</span>`;
      }

      tr.innerHTML = `
        <td class="domain-cell">${d.domain}</td>
        <td class="category-cell"><span class="category-badge" style="background: ${badgeColor}20; color: ${badgeColor}; border: 1px solid ${badgeColor}40;">${displayCat}</span></td>
        <td class="time-cell">
          <input type="number" class="time-edit-input" data-domain="${d.domain}" value="${minutes}" style="width: 70px; padding: 4px; border-radius: 4px; background: var(--bg-panel); color: var(--text-main); border: 1px solid var(--border); text-align: right;" ${isFilterView ? 'disabled' : ''}> min
          ${compareHtml}
        </td>
        <td class="count-cell">${d.visitCount}</td>
      `;
      tbody.appendChild(tr);
    });

    if (!isFilterView) {
      document.querySelectorAll('.time-edit-input').forEach(input => {
        input.addEventListener('change', async (e) => {
          const domain = e.target.dataset.domain;
          const newMins = parseInt(e.target.value, 10) || 0;
          const realDb = await StorageManager.get('domains') || {};
          if (realDb[domain]) {
            realDb[domain].totalActiveTimeMs = newMins * 60000;
            await StorageManager.set('domains', realDb);
            refreshDashboard();
          }
        });
      });
    }
  });

  currentTrackerDomainsArr = domainsArr;
  renderTrackerVisualCanvas(domainsArr);
}

document.getElementById('compare-all-time')?.addEventListener('change', refreshTrackerTable);

function renderTrackerVisualCanvas(domainsArr) {
  const canvas = document.getElementById('tracker-pie-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (charts['tracker-pie']) charts['tracker-pie'].destroy();

  const topCount = 8;
  const labels = domainsArr.slice(0, topCount).map(d => d.domain);
  const data = domainsArr.slice(0, topCount).map(d => d.totalActiveTimeMs / 60000);

  charts['tracker-pie'] = new Chart(ctx, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: CHART_COLORS.slice(0, topCount), borderWidth: 1, borderColor: 'rgba(128,128,128,0.1)' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, padding: 10, font: { size: 9 } } }
      }
    }
  });

  const aiCtx = document.getElementById('ai-activity-chart')?.getContext('2d');
  if (!aiCtx) return;
  if (charts['ai-activity']) charts['ai-activity'].destroy();
  charts['ai-activity'] = new Chart(aiCtx, {
    type: 'doughnut',
    data: { labels: ['Click "Analyze with AI" for insights'], datasets: [{ data: [1], backgroundColor: ['rgba(128,128,128,0.15)'] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '80%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 } } }
      }
    }
  });
}

// ─── AI Settings ──────────────────────────────────────────────────────────────

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

    const result = await callGeminiAI(apiKey, profile, analytics);

    if (result && result.goals && result.categoryNames) {
      const summary = Object.entries(result.goals)
        .map(([cat, val]) => `${cat}: ${val}%`)
        .join('\n');

      const planMsg = result.reasoning ? `AI Plan: ${result.reasoning}\n\n` : '';

      if (confirm(`${planMsg}Gemini suggests the following category names and target goals:\n\n${summary}\n\nDo you want to apply this personalized role profile?`)) {
        currentUserSettings.goals = result.goals;
        currentUserSettings.categoryNames = result.categoryNames;
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

  const availableIds = Object.keys(CATEGORIES).join(', ');
  const actualUsage = Object.entries(analytics.categoryTime)
    .map(([cat, ms]) => `${cat}: ${Math.round(ms / 60000)}m`)
    .join(', ');

  const prompt = `
    User Profile: ${profile}
    Current Local Browsing Usage (last few days): ${actualUsage}
    Available Category Slots (internal IDs): ${availableIds}
    
    Task: 
    1. Rename the Available Category Slots to fit the user's specific professional role (e.g. if they are a GTM Engineer, rename 'DEVELOPMENT' to 'GTM Engineering', 'WEB3' to 'CRM & Analytics', etc.). Be creative and professional.
    2. Suggest ideal target goal percentages for these RENAMED categories.
    3. Provide a brief 1-sentence 'reasoning' for this allocation.

    Constraints:
    1. The percentages MUST sum to exactly 100%.
    2. Return ONLY a valid JSON object with three keys:
       - 'categoryNames': { "ID": "New Name" } for ALL available slots.
       - 'goals': { "New Name": percentage } for ALL new names.
       - 'reasoning': "string"
    3. Do not include any other text.
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

  // Resilient JSON extraction
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in Gemini response:", content);
    throw new Error("AI returned an invalid format. Please try again.");
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", content);
    throw new Error("AI returned an invalid format. Please try again.");
  }
}

// ─── AI Activity Tracker ──────────────────────────────────────────────────────

const aiActivityBtn = document.getElementById('analyze-activities-btn');
if (aiActivityBtn) {
  aiActivityBtn.addEventListener('click', async () => {
    const apiKey = currentUserSettings?.geminiApiKey;
    if (!apiKey) {
      alert("Please set your Gemini API Key in Settings first.");
      const settingsBtn = document.querySelector('.nav-item[data-tab="settings"]');
      if (settingsBtn) settingsBtn.click();
      return;
    }

    if (!currentTrackerDomainsArr || currentTrackerDomainsArr.length === 0) {
      alert("No data to analyze.");
      return;
    }

    const originalText = aiActivityBtn.innerText;
    aiActivityBtn.innerText = "Analyzing...";
    aiActivityBtn.disabled = true;

    try {
      const topDomains = currentTrackerDomainsArr.slice(0, 20);
      const usageList = topDomains.map(d => `${d.domain}: ${Math.floor(d.totalActiveTimeMs / 60000)}m`).join(', ');

      const prompt = `
        I have tracked the following browsing time for this user:
        ${usageList}

        Group these websites into 4-6 broad activity categories based on what they are typically used for (e.g., 'Coding/Development', 'Video Streaming', 'Social Scrolling', 'Research', 'General Reading'). 
        Calculate the total estimated percentage of time spent in each new broad activity category.
        
        Constraints:
        1. Percentages MUST sum to exactly 100.
        2. Return ONLY a valid JSON object strictly in this format: 
           { "Activity Category Name": percentage }
        3. Do not include markdown code blocks, just raw JSON.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) throw new Error("API Error");

      const result = await response.json();
      const content = result.candidates[0].content.parts[0].text;

      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error("No JSON found");

      const activityData = JSON.parse(jsonMatch[0]);

      // Update the chart with theme-consistent colors
      const aiCtx = document.getElementById('ai-activity-chart').getContext('2d');
      if (charts['ai-activity']) charts['ai-activity'].destroy();

      const labels = Object.keys(activityData);
      const data = Object.values(activityData);

      charts['ai-activity'] = new Chart(aiCtx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: CHART_COLORS, borderWidth: 1, borderColor: 'rgba(128,128,128,0.1)' }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 10 } } },
            tooltip: { padding: 10 }
          },
          cutout: '70%'
        }
      });

    } catch (err) {
      console.error(err);
      alert("Activity analysis failed. Check your API key or try again.");
    } finally {
      aiActivityBtn.innerText = originalText;
      aiActivityBtn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', refreshDashboard);
