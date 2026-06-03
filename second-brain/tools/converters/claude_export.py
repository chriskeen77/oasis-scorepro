"""Convert a Claude data export into vault notes (one per conversation).

Get the export: Claude → Settings → Privacy → **Export data**. You'll receive an
email with a zip; inside is `conversations.json`. Point this at it.

    python converters/claude_export.py path/to/conversations.json --out /vault/00-Inbox

Each conversation becomes a markdown note with the full transcript, a
`source_url` back to the chat, and `#src/claude`.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest_common import derive_title, is_trivial, out_dir_from_args, write_note  # noqa: E402


def _msg_text(m: dict) -> str:
    if m.get("text"):
        return m["text"]
    # Newer exports use a content array of typed blocks.
    parts = [b.get("text", "") for b in m.get("content", []) if b.get("type") == "text"]
    return "\n".join(p for p in parts if p)


def _transcript(conv: dict) -> str:
    lines = []
    for m in conv.get("chat_messages", conv.get("messages", [])):
        sender = (m.get("sender") or m.get("role") or "").lower()
        who = "You" if sender in ("human", "user") else "Claude"
        text = _msg_text(m).strip()
        if text:
            lines.append(f"**{who}:**\n\n{text}\n")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Claude export -> vault notes.")
    ap.add_argument("conversations_json")
    ap.add_argument("--out")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--min-chars", type=int, default=120)
    args = ap.parse_args()

    data = json.loads(Path(args.conversations_json).read_text(encoding="utf-8"))
    convs = data if isinstance(data, list) else data.get("conversations", [])
    out = out_dir_from_args(args.out)
    seen: set = set()
    written = skipped = 0

    for conv in convs:
        body = _transcript(conv)
        if not body or is_trivial(body, args.min_chars):
            skipped += 1
            continue
        uuid = conv.get("uuid") or conv.get("id") or ""
        title = conv.get("name") or derive_title(body, "Claude conversation")
        created = (conv.get("created_at") or "")[:10]
        fm = {
            "title": title, "type": "source", "source": "claude",
            "source_url": f"https://claude.ai/chat/{uuid}" if uuid else "",
            "created": created or None,
            "tags": ["type/source", "src/claude", "status/inbox"], "related": [],
        }
        if write_note(out, fm, body, dry=args.dry_run, seen=seen):
            written += 1
        else:
            skipped += 1

    print(f"[claude] {written} written, {skipped} skipped (trivial/dup) -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
