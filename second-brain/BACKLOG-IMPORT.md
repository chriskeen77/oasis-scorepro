# Importing your whole history (one-time runbook)

Goal: pull every past Claude, Gemini, Perplexity, and Keep note into the vault and
link them together — without duplicates or noise. Do it in this order; each step
is cheaper than the one after it.

## Step 1 — Copy what you already have (Lane 1)

Your old system already copied Claude/Perplexity notes, so most history likely
lives in `D:\obsidian\ck-vault` (and the Drive docs). Re-scraping that would just
duplicate it.

- Drag your existing `.md` (and `.txt`) notes into the mounted vault's
  **`00-Inbox/`**. Put already-organized notes straight into `Notes/`.
- This alone may cover the bulk of your Claude + Perplexity past. No scraping,
  no API.

## Step 2 — Export what's only in the live apps

Run from `second-brain/tools/` (set `VAULT_DIR` so output lands in `00-Inbox/`,
or pass `--out`). Start each with `--dry-run` to preview.

| Source | Get the export | Convert |
|---|---|---|
| **Claude** | Settings → Privacy → **Export data** → `conversations.json` | `python converters/claude_export.py conversations.json` |
| **Gemini** | Takeout → **Gemini Apps** → `MyActivity.json` | `python converters/gemini_takeout.py MyActivity.json` |
| **Keep** | Takeout → **Keep** → `Takeout/Keep/` | `python converters/keep_takeout.py Takeout/Keep` |
| **Perplexity** | (none) drives your browser | `python converters/perplexity_scrape.py --headful` |

All four de-dupe (by content hash) and skip trivial chats, so they're safe to run
after Step 1.

### Perplexity specifics
No bulk export exists, so the scraper logs into your account in a real browser and
walks your Library. First run: `--headful`, log in, press Enter. Test with
`--max 5` before doing the full run. If a thread comes back empty, Perplexity
changed its HTML — tweak `EXTRACT_SELECTORS` in the script.

## Step 3 — Link it all together

Now `00-Inbox/` holds everything. Process it into linked notes:

- **Big backlog:** run the nightly job a few times (it batches what's in the
  inbox): `python nightly.py` (set `ANTHROPIC_API_KEY` so titles/tags/links are
  smart). Or trigger the GitHub Action manually.
- **Hands-on:** use the [Ingestion Playbook](./INGESTION-PLAYBOOK.md) prompt with
  Claude + the Drive MCP for trickier cross-linking.

Each note gets a real title, `#tags` (including `#src/...`), a MOC link, and
`[[wikilinks]]` to related notes. Topics cluster automatically through tags +
MOCs + backlinks (open the **graph view** to watch it connect).

## Keeping it clean

- **Curate, don't dump.** `--min-chars` filters throwaway chats; raise it if your
  graph gets noisy. A focused brain beats a complete-but-useless one.
- **Dedup across runs:** the nightly job also skips notes whose `source_url` /
  `keep_id` already exist in `Notes/`, so re-imports won't pile up.
- After the big import, going-forward capture (Web Clipper + nightly Keep scrape)
  keeps the backlog from ever rebuilding — see [`CAPTURE.md`](./CAPTURE.md).
