import { useState } from 'react'

export default function KeyGate({ onSubmit, onDemo }) {
  const [value, setValue] = useState('')

  return (
    <div className="keygate">
      <div className="keygate-card">
        <h1 className="brand">
          Story<span>Time</span>
        </h1>
        <p className="tagline">
          Build a story ingredient by ingredient — genre, setting, characters,
          twists — then watch the AI think hard and write it just for you.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) onSubmit(value.trim())
          }}
        >
          <label htmlFor="api-key">Anthropic API key</label>
          <input
            id="api-key"
            type="password"
            placeholder="sk-ant-..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            Start telling stories
          </button>
        </form>
        <p className="fineprint">
          Your key stays in this browser (localStorage) and is only sent to
          Anthropic. Get one at{' '}
          <a href="https://platform.claude.com/" target="_blank" rel="noreferrer">
            platform.claude.com
          </a>
          .
        </p>
        <button className="btn ghost" onClick={onDemo}>
          Explore in demo mode (sample ideas, no AI)
        </button>
      </div>
    </div>
  )
}
