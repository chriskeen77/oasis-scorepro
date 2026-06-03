"""Second Brain nightly job: scrape -> title -> tag -> wikilink -> file.

Runs every morning (3am US Central). Steps:
  1. Scrape new Google Keep notes (last N days).
  2. Gather everything sitting in 00-Inbox (e.g. chats saved by the Web Clipper).
  3. For each item, derive a real title, tags, and [[wikilinks]] (Claude if a key
     is present, deterministic otherwise) and write it into Notes/.
  4. Link each new note from the relevant MOC.
  5. Print a report.

Duplicates are skipped by checking existing notes' source_url / keep_id, so the
job is safe to run repeatedly. Use --dry-run to preview without writing.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import sys

import linker
from frontmatter_util import split_frontmatter
from keep_scrape import scrape_since
from vault_backend import get_vault


def _within_central_3am() -> bool:
    """Guard for the cloud cron (which fires at two UTC times to cover DST)."""
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("America/Chicago")).hour == 3
    except Exception:
        return True


def _index(notes) -> tuple[set, list[str]]:
    """Return (set of dedupe keys, list of note titles) from existing Notes."""
    keys, titles = set(), []
    for n in notes:
        fm, _ = split_frontmatter(n.text)
        if fm.get("source_url"):
            keys.add(fm["source_url"])
        if fm.get("keep_id"):
            keys.add(f"keep:{fm['keep_id']}")
        titles.append(n.name[:-3] if n.name.endswith(".md") else n.name)
    return keys, titles


def _link_into_moc(vault, mocs, moc_name: str, note_title: str, dry: bool) -> None:
    target = next((m for m in mocs if m.name[:-3] == moc_name), None)
    if not target:
        print(f"   ! MOC '{moc_name}' not found; left unlinked.")
        return
    link = f"[[{note_title}]]"
    if link in target.text:
        return
    marker = "## Recently added"
    bullet = f"- ✅ {link}"
    if marker in target.text:
        new = target.text.replace(marker, f"{marker}\n{bullet}", 1)
    else:
        new = target.text.rstrip() + f"\n\n{marker}\n{bullet}\n"
    if not dry:
        vault.update(target, new)
        target.text = new


def run(days: int, dry: bool) -> int:
    vault = get_vault()
    existing = vault.list("notes")
    mocs = vault.list("mocs")
    seen, titles = _index(existing)

    # 1 + 2: collect work (Keep scrape + inbox captures)
    work: list[dict] = []
    for kn in scrape_since(days):
        if kn["dedupe_key"] in seen:
            continue
        work.append({"text": kn["text"], "inbox_file": None})
    inbox_files = vault.list("inbox")
    for f in inbox_files:
        if f.name.lower() in {"readme.md"}:
            continue
        fm, _ = split_frontmatter(f.text)
        key = fm.get("source_url") or f"keep:{fm.get('keep_id')}" if fm else None
        if key and key in seen:
            continue
        work.append({"text": f.text, "inbox_file": f})

    if not work:
        print("[nightly] Nothing new to process.")
        return 0

    created = 0
    for item in work:
        meta = linker.process(item["text"], titles, [m.name[:-3] for m in mocs])
        name, content = linker.render(meta)
        note_title = name[:-3]
        print(f" -> {note_title}  [{', '.join(meta.get('tags', []))}]  -> {meta.get('moc')}")
        if not dry:
            vault.create("notes", name, content)
            _link_into_moc(vault, mocs, meta.get("moc", "Sources MOC"), note_title, dry)
            if item["inbox_file"] and not os.environ.get("KEEP_INBOX"):
                try:
                    vault.delete(item["inbox_file"])  # type: ignore[attr-defined]
                except Exception as e:
                    print(f"   ! couldn't clear inbox item: {e}")
        titles.append(note_title)
        created += 1

    print(f"[nightly] {'(dry-run) ' if dry else ''}processed {created} note(s).")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Second Brain nightly librarian.")
    ap.add_argument("--days", type=int, default=int(os.environ.get("KEEP_DAYS", "1")),
                    help="Look back this many days for Keep notes.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--guard-central-3am", action="store_true",
                    help="Exit unless it is ~3am America/Chicago (for the cloud cron).")
    args = ap.parse_args()
    if args.guard_central_3am and not _within_central_3am():
        print("[nightly] Not 3am Central; exiting (guard).")
        return 0
    return run(args.days, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
