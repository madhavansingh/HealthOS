let rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Normalize: remove trailing slash if present
if (rawApiUrl.endsWith('/')) {
  rawApiUrl = rawApiUrl.slice(0, -1);
}

// Normalize: ensure it ends with /api
if (!rawApiUrl.endsWith('/api')) {
  rawApiUrl = `${rawApiUrl}/api`;
}

const API_BASE = rawApiUrl;

async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.warn(`[API] ${endpoint} failed:`, err.message);
    throw err;
  }
}

// ===== DASHBOARD =====
export const getDashboardSummary = () => apiFetch('/dashboard/summary');
export const getMissionControl = () => apiFetch('/mission-control');

// ===== REPORTS =====
export const getReports = () => apiFetch('/reports');
export const getReport = (id) => apiFetch(`/reports/${id}`);
export const deleteReport = (id) => apiFetch(`/reports/${id}`, { method: 'DELETE' });
export const getReportStatus = (id) => apiFetch(`/reports/${id}/status`);
export const getReportComparison = (baseId, compareId) => {
  const query = baseId && compareId ? `?baseReportId=${baseId}&compareReportId=${compareId}` : '';
  return apiFetch(`/reports/compare${query}`);
};
export const getTwinHistory = () => apiFetch('/twin/history');
export const analyzeDemoReport = (scenario) =>
  apiFetch('/reports/analyze-demo', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  });

export async function uploadReport(file, name) {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);

  const res = await fetch(`${API_BASE}/reports/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Upload failed: HTTP ${res.status}`);
  }
  return res.json();
}

// ===== INSIGHTS =====
export const getTrendInsights = () => apiFetch('/insights/trends');
export const getInsightsSummary = () => apiFetch('/insights/summary');
export const getHealthTwin = () => apiFetch('/insights/twin');

// ===== TIMELINE =====
export const getVitalsTimeline = () => apiFetch('/timeline/vitals');
export const getHealthEvents = () => apiFetch('/timeline/events');

// ===== COPILOT =====
export const getDoctorBrief = () => apiFetch('/copilot/brief');

// ===== HEALTH GRAPH =====
export const getHealthGraph = () => apiFetch('/graph/graph');

// ===== SIMULATOR =====
export const runSimulation = (scenario = 'combined') =>
  apiFetch('/simulator/simulator', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  });

// ===== FAMILY =====
export const getFamilyMembers = () => apiFetch('/family/family');

// ===== PREVENTIVE =====
export const getPreventiveCare = () => apiFetch('/preventive/preventive');

// ===== CHAT (SSE Streaming) =====
export async function* sendChatMessage(message, sessionId) {
  const res = await fetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) throw new Error(`Chat error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          yield data;
        } catch {
          // ignore parse errors on partial chunks
        }
      }
    }
  }
}

// ===== HEALTH CHECK =====
export const checkBackendHealth = () =>
  fetch(`${API_BASE}/health`)
    .then(r => r.json())
    .catch(() => ({ status: 'offline' }));

// ===== POLL REPORT STATUS =====
export function pollReportStatus(reportId, onUpdate, maxAttempts = 30) {
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const status = await getReportStatus(reportId);
      onUpdate(status);
      if (status.status === 'analyzed' || status.status === 'error' || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    } catch {
      clearInterval(interval);
    }
  }, 3000);
  return () => clearInterval(interval);
}
