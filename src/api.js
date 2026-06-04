const API_BASE = '/api';

async function request(path, options = {}, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  dashboard: (token, range = '7d') => request(`/dashboard?range=${range}`, {}, token),
  history: (token, filters = '') => request(`/history${filters}`, {}, token),
  exportCsv: async (token, filters = '') => {
    const response = await fetch(`${API_BASE}/history/export${filters}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.text();
  },
  addEntry: (token, payload) => request('/entries', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateEntry: (token, entryId, payload) => request(`/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
  deleteEntry: (token, entryId) => request(`/entries/${entryId}`, { method: 'DELETE' }, token),
  goals: (token) => request('/goals', {}, token),
  addGoal: (token, payload) => request('/goals', { method: 'POST', body: JSON.stringify(payload) }, token),
  recalculateGoals: (token) => request('/goals/recalculate', { method: 'POST' }, token),
  insights: (token, metricX, metricY) => request(`/insights?metricX=${metricX}&metricY=${metricY}`, {}, token)
};
