"""Scrape your *past* Perplexity threads into vault notes.

Perplexity has no bulk export, so this drives a real browser with **your** login
(via Playwright) to walk your Library and save each thread as markdown. It runs
locally on your PC — never in the cloud — because it needs your authenticated
session.

One-time setup:
    pip install playwright beautifulsoup4
    playwright install chromium

Usage (first run opens a window so you can log in):
    python converters/perplexity_scrape.py --out /vault/00-Inbox --headful

How it works:
    1. Opens Chromium with a persistent profile (so you stay logged in between runs).
    2. If you're not logged in, log in once in the window, then press Enter here.
    3. It scrolls your Library to load every thread, collects the links, opens each,
       extracts the question + answer text, and writes a note with the thread URL
       and #src/perplexity.

Caveats: Perplexity's HTML changes over time, so the content selectors may need a
tweak (see EXTRACT_SELECTORS). Be courteous — there's a delay between threads.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest_common import derive_title, is_trivial, out_dir_from_args, write_note  # noqa: E402

LIBRARY_URL = "https://www.perplexity.ai/library"
# Candidate selectors for the main thread content; first match wins.
EXTRACT_SELECTORS = ["main", "[class*='thread']", "article"]


def _collect_thread_links(page) -> list[str]:
    """Scroll the library and gather unique /search/ thread URLs."""
    seen: set[str] = set()
    stable = 0
    while stable < 3:
        for a in page.query_selector_all("a[href*='/search/']"):
            href = a.get_attribute("href") or ""
            if "/search/" in href:
                seen.add(href if href.startswith("http") else "https://www.perplexity.ai" + href)
        page.mouse.wheel(0, 20000)
        page.wait_for_timeout(1200)
        before = len(seen)
        for a in page.query_selector_all("a[href*='/search/']"):
            href = a.get_attribute("href") or ""
            seen.add(href if href.startswith("http") else "https://www.perplexity.ai" + href)
        stable = stable + 1 if len(seen) == before else 0
    return sorted(seen)


def _extract(page) -> str:
    for sel in EXTRACT_SELECTORS:
        el = page.query_selector(sel)
        if el:
            text = el.inner_text().strip()
            if len(text) > 80:
                return text
    return page.inner_text("body").strip()


def main() -> int:
    ap = argparse.ArgumentParser(description="Scrape past Perplexity threads.")
    ap.add_argument("--out")
    ap.add_argument("--user-data-dir", default=str(Path.home() / ".pplx-profile"))
    ap.add_argument("--max", type=int, default=0, help="Limit threads (0 = all).")
    ap.add_argument("--delay", type=float, default=2.0, help="Seconds between threads.")
    ap.add_argument("--headful", action="store_true", help="Show the browser (needed to log in).")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--min-chars", type=int, default=120)
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright  # type: ignore
    except ImportError:
        print("Install Playwright first:  pip install playwright && playwright install chromium")
        return 1

    out = out_dir_from_args(args.out)
    seen: set = set()
    written = skipped = 0

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            args.user_data_dir, headless=not args.headful)
        page = ctx.new_page()
        page.goto(LIBRARY_URL, wait_until="domcontentloaded")
        if args.headful:
            input("Log in to Perplexity in the window if needed, then press Enter here... ")
            page.goto(LIBRARY_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(2000)

        links = _collect_thread_links(page)
        if args.max:
            links = links[: args.max]
        print(f"[perplexity] found {len(links)} threads.")

        for url in links:
            try:
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                body = _extract(page)
            except Exception as e:
                print(f"   ! failed {url}: {e}")
                continue
            if not body or is_trivial(body, args.min_chars):
                skipped += 1
                continue
            fm = {
                "title": derive_title(body, "Perplexity thread"), "type": "source",
                "source": "perplexity", "source_url": url, "created": None,
                "tags": ["type/source", "src/perplexity", "status/inbox"], "related": [],
            }
            if write_note(out, fm, body, dry=args.dry_run, seen=seen):
                written += 1
            else:
                skipped += 1
            time.sleep(args.delay)

        ctx.close()

    print(f"[perplexity] {written} written, {skipped} skipped -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
