"""Lazy model loading with idle-based VRAM eviction.

Models are loaded on first use, tracked by last-use timestamp, and a
background reaper thread unloads any model that has been idle longer than
config.IDLE_UNLOAD_SEC (torch CUDA cache is flushed so the VRAM is truly
returned). Models can also be evicted manually via the API.
"""
import gc
import logging
import threading
import time

import config

log = logging.getLogger("tts.models")


class ManagedModel:
    def __init__(self, name, device, loader):
        self.name = name
        self.device = device
        self._loader = loader
        self._model = None
        self.last_used = None
        self.load_time_sec = None
        self.lock = threading.Lock()

    @property
    def loaded(self):
        return self._model is not None

    def get(self):
        """Return the model, loading it into VRAM if necessary."""
        with self.lock:
            if self._model is None:
                log.info("loading %s onto %s ...", self.name, self.device)
                t0 = time.monotonic()
                self._model = self._loader(self.device)
                self.load_time_sec = round(time.monotonic() - t0, 1)
                log.info("%s loaded in %.1fs", self.name, self.load_time_sec)
            self.last_used = time.time()
            return self._model

    def touch(self):
        self.last_used = time.time()

    def unload(self):
        with self.lock:
            if self._model is None:
                return False
            log.info("unloading %s from %s", self.name, self.device)
            self._model = None
            gc.collect()
            if self.device.startswith("cuda"):
                import torch
                with torch.cuda.device(self.device):
                    torch.cuda.empty_cache()
                    torch.cuda.ipc_collect()
            return True


def _load_chatterbox(device):
    from chatterbox.tts import ChatterboxTTS
    return ChatterboxTTS.from_pretrained(device=device)


def _load_kokoro(device):
    from kokoro import KPipeline
    dev = None if device == "cpu" else device
    return KPipeline(lang_code="a", device=dev)


class ModelManager:
    def __init__(self):
        self.models = {
            "chatterbox": ManagedModel("chatterbox", config.CHATTERBOX_DEVICE, _load_chatterbox),
            "kokoro": ManagedModel("kokoro", config.KOKORO_DEVICE, _load_kokoro),
        }
        self._reaper = threading.Thread(target=self._reap_idle, daemon=True)
        self._reaper.start()

    def _reap_idle(self):
        while True:
            time.sleep(15)
            now = time.time()
            for m in self.models.values():
                if m.loaded and m.last_used and now - m.last_used > config.IDLE_UNLOAD_SEC:
                    # Skip if a generation is holding the lock right now.
                    if m.lock.acquire(blocking=False):
                        try:
                            if m.last_used and now - m.last_used > config.IDLE_UNLOAD_SEC:
                                m._model = None
                                gc.collect()
                                if m.device.startswith("cuda"):
                                    import torch
                                    with torch.cuda.device(m.device):
                                        torch.cuda.empty_cache()
                                        torch.cuda.ipc_collect()
                                log.info("idle-evicted %s after %ds", m.name, config.IDLE_UNLOAD_SEC)
                        finally:
                            m.lock.release()

    def status(self):
        devices = []
        try:
            import torch
            if torch.cuda.is_available():
                for i in range(torch.cuda.device_count()):
                    props = torch.cuda.get_device_properties(i)
                    devices.append({
                        "id": f"cuda:{i}",
                        "name": props.name,
                        "total_mb": props.total_memory // (1024 * 1024),
                        "used_mb": torch.cuda.memory_allocated(i) // (1024 * 1024),
                        "reserved_mb": torch.cuda.memory_reserved(i) // (1024 * 1024),
                    })
        except Exception:
            pass
        return {
            "idle_unload_sec": config.IDLE_UNLOAD_SEC,
            "devices": devices,
            "models": [
                {
                    "name": m.name,
                    "device": m.device,
                    "loaded": m.loaded,
                    "last_used": m.last_used,
                    "load_time_sec": m.load_time_sec,
                }
                for m in self.models.values()
            ],
        }


manager = ModelManager()
