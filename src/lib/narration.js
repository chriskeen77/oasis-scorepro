// Narration: read the story aloud with the browser's speech voices, and
// render a downloadable WAV with the bundled offline narrator (espeak via
// mespeak — browsers can't capture their native voices as audio, so the
// saved file uses this consistent built-in voice instead).

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function listVoices() {
  const all = window.speechSynthesis.getVoices()
  const english = all.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  return english.length > 0 ? english : all
}

// speechSynthesis silently truncates long utterances in several browsers, so
// split the story into sentence-sized chunks and queue them.
export function chunkText(text, maxLen = 220) {
  const flat = text.replace(/\s+/g, ' ').trim()
  const sentences = flat.match(/[^.!?…]+[.!?…]+[”"']?\s*|[^.!?…]+$/g) || [flat]
  const chunks = []
  let current = ''
  for (const sentence of sentences) {
    if (current && (current + sentence).length > maxLen) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export function speakStory(text, { voice, onProgress, onEnd, onError }) {
  const synth = window.speechSynthesis
  synth.cancel()
  const chunks = chunkText(text)
  let index = 0
  let cancelled = false

  const speakNext = () => {
    if (cancelled) return
    if (index >= chunks.length) {
      onEnd?.()
      return
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index])
    if (voice) utterance.voice = voice
    utterance.rate = 0.95
    utterance.onend = () => {
      index += 1
      onProgress?.(index / chunks.length)
      speakNext()
    }
    utterance.onerror = (e) => {
      // cancel()/interrupt fire an error event too — those aren't failures
      if (e.error === 'canceled' || e.error === 'interrupted') return
      onError?.(e.error || 'speech failed')
    }
    synth.speak(utterance)
  }

  speakNext()

  return {
    cancel: () => {
      cancelled = true
      synth.cancel()
    },
    pause: () => synth.pause(),
    resume: () => synth.resume(),
  }
}

let meSpeakPromise = null

async function loadMeSpeak() {
  if (!meSpeakPromise) {
    meSpeakPromise = Promise.all([
      import('../vendor/mespeak/index.js'),
      import('../vendor/mespeak/mespeak_config.json'),
      import('../vendor/mespeak/en-us.json'),
    ]).then(([mod, config, voice]) => {
      const meSpeak = mod.default ?? mod
      meSpeak.loadConfig(config.default ?? config)
      meSpeak.loadVoice(voice.default ?? voice)
      return meSpeak
    })
    meSpeakPromise.catch(() => {
      meSpeakPromise = null
    })
  }
  return meSpeakPromise
}

export async function synthesizeWav(text) {
  const meSpeak = await loadMeSpeak()
  // Give React a frame to paint the "rendering" state — speak() is synchronous
  await new Promise((resolve) => setTimeout(resolve, 30))
  const buffer = meSpeak.speak(text, {
    rawdata: 'arraybuffer',
    speed: 160,
    pitch: 45,
    wordgap: 2,
  })
  if (!buffer) throw new Error('WAV synthesis produced no audio')
  return new Blob([buffer], { type: 'audio/wav' })
}

export function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'storytime'
  )
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
