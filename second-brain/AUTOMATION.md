# Nightly automation (3am US Central)

Every morning the **nightly librarian** scrapes the previous day's notes, gives
them real titles, tags, and `[[wikilinks]]`, files them into `Notes/`, and links
them from the right MOC. It runs in **two places** (your choice from setup):

- **GitHub Actions (cloud)** — primary; runs whether or not your PC is on.
- **Windows Task Scheduler** — backup / manual; runs on your PC into the mounted
  Drive vault.

## What it does (and doesn't)

| Step | Automatic at 3am? |
|------|-------------------|
| Pull new **Google Keep** notes | ✅ yes (via stored token) |
| File **chats** you saved during the day with the Web Clipper | ✅ yes (from `00-Inbox/`) |
| Go *fetch* Claude/Gemini/Perplexity chats from scratch | ❌ no — no API; the Web Clipper captures these when you click it |
| Title / tag / `[[wikilink]]` / update MOCs | ✅ yes |

The pieces: `nightly.py` (orchestrator) → `keep_scrape.py` (Keep) +
`vault_backend.py` (storage) + `linker.py` (Claude or deterministic linking).

## Timing

GitHub cron is UTC with no DST, so the workflow fires at **08:00 and 09:00 UTC**
and `--guard-central-3am` lets only the run that is actually 3am `America/Chicago`
proceed. The Windows task is set to 03:00 local with **wake-to-run**.

## How linking decides tags & links

- If `ANTHROPIC_API_KEY` is set, `linker.py` asks Claude (default
  `claude-sonnet-4-6`, with prompt caching of the vault index) for the title,
  type, tags, MOC, and related notes.
- If not, it falls back to deterministic rules (title from the first line/heading,
  source tag from frontmatter) and flags the note `#status/needs-review`.

Either way a note is **never left "Untitled"** and is always linked to a MOC.

---

## Setup A — GitHub Actions (cloud, primary)

1. **Service account for Drive** (so the cloud job can write the vault) —
   full click-by-click in **[`SERVICE-ACCOUNT-SETUP.md`](./SERVICE-ACCOUNT-SETUP.md)**.
   In short: create a GCP project → enable the Drive API → create a service
   account + JSON key → share the Shared Drive with the SA email as
   *Content manager*.
2. **Add repo secrets** (Settings → Secrets and variables → Actions):
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — the full key JSON.
   - `KEEP_EMAIL` — `chriskeen77@gmail.com`.
   - `KEEP_MASTER_TOKEN` — see `CAPTURE.md` for how to get it.
   - `ANTHROPIC_API_KEY` — optional, enables smart linking.
3. The workflow `.github/workflows/second-brain-nightly.yml` is already committed.
   Trigger a **manual dry run**: Actions tab → *Second Brain nightly* → *Run
   workflow* → check "Preview without writing".

## Setup B — Windows Task Scheduler (local, backup)

1. Install Python 3.12+ and: `pip install -r second-brain\tools\requirements.txt`
2. `copy second-brain\tools\.env.example second-brain\tools\.env` and fill in:
   - `VAULT_MODE=local`
   - `VAULT_DIR=` the mounted vault path, e.g.
     `G:\Shared drives\<drive>\AI_Brain_Notes`
   - `KEEP_EMAIL`, `KEEP_MASTER_TOKEN`, optional `ANTHROPIC_API_KEY`.
3. Edit `second-brain\tools\windows\run-nightly.bat` → set `TOOLS_DIR`.
4. Task Scheduler → **Import Task…** → `windows\SecondBrain-Nightly.xml`, then in
   the Actions tab point it at your `run-nightly.bat`. It runs daily at 03:00 and
   wakes the PC.

## Test it any time

```bash
cd second-brain/tools
python nightly.py --dry-run        # shows what it would create, writes nothing
```

## Safety

- Duplicates are skipped (existing notes' `source_url` / `keep_id` are checked),
  so re-running is harmless.
- Processed inbox items are **trashed** (Drive) or removed (local) after filing —
  set `KEEP_INBOX=1` to keep them.
- Secrets live only in `.env` (gitignored) or GitHub Secrets — never committed.
