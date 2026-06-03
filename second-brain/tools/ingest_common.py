"""Shared helpers for the backlog converters.

All converters turn an export into titled markdown notes in an output folder
(usually the vault's `00-Inbox/`), reusing the same frontmatter schema as the
nightly job. This module centralizes title derivation, a "skip trivial" filter,
de-duplication, and safe note writing.
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

# Allow importing frontmatter_util from the parent tools/ dir.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from frontmatter_util import build_note  # noqa: E402

INVALID = r'[\\/:*?"<>|#\[\]]'

# Lines that signal a throwaway chat when they're the whole message.
_TRIVIAL_PATTERNS = [
    r"^(hi|hello|hey|thanks?|thank you|ok|okay|yes|no|cool|nice)\b[.! ]*$",
    r"^test\b",
]


def derive_title(body: str, fallback: str = "Note") -> str:
    """A clean human title from the first meaningful line."""
    for line in body.splitlines():
        s = line.strip()
        if not s:
            continue
        s = re.sub(r"^#+\s*", "", s)                       # drop md heading
        s = re.sub(r"^(you|user|human|q|prompt)\s*[:>-]\s*", "", s, flags=re.I)
        s = s.strip(" *_>-")
        if s:
            return s[:80].rstrip(" -:")
    return fallback


def slug(title: str) -> str:
    s = re.sub(INVALID, "", title).strip().rstrip(". ")
    return s or "Note"


def is_trivial(body: str, min_chars: int = 120) -> bool:
    """True for chats too short or too generic to be worth keeping."""
    text = re.sub(r"\s+", " ", body).strip()
    if len(text) < min_chars:
        return True
    first = text.splitlines()[0].strip().lower() if text.splitlines() else text.lower()
    return any(re.match(p, first, re.I) for p in _TRIVIAL_PATTERNS)


def content_hash(body: str) -> str:
    return hashlib.sha1(re.sub(r"\s+", " ", body).strip().lower().encode()).hexdigest()


def write_note(out_dir: Path, fm: dict, body: str, *, dry: bool, seen: set) -> bool:
    """Write one note. Returns True if written, False if skipped (dup)."""
    h = content_hash(body)
    if h in seen:
        return False
    seen.add(h)
    name = f"{slug(fm.get('title') or 'Note')}.md"
    target = out_dir / name
    i = 2
    while target.exists():
        target = out_dir / f"{slug(fm.get('title') or 'Note')} ({i}).md"
        i += 1
    if dry:
        print(f"   would write: {target.name}")
        return True
    out_dir.mkdir(parents=True, exist_ok=True)
    target.write_text(build_note(fm, body), encoding="utf-8")
    return True


def out_dir_from_args(arg: str | None) -> Path:
    """Resolve --out, defaulting to <VAULT_DIR>/00-Inbox if VAULT_DIR is set."""
    import os
    if arg:
        return Path(arg)
    vd = os.environ.get("VAULT_DIR")
    if vd:
        return Path(vd) / "00-Inbox"
    return Path("./_out")
