"""Scrape Google Keep notes into the vault inbox as markdown.

Google Keep has no official API for consumer (@gmail.com) accounts, so this uses
the community ``gkeepapi`` library, which talks to the same endpoint the Keep web
app uses. You authenticate once with a *master token* and store it as a secret.

Getting a master token (one time):
    1. pip install gpsoauth gkeepapi
    2. Create an *app password* or use the gpsoauth flow described in the gkeepapi
       README to exchange your Google login for a master token (starts with
       "aas_et/"). Recent Google changes can make this fiddly; the gkeepapi repo
       documents the current working method.
    3. Store it as the KEEP_MASTER_TOKEN secret (and KEEP_EMAIL).

This module is import-safe: if gkeepapi is missing or no token is set, it logs and
returns an empty list instead of crashing the nightly job.
"""
from __future__ import annotations

import datetime as dt
import os
import re

from frontmatter_util import build_note


def _slug_title(text: str) -> str:
    """Derive a human title from a Keep note body (never 'Untitled')."""
    first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    first = re.sub(r"^#+\s*", "", first)
    title = first[:80].rstrip(" -:") or "Keep note"
    # Strip characters that are awkward in filenames / wikilinks.
    return re.sub(r'[\\/:*?"<>|#\[\]]', "", title).strip() or "Keep note"


def scrape_since(days: int = 1) -> list[dict]:
    """Return new Keep notes (edited within ``days``) as note dicts.

    Each dict: {name, folder, text, dedupe_key}.
    """
    email = os.environ.get("KEEP_EMAIL")
    token = os.environ.get("KEEP_MASTER_TOKEN")
    if not (email and token):
        print("[keep] KEEP_EMAIL / KEEP_MASTER_TOKEN not set - skipping Keep scrape.")
        return []
    try:
        import gkeepapi  # type: ignore
    except ImportError:
        print("[keep] gkeepapi not installed - skipping Keep scrape.")
        return []

    keep = gkeepapi.Keep()
    keep.authenticate(email, token)
    keep.sync()

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    notes: list[dict] = []
    for n in keep.all():
        if n.trashed or n.archived:
            continue
        edited = n.timestamps.edited
        if edited and edited.replace(tzinfo=dt.timezone.utc) < cutoff:
            continue
        body = (n.title + "\n\n" if n.title else "") + (n.text or "")
        if not body.strip():
            continue
        title = n.title.strip() if n.title else _slug_title(body)
        labels = [f"src/keep"] + [f"keep/{l.name.lower().replace(' ', '-')}"
                                  for l in n.labels.all()]
        fm = {
            "title": title,
            "type": "note",
            "source": "keep",
            "source_url": f"https://keep.google.com/#NOTE/{n.id}",
            "keep_id": n.id,
            "created": (edited or dt.datetime.utcnow()).date().isoformat(),
            "tags": labels + ["status/inbox"],
            "related": [],
        }
        notes.append({
            "name": f"{title}.md",
            "folder": "inbox",
            "text": build_note(fm, body),
            "dedupe_key": f"keep:{n.id}",
        })
    print(f"[keep] {len(notes)} new/updated Keep notes found.")
    return notes
