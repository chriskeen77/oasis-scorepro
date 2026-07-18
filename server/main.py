"""FastAPI server: local ElevenLabs-style TTS with VRAM-managed models.

Run:  uvicorn main:app --host 127.0.0.1 --port 8000
"""
import io
import logging
import re
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

import config
import engines
from epub import parse_epub, split_plain_text_chapters
from jobs import ffmpeg_available, runner
from model_manager import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="Oasis TTS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

_NAME_RE = re.compile(r"^[\w\- ]{1,64}$")


def _voice_path(name):
    path = (config.VOICES_DIR / f"{name}.wav").resolve()
    if config.VOICES_DIR.resolve() not in path.parents:
        raise HTTPException(400, "invalid voice name")
    return path


class TTSRequest(BaseModel):
    engine: str = Field(pattern="^(chatterbox|kokoro)$")
    text: str = Field(min_length=1, max_length=5000)
    voice: str | None = None  # cloned-voice name (chatterbox) or kokoro voice id
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    exaggeration: float = Field(default=0.5, ge=0.0, le=1.0)
    cfg_weight: float = Field(default=0.5, ge=0.0, le=1.0)


class Chapter(BaseModel):
    title: str = Field(default="", max_length=200)
    text: str = Field(min_length=1, max_length=2_000_000)


class AudiobookRequest(TTSRequest):
    # Either raw `text` (auto-split on "Chapter N" headings) or explicit
    # `chapters` (from the EPUB parser, possibly filtered in the UI).
    text: str = Field(default="", max_length=2_000_000)
    chapters: list[Chapter] | None = None
    title: str = Field(default="untitled", max_length=120)


@app.get("/api/health")
def health():
    return {"ok": True, "ffmpeg": ffmpeg_available()}


@app.get("/api/models/status")
def models_status():
    return manager.status()


@app.post("/api/models/{name}/unload")
def unload_model(name: str):
    model = manager.models.get(name)
    if not model:
        raise HTTPException(404, "unknown model")
    return {"unloaded": model.unload()}


@app.get("/api/voices")
def list_voices():
    cloned = sorted(p.stem for p in config.VOICES_DIR.glob("*.wav"))
    return {"cloned": cloned, "kokoro": engines.KOKORO_VOICES}


@app.post("/api/voices")
async def upload_voice(name: str = Form(...), file: UploadFile = File(...)):
    if not _NAME_RE.match(name):
        raise HTTPException(400, "voice name must be 1-64 word characters")
    raw = await file.read()
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(400, "reference clip too large (50 MB max)")
    try:
        data, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    except Exception:  # noqa: BLE001 - fall through to ffmpeg for webm/mp3/m4a
        data, sr = _ffmpeg_decode(raw)
    mono = data.mean(axis=1)
    duration = len(mono) / sr
    if duration < 3:
        raise HTTPException(400, f"clip is {duration:.1f}s; give at least ~5s of clean speech")
    sf.write(_voice_path(name), mono, sr)
    return {"name": name, "duration_sec": round(duration, 1)}


def _ffmpeg_decode(raw: bytes):
    """Decode formats libsndfile can't (webm/opus mic recordings, mp3, m4a)."""
    if not ffmpeg_available():
        raise HTTPException(
            400,
            "could not decode audio; upload WAV/FLAC/OGG, or install ffmpeg "
            "to enable webm/mp3/m4a (including in-browser recordings)",
        )
    src = tempfile.NamedTemporaryFile(suffix=".bin", delete=False)
    dst_path = Path(src.name).with_suffix(".wav")
    try:
        src.write(raw)
        src.close()
        subprocess.run(
            ["ffmpeg", "-y", "-i", src.name, "-ac", "1", "-ar", str(config.SAMPLE_RATE), str(dst_path)],
            check=True, capture_output=True, timeout=120,
        )
        return sf.read(dst_path, dtype="float32", always_2d=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        raise HTTPException(400, "ffmpeg could not decode the uploaded audio") from e
    finally:
        Path(src.name).unlink(missing_ok=True)
        dst_path.unlink(missing_ok=True)


@app.delete("/api/voices/{name}")
def delete_voice(name: str):
    path = _voice_path(name)
    if not path.exists():
        raise HTTPException(404, "no such voice")
    path.unlink()
    return {"deleted": name}


def _resolve_voice(req: TTSRequest):
    if req.engine == "chatterbox":
        if not req.voice:
            return None  # Chatterbox's built-in default voice
        path = _voice_path(req.voice)
        if not path.exists():
            raise HTTPException(404, f"no cloned voice named {req.voice!r}")
        return path
    if req.voice and req.voice not in engines.KOKORO_VOICES:
        raise HTTPException(404, f"unknown kokoro voice {req.voice!r}")
    return req.voice


@app.post("/api/tts")
def tts(req: TTSRequest):
    voice = _resolve_voice(req)
    audio = engines.generate_chunk(
        req.engine, req.text, voice=voice, speed=req.speed,
        exaggeration=req.exaggeration, cfg_weight=req.cfg_weight,
    )
    buf = io.BytesIO()
    sf.write(buf, audio, config.SAMPLE_RATE, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


@app.post("/api/epub")
async def upload_epub(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > 100 * 1024 * 1024:
        raise HTTPException(400, "EPUB too large (100 MB max)")
    try:
        book = parse_epub(raw)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"could not parse EPUB: {e}") from e
    return book


@app.post("/api/audiobook")
def audiobook(req: AudiobookRequest):
    voice = _resolve_voice(req)
    if req.chapters:
        chapters = [c.model_dump() for c in req.chapters]
    elif req.text.strip():
        chapters = split_plain_text_chapters(req.text)
    else:
        raise HTTPException(400, "provide either text or chapters")
    if sum(len(c["text"]) for c in chapters) > 2_000_000:
        raise HTTPException(400, "book exceeds 2,000,000 characters")
    job = runner.submit(
        title=req.title, engine=req.engine, chapters=chapters, voice=voice,
        speed=req.speed, exaggeration=req.exaggeration, cfg_weight=req.cfg_weight,
    )
    return {"job_id": job.id}


@app.get("/api/jobs")
def list_jobs():
    jobs = sorted(runner.jobs.values(), key=lambda j: -j.created_at)
    return {"jobs": [j.to_dict() for j in jobs]}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = runner.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "no such job")
    return job.to_dict()


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    if not runner.cancel(job_id):
        raise HTTPException(404, "no such job")
    return {"cancelled": True}


@app.get("/api/jobs/{job_id}/download")
def download_job(job_id: str):
    job = runner.jobs.get(job_id)
    if not job or not job.output_path or not job.output_path.exists():
        raise HTTPException(404, "output not available")
    media = "audio/mpeg" if job.output_path.suffix == ".mp3" else "audio/wav"
    return FileResponse(job.output_path, media_type=media, filename=job.output_path.name)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
