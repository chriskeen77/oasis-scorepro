"""Convert Google Takeout "Gemini Apps" activity into vault notes.

Get the data: takeout.google.com -> deselect all -> select **Gemini Apps**
(a.k.a. "My Activity / Gemini") -> export. The archive contains either
`MyActivity.json` or `MyActivity.html`. Point this at whichever you have.

    python converters/gemini_takeout.py path/to/MyActivity.json --out /vault/00-Inbox

Note: Takeout activity reliably contains your **prompts**, timestamps, and links;
full model responses are not always included. Each prompt becomes a note with
`source_url` (the activity link) and `#src/gemini`.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest_common import derive_title, is_trivial, out_dir_from_args, write_note  # noqa: E402


def _from_json(path: Path) -> list[dict]:
    items = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for it in items:
        title = (it.get("title") or "").replace("Prompted ", "").strip()
        body = title
        # Some exports include the response in 'subtitles' or 'details'.
        for sub in it.get("subtitles", []):
            if sub.get("name"):
                body += "\n\n" + sub["name"]
        out.append({"text": body, "url": it.get("titleUrl", ""), "time": it.get("time", "")})
    return out


def _from_html(path: Path) -> list[dict]:
    from bs4 import BeautifulSoup  # type: ignore
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    out = []
    for cell in soup.select(".content-cell"):
        text = cell.get_text("\n", strip=True)
        link = cell.find("a")
        if text:
            out.append({"text": text, "url": link["href"] if link else "", "time": ""})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Gemini Takeout -> vault notes.")
    ap.add_argument("activity_file", help="MyActivity.json or MyActivity.html")
    ap.add_argument("--out")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--min-chars", type=int, default=80)
    args = ap.parse_args()

    path = Path(args.activity_file)
    entries = _from_json(path) if path.suffix == ".json" else _from_html(path)
    out = out_dir_from_args(args.out)
    seen: set = set()
    written = skipped = 0

    for e in entries:
        body = e["text"].strip()
        if not body or is_trivial(body, args.min_chars):
            skipped += 1
            continue
        fm = {
            "title": derive_title(body, "Gemini prompt"), "type": "source",
            "source": "gemini", "source_url": e.get("url", ""),
            "created": (e.get("time") or "")[:10] or None,
            "tags": ["type/source", "src/gemini", "status/inbox"], "related": [],
        }
        if write_note(out, fm, body, dry=args.dry_run, seen=seen):
            written += 1
        else:
            skipped += 1

    print(f"[gemini] {written} written, {skipped} skipped (trivial/dup) -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
