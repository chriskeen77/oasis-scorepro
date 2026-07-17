"""Generation wrappers around the two TTS engines.

Both return mono float32 numpy audio at config.SAMPLE_RATE.
"""
import logging

import numpy as np

import config
from model_manager import manager

log = logging.getLogger("tts.engines")

KOKORO_VOICES = [
    "af_heart", "af_bella", "af_nicole", "af_sarah", "af_sky",
    "am_adam", "am_michael", "am_fenrir", "am_puck",
    "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
]

MAX_RETRIES = 2


def _to_numpy(wav):
    try:
        import torch
        if isinstance(wav, torch.Tensor):
            wav = wav.detach().cpu().float().numpy()
    except ImportError:
        pass
    wav = np.asarray(wav, dtype=np.float32)
    if wav.ndim > 1:
        wav = wav.squeeze()
    return wav


def _looks_glitched(audio, text):
    """Heuristic for runaway/failed generations on a chunk.

    Long-form TTS occasionally produces a chunk that babbles far past the
    text length or comes back near-silent; both are worth one retry.
    """
    duration = len(audio) / config.SAMPLE_RATE
    expected_max = max(3.0, len(text) * 0.14)  # ~14 chars/sec is very slow speech
    if duration > expected_max:
        return f"duration {duration:.1f}s exceeds expected max {expected_max:.1f}s"
    if duration > 0.5 and float(np.abs(audio).max(initial=0.0)) < 1e-3:
        return "output is near-silent"
    return None


def generate_chunk(engine, text, voice=None, speed=1.0, exaggeration=0.5, cfg_weight=0.5):
    last_err = None
    for attempt in range(1 + MAX_RETRIES):
        try:
            if engine == "chatterbox":
                audio = _chatterbox(text, voice, exaggeration, cfg_weight)
            elif engine == "kokoro":
                audio = _kokoro(text, voice or "af_heart", speed)
            else:
                raise ValueError(f"unknown engine: {engine}")
            problem = _looks_glitched(audio, text)
            if problem and attempt < MAX_RETRIES:
                log.warning("retrying chunk (%s): %r", problem, text[:60])
                continue
            return audio
        except Exception as e:  # noqa: BLE001 - retry then surface
            last_err = e
            log.warning("chunk generation failed (attempt %d): %s", attempt + 1, e)
    raise RuntimeError(f"generation failed after {MAX_RETRIES + 1} attempts: {last_err}")


def _chatterbox(text, voice_path, exaggeration, cfg_weight):
    model = manager.models["chatterbox"].get()
    kwargs = {"exaggeration": exaggeration, "cfg_weight": cfg_weight}
    if voice_path:
        kwargs["audio_prompt_path"] = str(voice_path)
    wav = model.generate(text, **kwargs)
    audio = _to_numpy(wav)
    if getattr(model, "sr", config.SAMPLE_RATE) != config.SAMPLE_RATE:
        audio = _resample(audio, model.sr, config.SAMPLE_RATE)
    manager.models["chatterbox"].touch()
    return audio


def _kokoro(text, voice, speed):
    pipeline = manager.models["kokoro"].get()
    segments = [_to_numpy(a) for _, _, a in pipeline(text, voice=voice, speed=speed)]
    manager.models["kokoro"].touch()
    if not segments:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(segments)


def _resample(audio, sr_from, sr_to):
    if sr_from == sr_to:
        return audio
    n_out = int(round(len(audio) * sr_to / sr_from))
    x_old = np.linspace(0.0, 1.0, num=len(audio), endpoint=False)
    x_new = np.linspace(0.0, 1.0, num=n_out, endpoint=False)
    return np.interp(x_new, x_old, audio).astype(np.float32)
