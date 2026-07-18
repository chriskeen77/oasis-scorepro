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
  const [book, setBook] = useState(null) // { title, chapters: [{title, text, included}] }
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    const poll = () => api.jobs().then(d => setJobs(d.jobs)).catch(() => {})
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  const loadFile = async (file) => {
    if (!file) return
    onError(null)
    if (file.name.toLowerCase().endsWith('.epub')) {
      try {
        const parsed = await api.uploadEpub(file)
        setBook({ ...parsed, chapters: parsed.chapters.map(c => ({ ...c, included: true })) })
        setText('')
        if (!title) setTitle(parsed.title)
      } catch (e) {
        onError(e.message)
      }
    } else {
      setBook(null)
      setText(await file.text())
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
    }
  }

  const toggleChapter = (i) => {
    setBook(b => ({
      ...b,
      chapters: b.chapters.map((c, j) => (j === i ? { ...c, included: !c.included } : c)),
    }))
  }

  const canSubmit = book ? book.chapters.some(c => c.included) : !!text.trim()

  const submit = async () => {
    onError(null)
    try {
      const payload = { engine, voice: voice || null, title: title || 'untitled' }
      if (book) {
        payload.chapters = book.chapters.filter(c => c.included).map(({ title: t, text: x }) => ({ title: t, text: x }))
      } else {
        payload.text = text
      }
      await api.audiobook(payload)
      setText('')
      setBook(null)
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
          Load book (.epub or .txt)
          <input type="file" accept=".epub,.txt,.md,text/plain" onChange={e => loadFile(e.target.files[0])} />
        </label>
      </div>
      {book ? (
        <div className="chapter-list">
          <p className="muted">
            {book.chapters.filter(c => c.included).length} of {book.chapters.length} chapters selected —
            untick front matter you don't want narrated. Multi-chapter books export as M4B with chapter markers.
          </p>
          {book.chapters.map((c, i) => (
            <label key={i} className="chapter">
              <input type="checkbox" checked={c.included} onChange={() => toggleChapter(i)} />
              <span>{c.title || `Chapter ${i + 1}`}</span>
              <span className="muted">{(c.text.length / 1000).toFixed(1)}k chars</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea rows={10} placeholder="Paste the full book text here (or load an .epub/.txt file)… Lines like 'Chapter 1' become chapter markers." value={text} onChange={e => setText(e.target.value)} />
      )}
      <button className="primary" disabled={!canSubmit} onClick={submit}>Render audiobook</button>

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
            {j.status === 'running' && j.current_chapter && ` · ${j.current_chapter}`}
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

function Recorder({ onClip }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef(null)
  const timerRef = useRef(null)

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const parts = []
      rec.ondataavailable = e => parts.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        onClip(new Blob(parts, { type: rec.mimeType || 'audio/webm' }))
      }
      rec.start()
      recorderRef.current = rec
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      setRecording(true)
    } catch {
      onClip(null, 'Microphone access denied or unavailable')
    }
  }

  const stop = () => {
    clearInterval(timerRef.current)
    recorderRef.current?.stop()
    setRecording(false)
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  return recording ? (
    <button onClick={stop}>⏹ Stop ({seconds}s)</button>
  ) : (
    <button onClick={start}>🎙 Record with mic</button>
  )
}

function Voices({ voices, refresh, onError }) {
  const [name, setName] = useState('')
  const fileRef = useRef(null)
  const [recorded, setRecorded] = useState(null) // { blob, url }
  const [busy, setBusy] = useState(false)

  const handleClip = (blob, err) => {
    if (err) { onError(err); return }
    if (recorded) URL.revokeObjectURL(recorded.url)
    setRecorded({ blob, url: URL.createObjectURL(blob) })
  }

  const upload = async () => {
    const picked = fileRef.current?.files?.[0]
    const file = picked || (recorded && new File([recorded.blob], 'recording.webm'))
    if (!file || !name.trim()) return
    setBusy(true)
    onError(null)
    try {
      await api.uploadVoice(name.trim(), file)
      setName('')
      fileRef.current.value = ''
      if (recorded) URL.revokeObjectURL(recorded.url)
      setRecorded(null)
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
        Record or upload 5–20 seconds of clean speech (no music or background noise).
        Chatterbox will speak in that voice. Only clone voices you have permission to use.
      </p>
      <div className="row">
        <label>
          Voice name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="my-voice" />
        </label>
        <label>
          Reference clip (or record below)
          <input type="file" ref={fileRef} accept=".wav,.flac,.ogg,.mp3,.m4a,audio/*" />
        </label>
        <button className="primary" disabled={busy || !name.trim()} onClick={upload}>
          {busy ? 'Uploading…' : 'Add voice'}
        </button>
      </div>
      <div className="row">
        <Recorder onClip={handleClip} />
        {recorded && <audio controls src={recorded.url} />}
        {recorded && <span className="muted">recording ready — name it and click Add voice</span>}
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
