import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import './App.css'

const TABS = ['Narrate', 'Audiobook', 'Voices']

export default function App() {
  const [tab, setTab] = useState('Narrate')
  const [voices, setVoices] = useState({ cloned: [], kokoro: [] })
  const [error, setError] = useState(null)

  const refreshVoices = useCallback(() => {
    api.voices().then(setVoices).catch(e => setError(e.message))
  }, [])

  useEffect(() => { refreshVoices() }, [refreshVoices])

  return (
    <div className="app">
      <header>
        <h1>Oasis TTS</h1>
        <nav>
          {TABS.map(t => (
            <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
      </header>
      {error && <div className="error" onClick={() => setError(null)}>{error} ✕</div>}
      <main>
        {tab === 'Narrate' && <Narrate voices={voices} onError={setError} />}
        {tab === 'Audiobook' && <Audiobook voices={voices} onError={setError} />}
        {tab === 'Voices' && <Voices voices={voices} refresh={refreshVoices} onError={setError} />}
      </main>
      <ModelPanel onError={setError} />
    </div>
  )
}

function EngineVoicePicker({ engine, setEngine, voice, setVoice, voices }) {
  const options = engine === 'chatterbox'
    ? [{ id: '', label: 'Default (built-in)' }, ...voices.cloned.map(v => ({ id: v, label: `🎙 ${v} (cloned)` }))]
    : voices.kokoro.map(v => ({ id: v, label: v }))
  return (
    <div className="row">
      <label>
        Engine
        <select value={engine} onChange={e => { setEngine(e.target.value); setVoice('') }}>
          <option value="chatterbox">Chatterbox — voice cloning, most natural</option>
          <option value="kokoro">Kokoro — fast, built-in voices</option>
        </select>
      </label>
      <label>
        Voice
        <select value={voice} onChange={e => setVoice(e.target.value)}>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
    </div>
  )
}

function Narrate({ voices, onError }) {
  const [engine, setEngine] = useState('chatterbox')
  const [voice, setVoice] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)

  const generate = async () => {
    setBusy(true)
    onError(null)
    try {
      const blob = await api.tts({ engine, text, voice: voice || null })
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(URL.createObjectURL(blob))
    } catch (e) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <EngineVoicePicker {...{ engine, setEngine, voice, setVoice, voices }} />
      <textarea rows={8} placeholder="Type or paste text to narrate…" value={text} onChange={e => setText(e.target.value)} />
      <div className="row">
        <button className="primary" disabled={busy || !text.trim()} onClick={generate}>
          {busy ? 'Generating… (first run loads the model)' : 'Generate speech'}
        </button>
        {audioUrl && <audio controls autoPlay src={audioUrl} />}
        {audioUrl && <a className="button" href={audioUrl} download="narration.wav">Download</a>}
      </div>
    </section>
  )
}

function Audiobook({ voices, onError }) {
  const [engine, setEngine] = useState('chatterbox')
  const [voice, setVoice] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    const poll = () => api.jobs().then(d => setJobs(d.jobs)).catch(() => {})
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  const loadFile = async (file) => {
    if (!file) return
    setText(await file.text())
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async () => {
    onError(null)
    try {
      await api.audiobook({ engine, text, voice: voice || null, title: title || 'untitled' })
      setText('')
    } catch (e) {
      onError(e.message)
    }
  }

  return (
    <section>
      <EngineVoicePicker {...{ engine, setEngine, voice, setVoice, voices }} />
      <div className="row">
        <label>
          Title
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="My Audiobook" />
        </label>
        <label>
          Load .txt file
          <input type="file" accept=".txt,.md,text/plain" onChange={e => loadFile(e.target.files[0])} />
        </label>
      </div>
      <textarea rows={10} placeholder="Paste the full book text here (or load a .txt file)…" value={text} onChange={e => setText(e.target.value)} />
      <button className="primary" disabled={!text.trim()} onClick={submit}>Render audiobook</button>

      <h2>Jobs</h2>
      {jobs.length === 0 && <p className="muted">No jobs yet.</p>}
      {jobs.map(j => (
        <div key={j.id} className="job">
          <div className="job-head">
            <strong>{j.title}</strong>
            <span className={`status ${j.status}`}>{j.status}</span>
          </div>
          {j.total_chunks > 0 && (
            <progress max={j.total_chunks} value={j.done_chunks} />
          )}
          <div className="job-meta">
            {j.done_chunks}/{j.total_chunks} chunks
            {j.eta_sec != null && ` · ~${formatSec(j.eta_sec)} left`}
            {j.elapsed_sec != null && ` · ${formatSec(j.elapsed_sec)} elapsed`}
            {j.error && <span className="error-text"> · {j.error}</span>}
          </div>
          <div className="row">
            {j.status === 'done' && <a className="button" href={api.jobDownloadUrl(j.id)}>Download {j.output_file}</a>}
            {(j.status === 'running' || j.status === 'queued') && (
              <button onClick={() => api.cancelJob(j.id)}>Cancel</button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

function Voices({ voices, refresh, onError }) {
  const [name, setName] = useState('')
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const upload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !name.trim()) return
    setBusy(true)
    onError(null)
    try {
      await api.uploadVoice(name.trim(), file)
      setName('')
      fileRef.current.value = ''
      refresh()
    } catch (e) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2>Clone a voice</h2>
      <p className="muted">
        Upload 5–20 seconds of clean speech (WAV/FLAC/OGG — no music or background noise).
        Chatterbox will speak in that voice. Only clone voices you have permission to use.
      </p>
      <div className="row">
        <label>
          Voice name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="my-voice" />
        </label>
        <label>
          Reference clip
          <input type="file" ref={fileRef} accept=".wav,.flac,.ogg,audio/*" />
        </label>
        <button className="primary" disabled={busy || !name.trim()} onClick={upload}>
          {busy ? 'Uploading…' : 'Add voice'}
        </button>
      </div>
      <h2>Cloned voices</h2>
      {voices.cloned.length === 0 && <p className="muted">None yet — add one above.</p>}
      <ul className="voice-list">
        {voices.cloned.map(v => (
          <li key={v}>
            🎙 {v}
            <button onClick={() => api.deleteVoice(v).then(refresh).catch(e => onError(e.message))}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ModelPanel({ onError }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const poll = () => api.modelsStatus().then(setStatus).catch(() => {})
    poll()
    const id = setInterval(poll, 4000)
    return () => clearInterval(id)
  }, [])

  if (!status) return null
  return (
    <footer className="model-panel">
      {status.devices.map(d => (
        <span key={d.id} className="chip">
          {d.name}: {(d.used_mb / 1024).toFixed(1)} / {(d.total_mb / 1024).toFixed(1)} GB
        </span>
      ))}
      {status.models.map(m => (
        <span key={m.name} className={`chip ${m.loaded ? 'loaded' : 'unloaded'}`}>
          {m.name} {m.loaded ? `● loaded on ${m.device}` : '○ unloaded'}
          {m.loaded && (
            <button onClick={() => api.unloadModel(m.name).catch(e => onError(e.message))}>free VRAM</button>
          )}
        </span>
      ))}
      <span className="chip muted">auto-unload after {status.idle_unload_sec}s idle</span>
    </footer>
  )
}

function formatSec(s) {
  if (s < 90) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  return m < 90 ? `${m}m ${Math.round(s % 60)}s` : `${(s / 3600).toFixed(1)}h`
}
