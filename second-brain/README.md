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
| [`INGESTION-PLAYBOOK.md`](./INGESTION-PLAYBOOK.md) | **The reusable prompt** that processes the inbox / untitled notes |
| [`CONVENTIONS.md`](./CONVENTIONS.md) | Note format, titling rules, folder roles |
| [`OBSIDIAN-SYNC.md`](./OBSIDIAN-SYNC.md) | How to connect Obsidian to the Drive vault |
| [`KEEP-INGESTION.md`](./KEEP-INGESTION.md) | How to get Google Keep notes into the vault (Keep is **not** in the Drive MCP) |
| [`templates/`](./templates) | Plain-text copies of the vault templates |

## Quick start

1. Read [`OBSIDIAN-SYNC.md`](./OBSIDIAN-SYNC.md) and point Obsidian at the
   `AI_Brain_Notes/` folder. Open `_System/Home.md`.
2. When new notes pile up (in `00-Inbox/` or as "Untitled" docs in Drive), run the
   [`INGESTION-PLAYBOOK.md`](./INGESTION-PLAYBOOK.md) prompt with Claude + the
   Drive MCP. It titles, tags, links, and files everything.
3. Fix capture at the source using [`KEEP-INGESTION.md`](./KEEP-INGESTION.md) so
   future notes arrive titled.
