import { LENGTHS } from '../lib/steps.js'

export default function Review({
  steps,
  selections,
  length,
  onLength,
  onEdit,
  onWrite,
  canWrite,
}) {
  return (
    <div className="review">
      <header className="step-header">
        <p className="step-count">The recipe</p>
        <h2>Your story so far</h2>
        <p className="step-subtitle">
          One last look before the ink starts flowing. Tap any ingredient to
          change it.
        </p>
      </header>

      <div className="review-list">
        {steps.map((step, i) => {
          const picks = selections[step.id] || []
          return (
            <button
              key={step.id}
              className="review-item"
              onClick={() => onEdit(i)}
              type="button"
            >
              <span className="review-label">{step.label}</span>
              <span className="review-value">
                {picks.length > 0 ? (
                  picks.map((p) => p.title).join(' · ')
                ) : (
                  <em>Storyteller’s choice</em>
                )}
              </span>
              <span className="review-edit">edit</span>
            </button>
          )
        })}
      </div>

      <div className="length-picker">
        <p className="review-label">How long a tale?</p>
        <div className="length-options">
          {LENGTHS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`length-option${length.id === l.id ? ' selected' : ''}`}
              onClick={() => onLength(l)}
            >
              <span className="option-title">{l.label}</span>
              <span className="option-summary">{l.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {!canWrite && (
        <div className="notice">
          Writing the story needs the AI — add your Anthropic API key to
          continue.
        </div>
      )}

      <footer className="step-actions">
        <div />
        <button className="btn primary big" onClick={onWrite} disabled={!canWrite}>
          ✒ Write my story
        </button>
      </footer>
    </div>
  )
}
