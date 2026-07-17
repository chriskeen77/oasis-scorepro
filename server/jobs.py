"""Background audiobook rendering jobs.

One worker thread renders jobs sequentially (a single GPU pipeline saturates
itself; parallel jobs would just thrash VRAM). Progress is tracked per chunk
so the UI can show a live percentage and ETA.
"""
import logging
import queue
import re
import subprocess
import threading
import time
import uuid

import numpy as np
import soundfile as sf

import config
import engines
from text_chunker import chunk_text

log = logging.getLogger("tts.jobs")

SENTENCE_PAUSE_SEC = 0.35
PARAGRAPH_PAUSE_SEC = 0.8


def _silence(seconds):
    return np.zeros(int(config.SAMPLE_RATE * seconds), dtype=np.float32)


class Job:
    def __init__(self, title, engine, text, voice, speed, exaggeration, cfg_weight):
        self.id = uuid.uuid4().hex[:12]
        self.title = title or "untitled"
        self.engine = engine
        self.text = text
        self.voice = voice
        self.speed = speed
        self.exaggeration = exaggeration
        self.cfg_weight = cfg_weight
        self.status = "queued"  # queued | running | done | error | cancelled
        self.error = None
        self.created_at = time.time()
        self.started_at = None
        self.finished_at = None
        self.total_chunks = 0
        self.done_chunks = 0
        self.output_path = None
        self.cancel_requested = False

    def to_dict(self):
        elapsed = None
        eta = None
        if self.started_at:
            end = self.finished_at or time.time()
            elapsed = round(end - self.started_at, 1)
            if self.done_chunks and self.status == "running":
                per_chunk = elapsed / self.done_chunks
                eta = round(per_chunk * (self.total_chunks - self.done_chunks), 1)
        return {
            "id": self.id,
            "title": self.title,
            "engine": self.engine,
            "voice": self.voice,
            "status": self.status,
            "error": self.error,
            "total_chunks": self.total_chunks,
            "done_chunks": self.done_chunks,
            "elapsed_sec": elapsed,
            "eta_sec": eta,
            "created_at": self.created_at,
            "output_file": self.output_path.name if self.output_path else None,
        }


class JobRunner:
    def __init__(self):
        self.jobs = {}
        self._queue = queue.Queue()
        self._worker = threading.Thread(target=self._run, daemon=True)
        self._worker.start()

    def submit(self, **kwargs):
        job = Job(**kwargs)
        self.jobs[job.id] = job
        self._queue.put(job)
        return job

    def cancel(self, job_id):
        job = self.jobs.get(job_id)
        if not job:
            return False
        job.cancel_requested = True
        if job.status == "queued":
            job.status = "cancelled"
        return True

    def _run(self):
        while True:
            job = self._queue.get()
            if job.status == "cancelled":
                continue
            try:
                self._render(job)
            except Exception as e:  # noqa: BLE001
                job.status = "error"
                job.error = str(e)
                job.finished_at = time.time()
                log.exception("job %s failed", job.id)

    def _render(self, job):
        job.status = "running"
        job.started_at = time.time()
        chunks = chunk_text(job.text, config.CHUNK_CHAR_TARGET)
        job.total_chunks = len(chunks)
        if not chunks:
            raise ValueError("no renderable text found")

        pieces = []
        for text, is_para_end in chunks:
            if job.cancel_requested:
                job.status = "cancelled"
                job.finished_at = time.time()
                return
            audio = engines.generate_chunk(
                job.engine, text, voice=job.voice, speed=job.speed,
                exaggeration=job.exaggeration, cfg_weight=job.cfg_weight,
            )
            pieces.append(audio)
            pieces.append(_silence(PARAGRAPH_PAUSE_SEC if is_para_end else SENTENCE_PAUSE_SEC))
            job.done_chunks += 1

        full = np.concatenate(pieces)
        peak = float(np.abs(full).max(initial=0.0))
        if peak > 0:
            full = full * min(1.0, 0.95 / peak)

        safe_title = re.sub(r"[^\w\-]+", "_", job.title).strip("_") or "audiobook"
        wav_path = config.OUTPUT_DIR / f"{safe_title}_{job.id}.wav"
        sf.write(wav_path, full, config.SAMPLE_RATE)
        job.output_path = wav_path

        # Compress to MP3 when ffmpeg is available (a WAV audiobook is huge).
        mp3_path = wav_path.with_suffix(".mp3")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "96k", str(mp3_path)],
                check=True, capture_output=True, timeout=3600,
            )
            wav_path.unlink()
            job.output_path = mp3_path
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            log.info("ffmpeg unavailable or failed; keeping WAV output")

        job.status = "done"
        job.finished_at = time.time()


runner = JobRunner()
