import { useState } from 'react'

export default function Story({ text, thinking, error, done, onBack, onRestart }) {
  const [copied, setCopied] = useState(false)

  const firstBreak = text.indexOf('\n')
  const title = firstBreak === -1 ? text : text.slice(0, firstBreak)
  const body = firstBreak === -1 ? '' : text.slice(firstBreak + 1).trim()
  const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim())

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
