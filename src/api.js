const BASE = '/api'

async function check(res) {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch { /* non-JSON error body */ }
    throw new Error(detail)
  }
  return res
}

export const api = {
  modelsStatus: () => fetch(`${BASE}/models/status`).then(check).then(r => r.json()),
  unloadModel: (name) => fetch(`${BASE}/models/${name}/unload`, { method: 'POST' }).then(check).then(r => r.json()),
  voices: () => fetch(`${BASE}/voices`).then(check).then(r => r.json()),
  uploadVoice: (name, file) => {
    const form = new FormData()
    form.append('name', name)
    form.append('file', file)
    return fetch(`${BASE}/voices`, { method: 'POST', body: form }).then(check).then(r => r.json())
  },
  deleteVoice: (name) => fetch(`${BASE}/voices/${encodeURIComponent(name)}`, { method: 'DELETE' }).then(check).then(r => r.json()),
  tts: (payload) =>
    fetch(`${BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(check).then(r => r.blob()),
  audiobook: (payload) =>
    fetch(`${BASE}/audiobook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(check).then(r => r.json()),
  jobs: () => fetch(`${BASE}/jobs`).then(check).then(r => r.json()),
  cancelJob: (id) => fetch(`${BASE}/jobs/${id}/cancel`, { method: 'POST' }).then(check).then(r => r.json()),
  jobDownloadUrl: (id) => `${BASE}/jobs/${id}/download`,
}
