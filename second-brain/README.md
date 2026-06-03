# Second Brain

A redesigned personal knowledge system. Notes from **Claude**, **Perplexity**,
and **Google Keep** are captured into **Google Drive** and organized as an
**Obsidian-compatible markdown vault** with real titles, `#tags`, `[[wikilinks]]`,
backlinks, and graph view.

This directory is the **source of truth** for how the system works. The vault
itself lives in Google Drive (so it can sync to Obsidian and be referenced
anywhere).

## Why this exists

The previous setup had two problems:

1. **Notes came in as "Untitled."** Captures were created as Google Docs with no
   title and dropped into the Drive root.
2. **Nothing linked together.** Google Docs cannot support `[[wikilinks]]`,
   `#tags`, or backlinks, so notes were isolated and unsearchable as a graph.

The fix: a true **markdown vault** where every note is titled, tagged, and linked,
plus a repeatable **ingestion process** that prevents "Untitled" notes from ever
being created again.

## Where things live

- **Vault root (Drive):** `AI_Brain_Notes/`
  (folder id `1Jdy5ipFNb8JHykrAWKm1cdQehghSZPw0`, on a Shared Drive)
- **Vault structure:**
  - `_System/` — `Home.md` (dashboard), `Conventions.md`, `Tags.md`
  - `_Templates/` — `Note Template.md`, `Source Template.md`
  - `00-Inbox/` — raw, unprocessed captures (drop zone)
  - `MOCs/` — Maps of Content (`Nursing School MOC`, `Creative Writing MOC`, `Projects MOC`)
  - `Notes/` — processed atomic notes

## Documents in this directory

| File | Purpose |
|------|---------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Full design, the Drive findings, and known constraints |
| [`CAPTURE.md`](./CAPTURE.md) | Get chats (Web Clipper) and Keep into the vault — with the source links |
| [`AUTOMATION.md`](./AUTOMATION.md) | The **3am nightly job** (cloud + Windows) that scrapes, tags, and links |
| [`SERVICE-ACCOUNT-SETUP.md`](./SERVICE-ACCOUNT-SETUP.md) | Click-by-click Google service account setup for the cloud job |
| [`INGESTION-PLAYBOOK.md`](./INGESTION-PLAYBOOK.md) | The reusable Claude prompt for ad-hoc/manual processing |
| [`CONVENTIONS.md`](./CONVENTIONS.md) | Note format, titling rules, folder roles |
| [`OBSIDIAN-SYNC.md`](./OBSIDIAN-SYNC.md) | How to connect Obsidian to the Drive vault |
| [`KEEP-INGESTION.md`](./KEEP-INGESTION.md) | Background on Google Keep options |
| [`tools/`](./tools) | The nightly job: `nightly.py`, `keep_scrape.py`, `linker.py`, schedulers, clipper templates |
| [`templates/`](./templates) | Plain-text copies of the vault templates |

## Decisions in effect

- **Canonical vault:** the Google Drive `AI_Brain_Notes/` folder, mounted locally
  via Google Drive for Desktop and opened in Obsidian.
- **Chat capture:** full content **+** the source URL (via Obsidian Web Clipper).
- **Automation:** a 3am US-Central nightly job, running **both** in GitHub Actions
  (primary) and Windows Task Scheduler (backup).

## Two manual vault edits (Drive MCP can't edit existing files)

In Obsidian, make these one-time tweaks to the seed files:
1. `_System/Home.md` → add `- [[Sources MOC]]` under "Maps of Content".
2. `_System/Tags.md` → add `#src/gemini` to the Source list.

## Quick start

1. **Mount + open:** [`OBSIDIAN-SYNC.md`](./OBSIDIAN-SYNC.md) — install Google
   Drive for Desktop, open `AI_Brain_Notes/` as a vault, open `_System/Home.md`.
2. **Set up capture:** [`CAPTURE.md`](./CAPTURE.md) — install the Web Clipper
   (import the templates in `tools/clipper-templates/`) and get a Keep token.
3. **Turn on the 3am job:** [`AUTOMATION.md`](./AUTOMATION.md) — add the secrets
   and run a dry run. After that it titles/tags/links new notes every morning.
4. **Ad-hoc cleanup** any time with the [`INGESTION-PLAYBOOK.md`](./INGESTION-PLAYBOOK.md)
   prompt (Claude + Drive MCP).
