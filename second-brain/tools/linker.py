"""Turn a raw inbox capture into a titled, tagged, wikilinked vault note.

Uses the Claude API when ``ANTHROPIC_API_KEY`` is set (smart titles, tags, and
cross-links), and falls back to deterministic rules otherwise so the nightly job
always produces *something* sane and never leaves a note "Untitled".

The model decides metadata only; this module does all file I/O, so the model
never needs Drive access.
"""
from __future__ import annotations

import json
import os

from frontmatter_util import build_note, split_frontmatter

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

# Controlled vocabulary mirrored from _System/Tags.md.
TAG_VOCAB = [
    "type/note", "type/exam", "type/scenario", "type/fiction", "type/project", "type/source",
    "status/processed", "status/needs-review",
    "nursing", "nursing/gerontology", "nursing/pathophysiology", "nursing/vsim", "nursing/neuro",
    "writing", "writing/gridfall", "writing/aegis", "project/liten",
    "src/keep", "src/claude", "src/gemini", "src/perplexity",
]

FILE_NOTE_TOOL = {
    "name": "file_note",
    "description": "Record the processed metadata for one captured note.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Human title, never 'Untitled'."},
            "type": {"type": "string", "enum": [
                "note", "exam", "scenario", "fiction", "project", "source"]},
            "summary": {"type": "string", "description": "One or two sentence summary."},
            "tags": {"type": "array", "items": {"type": "string"},
                     "description": "Tags from the controlled vocabulary (no '#')."},
            "moc": {"type": "string", "description": "Which MOC note to link, e.g. 'Nursing School MOC'."},
            "related": {"type": "array", "items": {"type": "string"},
                        "description": "Titles of existing notes this links to (for [[wikilinks]])."},
            "needs_review": {"type": "boolean"},
        },
        "required": ["title", "type", "summary", "tags", "moc"],
    },
}


def _system_prompt(note_titles: list[str], moc_titles: list[str]) -> list[dict]:
    text = (
        "You are the librarian for a personal Obsidian 'second brain'. For each "
        "captured note you receive, choose a clear TITLE (never 'Untitled'), the "
        "right note TYPE, a short SUMMARY, TAGS from the controlled vocabulary, the "
        "single best MOC to link it under, and any RELATED existing notes to "
        "[[wikilink]]. Prefer reusing existing tags and linking to existing notes.\n\n"
        f"Controlled tags: {', '.join(TAG_VOCAB)}\n\n"
        f"Existing MOCs: {', '.join(moc_titles)}\n\n"
        f"Existing notes:\n- " + "\n- ".join(note_titles)
    )
    # Cache the (large, stable) vault index so repeated calls in one run are cheap.
    return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]


def process(note_text: str, note_titles: list[str], moc_titles: list[str]) -> dict:
    """Return metadata dict for a captured note."""
    fm, body = split_frontmatter(note_text)
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return _process_with_claude(fm, body, note_titles, moc_titles)
        except Exception as e:  # never let the nightly job die on one note
            print(f"[linker] Claude call failed ({e}); using deterministic fallback.")
    return _process_deterministic(fm, body)


def _process_with_claude(fm, body, note_titles, moc_titles) -> dict:
    import anthropic  # type: ignore

    client = anthropic.Anthropic()
    user = (
        f"Existing frontmatter: {json.dumps(fm)}\n\n"
        f"Captured content:\n{body[:6000]}"
    )
    resp = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=_system_prompt(note_titles, moc_titles),
        tools=[FILE_NOTE_TOOL],
        tool_choice={"type": "tool", "name": "file_note"},
        messages=[{"role": "user", "content": user}],
    )
    meta = next(b.input for b in resp.content if b.type == "tool_use")
    meta["body"] = body
    meta["source"] = fm.get("source", "manual")
    meta["source_url"] = fm.get("source_url", "")
    return meta


def _process_deterministic(fm, body) -> dict:
    import re
    title = fm.get("title") or ""
    if not title or title.lower().startswith("untitled"):
        first = next((ln.strip() for ln in body.splitlines() if ln.strip()), "Note")
        title = re.sub(r"^#+\s*", "", first)[:80].rstrip(" -:") or "Note"
    source = fm.get("source", "manual")
    src_tag = {"keep": "src/keep", "claude": "src/claude",
               "gemini": "src/gemini", "perplexity": "src/perplexity"}.get(source)
    tags = [t for t in (fm.get("tags") or []) if not t.startswith("status/")]
    if src_tag and src_tag not in tags:
        tags.append(src_tag)
    tags.append("status/needs-review")  # deterministic = flag for a human glance
    return {
        "title": title, "type": fm.get("type", "note"),
        "summary": "", "tags": tags, "moc": "Sources MOC",
        "related": [], "needs_review": True,
        "body": body, "source": source, "source_url": fm.get("source_url", ""),
    }


def render(meta: dict) -> tuple[str, str]:
    """Build the final note filename + markdown from linker metadata."""
    title = meta["title"]
    related = [f"[[{meta['moc']}]]"] + [f"[[{r}]]" for r in meta.get("related", [])]
    fm = {
        "title": title,
        "type": meta.get("type", "note"),
        "source": meta.get("source", "manual"),
        "source_url": meta.get("source_url", ""),
        "created": meta.get("created", __import__("datetime").date.today().isoformat()),
        "tags": meta.get("tags", []),
        "related": related,
    }
    parts = [f"# {title}", ""]
    if meta.get("summary"):
        parts += [f"> {meta['summary']}", ""]
    parts += [meta.get("body", "").strip(), "", "## Related"]
    parts += [f"- {r}" for r in related]
    safe = __import__("re").sub(r'[\\/:*?"<>|#\[\]]', "", title).strip().rstrip(". ") or "Note"
    return f"{safe}.md", build_note(fm, "\n".join(parts))
