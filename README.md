# Oasis TTS — self-hosted narration, voice cloning & audiobooks

A local ElevenLabs-style app: React frontend + Python (FastAPI) backend running two
open-source TTS engines on your own GPUs. No API fees.

| Engine | License | What it's for |
|---|---|---|
| **Chatterbox** (Resemble AI) | MIT | Voice cloning from a 5–20 s clip; most natural output |
| **Kokoro-82M** | Apache 2.0 | Fast narration with 13 built-in voices; tiny VRAM footprint |

## Features

- **Narrate** — type/paste text, pick an engine and voice, play or download the result.
- **Audiobook** — paste a whole book (or load a `.txt`), it's chunked by sentence,
  rendered in the background with live progress/ETA, stitched with natural pauses,
  loudness-normalized, and exported (MP3 if `ffmpeg` is installed, else WAV).
- **Voices** — upload a short clip of clean speech to clone a voice for Chatterbox.
- **VRAM management** — models load on first use and are **automatically evicted from
  VRAM after 5 minutes idle** (configurable). The footer shows live per-GPU memory and
  has a "free VRAM" button for instant manual unload.

## Dual-GPU layout

At startup the server auto-detects GPUs and puts **Chatterbox on the largest card**
(your 5060 Ti 16 GB) and **Kokoro on the second card** (your 3080 10 GB), so the two
engines never compete for memory. Override with env vars if you want:

```
CHATTERBOX_DEVICE=cuda:0   KOKORO_DEVICE=cuda:1
```

## Setup (Windows)

Prereqs: [Python 3.11](https://www.python.org/downloads/), [Node.js 20+](https://nodejs.org/),
NVIDIA driver 570+ (the 5060 Ti needs a CUDA 12.8-capable driver).
Optional but recommended: `ffmpeg` on PATH (`winget install ffmpeg`) for MP3 output,
and `espeak-ng` (`winget install espeak-ng`) as Kokoro's fallback pronouncer.

```powershell
# 1. Backend (one time) — installs the CUDA 12.8 PyTorch build the 5060 Ti requires
cd server
.\setup-windows.ps1

# 2. Frontend (one time)
cd ..
npm install
```

## Run

```powershell
# Terminal 1 — backend
cd server
.\start-server.ps1        # serves http://127.0.0.1:8000

# Terminal 2 — frontend
npm run dev               # open http://localhost:5173
```

First generation per engine takes extra time while the model loads (and, on the very
first run ever, downloads weights from Hugging Face — a few GB for Chatterbox).

## Configuration (env vars)

| Variable | Default | Meaning |
|---|---|---|
| `TTS_IDLE_UNLOAD_SEC` | `300` | Seconds idle before a model is evicted from VRAM |
| `CHATTERBOX_DEVICE` | biggest GPU | Device for Chatterbox |
| `KOKORO_DEVICE` | second GPU | Device for Kokoro |
| `TTS_CHUNK_CHARS` | `350` | Max characters per generation chunk |
| `TTS_PORT` | `8000` | Backend port |

## Notes

- Voice cloning: only clone voices you own or have permission to use.
- Chatterbox's `exaggeration` / `cfg_weight` knobs are exposed in the API
  (`POST /api/tts`) if you want to tune emotion; defaults are sensible.
- A 10-hour audiobook renders roughly overnight on the 5060 Ti with Chatterbox,
  or much faster than real time with Kokoro.
- Rendered audiobooks land in `server/data/output/`; cloned voice clips in
  `server/data/voices/`.
