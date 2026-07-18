"""Background audiobook rendering jobs.

One worker thread renders jobs sequentially (a single GPU pipeline saturates
itself; parallel jobs would just thrash VRAM). Progress is tracked per chunk
so the UI can show a live percentage and ETA.

Output formats, best first: M4B with chapter markers (needs ffmpeg),
MP3 (needs ffmpeg, used for single-chapter jobs), WAV fallback.
"""
import logging
import queue
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path

import numpy as np
import soundfile as sf

import config
import engines
from text_chunker import chunk_text

log = logging.getLogger("tts.jobs")

SENTENCE_PAUSE_SEC = 0.35
PARAGRAPH_PAUSE_SEC = 0.8
CHAPTER_PAUSE_SEC = 1.5


def _silence(seconds):
    return np.zeros(int(config.SAMPLE_RATE * seconds), dtype=np.float32)


def ffmpeg_available():
    return shutil.which("ffmpeg") is not None


class Job:
    def __init__(self, title, engine, chapters, voice, speed, exaggeration, cfg_weight):
        self.id = uuid.uuid4().hex[:12]
        self.title = title or "untitled"
        self.engine = engine
        self.chapters = chapters  # [{"title": str, "text": str}]
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
        self.current_chapter = None
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
            "chapter_count": len(self.chapters),
            "current_chapter": self.current_chapter,
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

        chapter_chunks = []  # [(chapter_title, [(text, is_para_end), ...])]
        for ch in job.chapters:
            chunks = chunk_text(ch["text"], config.CHUNK_CHAR_TARGET)
            if chunks:
                chapter_chunks.append((ch["title"], chunks))
        job.total_chunks = sum(len(c) for _, c in chapter_chunks)
        if not job.total_chunks:
            raise ValueError("no renderable text found")

        pieces = []
        samples_so_far = 0
        chapter_marks = []  # (title, start_sample)
        for idx, (ch_title, chunks) in enumerate(chapter_chunks):
            job.current_chapter = ch_title or f"Chapter {idx + 1}"
            chapter_marks.append((job.current_chapter, samples_so_far))
            for text, is_para_end in chunks:
                if job.cancel_requested:
                    job.status = "cancelled"
                    job.finished_at = time.time()
                    return
                audio = engines.generate_chunk(
                    job.engine, text, voice=job.voice, speed=job.speed,
                    exaggeration=job.exaggeration, cfg_weight=job.cfg_weight,
                )
                pause = _silence(PARAGRAPH_PAUSE_SEC if is_para_end else SENTENCE_PAUSE_SEC)
                pieces.extend((audio, pause))
                samples_so_far += len(audio) + len(pause)
                job.done_chunks += 1
            gap = _silence(CHAPTER_PAUSE_SEC)
            pieces.append(gap)
            samples_so_far += len(gap)

        full = np.concatenate(pieces)
        peak = float(np.abs(full).max(initial=0.0))
        if peak > 0:
            full = full * min(1.0, 0.95 / peak)

        safe_title = re.sub(r"[^\w\-]+", "_", job.title).strip("_") or "audiobook"
        wav_path = config.OUTPUT_DIR / f"{safe_title}_{job.id}.wav"
        sf.write(wav_path, full, config.SAMPLE_RATE)
        job.output_path = wav_path

        if ffmpeg_available():
            try:
                if len(chapter_marks) > 1:
                    out = self._encode_m4b(job, wav_path, chapter_marks, len(full))
                else:
                    out = self._encode_mp3(wav_path)
                wav_path.unlink()
                job.output_path = out
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                log.warning("ffmpeg encode failed (%s); keeping WAV output", e)

        job.status = "done"
        job.finished_at = time.time()

    @staticmethod
    def _encode_mp3(wav_path):
        mp3_path = wav_path.with_suffix(".mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "96k", str(mp3_path)],
            check=True, capture_output=True, timeout=3600,
        )
        return mp3_path

    @staticmethod
    def _encode_m4b(job, wav_path, chapter_marks, total_samples):
        def esc(value):
            return re.sub(r"([=;#\\\n])", r"\\\1", value)

        lines = [";FFMETADATA1", f"title={esc(job.title)}"]
        for i, (title, start) in enumerate(chapter_marks):
            end = chapter_marks[i + 1][1] if i + 1 < len(chapter_marks) else total_samples
            lines += [
                "[CHAPTER]",
                "TIMEBASE=1/1000",
                f"START={int(start * 1000 / config.SAMPLE_RATE)}",
                f"END={int(end * 1000 / config.SAMPLE_RATE)}",
                f"title={esc(title)}",
            ]
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as meta:
            meta.write("\n".join(lines) + "\n")
            meta_path = Path(meta.name)
        m4b_path = wav_path.with_suffix(".m4b")
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", str(wav_path), "-i", str(meta_path),
                    "-map", "0:a", "-map_metadata", "1",
                    "-c:a", "aac", "-b:a", "64k", "-f", "ipod", str(m4b_path),
                ],
                check=True, capture_output=True, timeout=3600,
            )
        finally:
            meta_path.unlink(missing_ok=True)
        return m4b_path


runner = JobRunner()
