# Backlog converters

One-time importers that turn your **historical** notes into vault markdown in
`00-Inbox/`. After running any of them, run the nightly job (or the Ingestion
Playbook) to title, tag, and `[[wikilink]]` everything into `Notes/`.

All converters share a **dedupe + "skip trivial"** filter (`../ingest_common.py`)
so copying from D: and running exports won't create duplicates or import junk
(`--min-chars` tunes the triviality threshold).

| Converter | Source | How to get the input |
|---|---|---|
| `claude_export.py` | Claude chats | Claude → Settings → Privacy → **Export data** → `conversations.json` |
| `gemini_takeout.py` | Gemini chats | takeout.google.com → **Gemini Apps** → `MyActivity.json`/`.html` |
| `keep_takeout.py` | Google Keep | takeout.google.com → **Keep** → the `Takeout/Keep/` folder |
| `perplexity_scrape.py` | Perplexity | none — drives your logged-in browser over your Library |

## Common usage

```bash
cd second-brain/tools
# writes into $VAULT_DIR/00-Inbox by default (or pass --out)
python converters/claude_export.py ~/Downloads/conversations.json --dry-run
python converters/gemini_takeout.py ~/Downloads/Takeout/.../MyActivity.json
python converters/keep_takeout.py   ~/Downloads/Takeout/Keep
python converters/perplexity_scrape.py --headful      # first run: log in
```

- `--out DIR` overrides the destination (defaults to `$VAULT_DIR/00-Inbox`).
- `--dry-run` previews without writing.
- `--min-chars N` raises/lowers the "too trivial to keep" bar.

## Perplexity notes

It has no bulk export, so `perplexity_scrape.py` uses **Playwright** with a
persistent browser profile and your login. First run with `--headful`, log in,
press Enter; it then scrolls your Library, collects every thread, and saves each
as a note with its URL. Perplexity's HTML shifts over time — if extraction comes
back thin, adjust `EXTRACT_SELECTORS` at the top of the script. Use `--max` to
test on a few first, and `--delay` to stay courteous.

## Order of operations (see ../BACKLOG-IMPORT.md)

1. Copy existing `ck-vault` / Drive notes into `00-Inbox/` (covers most Claude +
   Perplexity history for free).
2. Run the converters for whatever isn't already there.
3. Run the nightly job in batches to link it all together.
