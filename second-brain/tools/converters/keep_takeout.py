"""Convert a Google Takeout "Keep" export into vault notes (backlog import).

Get the data: takeout.google.com -> select **Keep** -> export. The archive has a
`Takeout/Keep/` folder with one `.json` (and `.html`) per note. Point this at the
Keep folder.

    python converters/keep_takeout.py path/to/Takeout/Keep --out /vault/00-Inbox

Use this for the one-time historical import; `keep_scrape.py` handles ongoing
nightly pulls. Titleless Keep notes get a title derived from their body.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest_common import derive_title, is_trivial, out_dir_from_args, write_note  # noqa: E402


def _note_body(data: dict) -> str:
    if data.get("textContent"):
        return data["textContent"]
    # Checklist notes store items in listContent.
    items = data.get("listContent", [])
    return "\n".join(f"- [{'x' if i.get('isChecked') else ' '}] {i.get('text','')}"
                     for i in items)


def main() -> int:
    ap = argparse.ArgumentParser(description="Keep Takeout -> vault notes.")
    ap.add_argument("keep_dir", help="The Takeout/Keep folder")
    ap.add_argument("--out")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--min-chars", type=int, default=1)
    ap.add_argument("--include-archived", action="store_true")
    args = ap.parse_args()

    out = out_dir_from_args(args.out)
    seen: set = set()
    written = skipped = 0

    for jf in sorted(Path(args.keep_dir).glob("*.json")):
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except Exception:
            continue
        if data.get("isTrashed"):
            continue
        if data.get("isArchived") and not args.include_archived:
            continue
        body = _note_body(data).strip()
        if not body or is_trivial(body, args.min_chars):
            skipped += 1
            continue
        title = (data.get("title") or "").strip() or derive_title(body, "Keep note")
        usec = data.get("userEditedTimestampUsec") or data.get("createdTimestampUsec")
        created = (dt.datetime.utcfromtimestamp(usec / 1_000_000).date().isoformat()
                   if usec else None)
        labels = ["src/keep"] + [f"keep/{l['name'].lower().replace(' ', '-')}"
                                 for l in data.get("labels", []) if l.get("name")]
        fm = {
            "title": title, "type": "note", "source": "keep", "source_url": "",
            "created": created, "tags": labels + ["status/inbox"], "related": [],
        }
        if write_note(out, fm, body, dry=args.dry_run, seen=seen):
            written += 1
        else:
            skipped += 1

    print(f"[keep] {written} written, {skipped} skipped -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
