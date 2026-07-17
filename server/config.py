"""Runtime configuration for the TTS server.

Everything is overridable via environment variables so you can tune
device placement and VRAM behavior without touching code.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("TTS_DATA_DIR", BASE_DIR / "data"))
VOICES_DIR = DATA_DIR / "voices"
OUTPUT_DIR = DATA_DIR / "output"

for d in (VOICES_DIR, OUTPUT_DIR):
    d.mkdir(parents=True, exist_ok=True)


def _detect_default_devices():
    """Chatterbox gets the biggest GPU; Kokoro gets the other one if present.

    With a 5060 Ti (16 GB) + 3080 (10 GB), Chatterbox lands on the 16 GB card
    and Kokoro (tiny) on the 3080, so neither competes for VRAM.
    """
    try:
        import torch
        if not torch.cuda.is_available():
            return "cpu", "cpu"
        count = torch.cuda.device_count()
        if count == 1:
            return "cuda:0", "cuda:0"
        sizes = [(i, torch.cuda.get_device_properties(i).total_memory) for i in range(count)]
        sizes.sort(key=lambda x: -x[1])
        big, small = sizes[0][0], sizes[1][0]
        return f"cuda:{big}", f"cuda:{small}"
    except Exception:
        return "cpu", "cpu"


_default_chatterbox, _default_kokoro = _detect_default_devices()

CHATTERBOX_DEVICE = os.environ.get("CHATTERBOX_DEVICE", _default_chatterbox)
KOKORO_DEVICE = os.environ.get("KOKORO_DEVICE", _default_kokoro)

# Seconds a model may sit unused before being evicted from VRAM.
IDLE_UNLOAD_SEC = int(os.environ.get("TTS_IDLE_UNLOAD_SEC", "300"))

# Max characters per generation chunk. Chatterbox degrades on long inputs;
# short sentence-grouped chunks keep quality consistent.
CHUNK_CHAR_TARGET = int(os.environ.get("TTS_CHUNK_CHARS", "350"))

SAMPLE_RATE = 24000  # both Chatterbox and Kokoro emit 24 kHz audio

HOST = os.environ.get("TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("TTS_PORT", "8000"))
