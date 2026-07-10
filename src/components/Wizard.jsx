import { useState } from 'react'

function OptionCard({ option, selected, onToggle }) {
  return (
    <button
      className={`option-card${selected ? ' selected' : ''}${option.custom ? ' custom' : ''}`}
      onClick={onToggle}
      type="button"
    >
      <span className="option-title">
        {option.custom && <span className="custom-badge">yours</span>}
        {option.title}
      </span>
      {option.summary && <span className="option-summary">{option.summary}</span>}
    </button>
  )
}

export default function Wizard({
  step,
  stepIndex,
  totalSteps,
  ideas,
  loading,
  error,
  demoMode,
  selected,
  onToggle,
  onAddCustom,
  onRegenerate,
  onNext,
  onBack,
  onSkip,
}) {
  const [customText, setCustomText] = useState('')

  const isSelected = (opt) => selected.some((s) => s.title === opt.title)
  const atMax = step.multi && step.max && selected.length >= step.max

  const submitCustom = (e) => {
    e.preventDefault()
    const text = customText.trim()
    if (!text) return
    onAddCustom(text)
    setCustomText('')
  }

  // Custom picks the user added that aren't part of the generated grid
  const customPicks = selected.filter(
    (s) => s.custom && !ideas.some((o) => o.title === s.title),
  )

  return (
    <div className="wizard">
      <div className="progress">
        {Array.from({ length: totalSteps }, (_, i) => (
          <span
            key={i}
            className={`progress-dot${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}
          />
        ))}
      </div>

      <header className="step-header">
        <p className="step-count">
          Step {stepIndex + 1} of {totalSteps} · {step.label}
        </p>
        <h2>{step.title}</h2>
        <p className="step-subtitle">
          {step.subtitle}
          {step.multi && step.max ? ` (choose up to ${step.max})` : ''}
        </p>
      </header>

      {error && (
        <div className="notice">
          Couldn’t reach the AI ({error}) — showing house ideas instead.
        </div>
      )}
      {demoMode && !error && (
        <div className="notice subtle">
          Demo mode — these are sample ideas. Add an API key for fresh,
          story-aware suggestions.
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Dreaming up {step.label.toLowerCase()} ideas…</p>
        </div>
      ) : (
        <>
          <div className="option-grid">
            {ideas.map((opt) => (
              <OptionCard
                key={opt.title}
                option={opt}
                selected={isSelected(opt)}
                onToggle={() => onToggle(opt)}
              />
            ))}
            {customPicks.map((opt) => (
              <OptionCard
                key={opt.title}
                option={opt}
                selected
                onToggle={() => onToggle(opt)}
              />
            ))}
          </div>

          <form className="custom-row" onSubmit={submitCustom}>
            <input
              type="text"
              placeholder={`Or write your own ${step.label.toLowerCase()}…`}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              disabled={atMax}
            />
            <button
              type="submit"
              className="btn secondary"
              disabled={!customText.trim() || atMax}
            >
              Add
            </button>
          </form>
          {atMax && (
            <p className="hint">
              That’s the limit for this step — unselect one to swap it out.
            </p>
          )}
        </>
      )}

      <footer className="step-actions">
        <div>
          {stepIndex > 0 && (
            <button className="btn ghost" onClick={onBack}>
              ← Back
            </button>
          )}
        </div>
        <div className="step-actions-right">
          {!demoMode && (
            <button className="btn ghost" onClick={onRegenerate} disabled={loading}>
              ↻ More ideas
            </button>
          )}
          <button className="btn ghost" onClick={onSkip} disabled={loading}>
            Skip — surprise me
          </button>
          <button
            className="btn primary"
            onClick={onNext}
            disabled={loading || selected.length === 0}
          >
            {stepIndex === totalSteps - 1 ? 'Review my story →' : 'Next →'}
          </button>
        </div>
      </footer>
    </div>
  )
}
