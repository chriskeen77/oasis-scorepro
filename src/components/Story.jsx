import { useEffect, useRef, useState } from 'react'
import {
  isSpeechSupported,
  listVoices,
  speakStory,
  synthesizeWav,
  slugify,
  downloadBlob,
} from '../lib/narration.js'

export default function Story({ text, thinking, error, done, onBack, onRestart }) {
  const [copied, setCopied] = useState(false)
  const [narration, setNarration] = useState('idle') // idle | playing | paused | done
  const [progress, setProgress] = useState(0)
  const [voices, setVoices] = useState([])
  const [voiceName, setVoiceName] = useState('')
  const [saving, setSaving] = useState(false)
  const [narrateError, setNarrateError] = useState(null)
  const speechRef = useRef(null)

  const speechOk = isSpeechSupported()

  const firstBreak = text.indexOf('\n')
  const title = firstBreak === -1 ? text : text.slice(0, firstBreak)
  const body = firstBreak === -1 ? '' : text.slice(firstBreak + 1).trim()
  const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim())

  useEffect(() => {
    if (!speechOk) return
    const load = () => setVoices(listVoices())
    load()
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [speechOk])

  // Stop speaking if the user leaves the story screen
  useEffect(() => () => speechRef.current?.cancel(), [])

  const startNarration = () => {
    setNarrateError(null)
    setProgress(0)
    setNarration('playing')
    const voice = voices.find((v) => v.name === voiceName) || voices[0]
    speechRef.current = speakStory(text, {
      voice,
      onProgress: setProgress,
      onEnd: () => setNarration('done'),
      onError: (msg) => {
        setNarrateError(`Narration failed: ${msg}`)
        setNarration('idle')
      },
    })
  }

  const pauseNarration = () => {
    speechRef.current?.pause()
    setNarration('paused')
  }

  const resumeNarration = () => {
    speechRef.current?.resume()
    setNarration('playing')
  }

  const stopNarration = () => {
    speechRef.current?.cancel()
    setNarration('idle')
    setProgress(0)
  }

  const saveWav = async () => {
    setSaving(true)
    setNarrateError(null)
    try {
      const blob = await synthesizeWav(text)
      downloadBlob(blob, `${slugify(title)}-narration.wav`)
    } catch (err) {
      setNarrateError(`Couldn’t render the WAV: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  const copyStory = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (permissions/insecure context) — nothing to do
    }
  }

  return (
    <div className="story">
      {thinking && (
        <div className="loading">
          <div className="spinner" />
          <p>Thinking hard about your story — structure, arc, where to hide the twist…</p>
        </div>
      )}

      {error && (
        <div className="notice">
          Something went wrong while writing: {error}
        </div>
      )}

      {text && (
        <article className="story-page">
          <h1 className="story-title">{title}</h1>
          {paragraphs.map((p, i) => (
            <p key={i}>
              {p.split('\n').map((line, j, arr) => (
                <span key={j}>
                  {line}
                  {j < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          ))}
          {!done && !error && <span className="cursor">▍</span>}
        </article>
      )}

      {done && text && !error && speechOk && (
        <div className="narration-bar">
          {narrateError && <div className="notice">{narrateError}</div>}

          {narration === 'idle' && (
            <div className="narration-controls">
              <button className="btn secondary" onClick={startNarration}>
                ▶ Narrate story
              </button>
              {voices.length > 1 && (
                <select
                  className="voice-select"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  aria-label="Narration voice"
                >
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {(narration === 'playing' || narration === 'paused') && (
            <div className="narration-controls">
              <span className="narration-status">
                {narration === 'paused' ? 'Paused' : 'Narrating…'}{' '}
                {Math.round(progress * 100)}%
              </span>
              {narration === 'playing' ? (
                <button className="btn ghost" onClick={pauseNarration}>
                  ⏸ Pause
                </button>
              ) : (
                <button className="btn ghost" onClick={resumeNarration}>
                  ▶ Resume
                </button>
              )}
              <button className="btn ghost" onClick={stopNarration}>
                ⏹ Stop
              </button>
            </div>
          )}

          {narration === 'done' && (
            <div className="narration-controls">
              <span className="narration-status">Narration finished ✓</span>
              <button className="btn secondary" onClick={saveWav} disabled={saving}>
                {saving ? 'Rendering WAV…' : '⬇ Save narration (WAV)'}
              </button>
              <button className="btn ghost" onClick={startNarration}>
                ↻ Narrate again
              </button>
            </div>
          )}

          {narration === 'done' && (
            <p className="hint">
              The WAV is rendered with StoryTime’s built-in offline narrator
              voice — browsers can’t record their own speech voices.
            </p>
          )}
        </div>
      )}

      {(done || error) && (
        <footer className="step-actions story-actions">
          <div className="step-actions-right">
            <button className="btn ghost" onClick={onBack}>
              ← Tweak ingredients
            </button>
            {done && text && (
              <button className="btn secondary" onClick={copyStory}>
                {copied ? '✓ Copied' : 'Copy story'}
              </button>
            )}
            <button className="btn primary" onClick={onRestart}>
              ✦ New story
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
