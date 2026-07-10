import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient, generateIdeas, streamStory } from './lib/anthropic.js'
import { STEPS, LENGTHS } from './lib/steps.js'
import KeyGate from './components/KeyGate.jsx'
import Wizard from './components/Wizard.jsx'
import Review from './components/Review.jsx'
import Story from './components/Story.jsx'

const KEY_STORAGE = 'storytime_api_key'

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) || '')
  const client = useMemo(() => createClient(apiKey), [apiKey])

  const [phase, setPhase] = useState(apiKey ? 'wizard' : 'key')
  const [stepIndex, setStepIndex] = useState(0)
  const [selections, setSelections] = useState({})
  const [ideasByStep, setIdeasByStep] = useState({}) // stepId -> { options, error }
  const [loading, setLoading] = useState(false)
  const [length, setLength] = useState(LENGTHS[1])

  const [storyText, setStoryText] = useState('')
  const [storyThinking, setStoryThinking] = useState(false)
  const [storyDone, setStoryDone] = useState(false)
  const [storyError, setStoryError] = useState(null)

  const inFlight = useRef(new Set())
  const streamRef = useRef(null)

  const step = STEPS[stepIndex]

  const fetchIdeas = async (target, { force = false } = {}) => {
    if (!client) {
      setIdeasByStep((prev) => ({
        ...prev,
        [target.id]: { options: target.fallback, error: null },
      }))
      return
    }
    if (inFlight.current.has(target.id)) return
    inFlight.current.add(target.id)
    if (force) {
      setIdeasByStep((prev) => ({ ...prev, [target.id]: undefined }))
    }
    setLoading(true)
    try {
      const options = await generateIdeas(client, target, selections, STEPS)
      setIdeasByStep((prev) => ({ ...prev, [target.id]: { options, error: null } }))
    } catch (err) {
      setIdeasByStep((prev) => ({
        ...prev,
        [target.id]: { options: target.fallback, error: err.message || String(err) },
      }))
    } finally {
      inFlight.current.delete(target.id)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (phase !== 'wizard') return
    const target = STEPS[stepIndex]
    if (ideasByStep[target.id]) return
    fetchIdeas(target)
    // fetchIdeas reads current selections/client; re-running on their change is undesired mid-step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, client])

  const toggleOption = (opt) => {
    setSelections((prev) => {
      const current = prev[step.id] || []
      const exists = current.some((s) => s.title === opt.title)
      let next
      if (exists) {
        next = current.filter((s) => s.title !== opt.title)
      } else if (step.multi) {
        if (step.max && current.length >= step.max) return prev
        next = [...current, opt]
      } else {
        next = [opt]
      }
      return { ...prev, [step.id]: next }
    })
  }

  const addCustom = (text) => {
    toggleOption({ title: text, summary: '', custom: true })
  }

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1)
    else setPhase('review')
  }

  const skipStep = () => {
    setSelections((prev) => ({ ...prev, [step.id]: [] }))
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1)
    else setPhase('review')
  }

  const writeStory = () => {
    if (!client) return
    setPhase('story')
    setStoryText('')
    setStoryDone(false)
    setStoryError(null)
    setStoryThinking(true)

    const stream = streamStory(client, selections, STEPS, length)
    streamRef.current = stream
    stream.on('text', (delta) => {
      setStoryThinking(false)
      setStoryText((t) => t + delta)
    })
    stream
      .finalMessage()
      .then(() => {
        setStoryDone(true)
        setStoryThinking(false)
      })
      .catch((err) => {
        setStoryError(err.message || String(err))
        setStoryThinking(false)
      })
  }

  const stopStream = () => {
    try {
      streamRef.current?.abort()
    } catch {
      // already finished
    }
    streamRef.current = null
  }

  const backToReview = () => {
    stopStream()
    setPhase('review')
  }

  const restart = () => {
    stopStream()
    setSelections({})
    setIdeasByStep({})
    setStepIndex(0)
    setStoryText('')
    setStoryDone(false)
    setStoryError(null)
    setPhase('wizard')
  }

  const saveKey = (key) => {
    localStorage.setItem(KEY_STORAGE, key)
    setApiKey(key)
    setIdeasByStep({})
    setPhase('wizard')
  }

  const changeKey = () => {
    stopStream()
    localStorage.removeItem(KEY_STORAGE)
    setApiKey('')
    setPhase('key')
  }

  if (phase === 'key') {
    return (
      <KeyGate onSubmit={saveKey} onDemo={() => setPhase('wizard')} />
    )
  }

  const ideasEntry = ideasByStep[step?.id]

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand small" onClick={restart} type="button">
          Story<span>Time</span>
        </button>
        <button className="btn ghost tiny" onClick={changeKey} type="button">
          {apiKey ? 'Change API key' : 'Add API key'}
        </button>
      </header>

      <main>
        {phase === 'wizard' && (
          <Wizard
            step={step}
            stepIndex={stepIndex}
            totalSteps={STEPS.length}
            ideas={ideasEntry?.options || []}
            loading={loading && !ideasEntry}
            error={ideasEntry?.error}
            demoMode={!client}
            selected={selections[step.id] || []}
            onToggle={toggleOption}
            onAddCustom={addCustom}
            onRegenerate={() => fetchIdeas(step, { force: true })}
            onNext={goNext}
            onBack={() => setStepIndex(stepIndex - 1)}
            onSkip={skipStep}
          />
        )}

        {phase === 'review' && (
          <Review
            steps={STEPS}
            selections={selections}
            length={length}
            onLength={setLength}
            onEdit={(i) => {
              setStepIndex(i)
              setPhase('wizard')
            }}
            onWrite={writeStory}
            canWrite={Boolean(client)}
          />
        )}

        {phase === 'story' && (
          <Story
            text={storyText}
            thinking={storyThinking}
            error={storyError}
            done={storyDone}
            onBack={backToReview}
            onRestart={restart}
          />
        )}
      </main>
    </div>
  )
}
