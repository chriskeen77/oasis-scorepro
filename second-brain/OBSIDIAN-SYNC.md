# Connecting Obsidian to the Drive vault

The vault is a folder of real `.md` files in Google Drive
(`AI_Brain_Notes/`). To get the full second-brain experience — graph view,
backlinks, clickable `[[wikilinks]]`, tag pane — open that folder as an Obsidian
vault. Pick whichever sync path fits your devices.

## Option A — Desktop via Google Drive for Desktop (simplest)

1. Install **Google Drive for Desktop** and let it mount your Drive (including
   the Shared Drive that holds `AI_Brain_Notes/`).
2. In Obsidian: **Open folder as vault** → select the local mounted
   `AI_Brain_Notes` folder.
3. Open `_System/Home.md`. Turn on **graph view** to see the links.

Pros: zero cost, no extra tooling. Cons: desktop only; Drive's file streaming can
occasionally lag on first open.

## Option B — Obsidian + a real sync service (best cross-device)

If you want phone + desktop reliably, keep the canonical vault in a sync target
Obsidian handles well:

- **Obsidian Sync** (paid, first-party, encrypted), or
- **Git** (free): make `AI_Brain_Notes/` a git repo and use the community
  *Obsidian Git* plugin to auto-commit/pull.

Then treat Google Drive as the *capture/ingest* layer: notes are scraped into
Drive's `00-Inbox/`, the Ingestion Playbook turns them into vault notes, and your
sync service distributes the vault to all devices.

## Recommended Obsidian settings

- **Files & Links → New link format:** *Shortest path when possible*.
- **Files & Links → Use [[Wikilinks]]:** ON.
- **Default location for new notes:** `00-Inbox`.
- **Templates plugin:** point it at `_Templates/`.
- Enable **Graph view** and the **Backlinks** + **Tags** core plugins.

## Notes on format

- All vault files are created with mime type `text/markdown` and
  `disableConversionToGoogleType = true`, so Drive keeps them as `.md` (not Google
  Docs). That is what makes Obsidian features work.
- Original long-form content (study guides, drafts) stays as Google Docs; vault
  notes link to them via `source_url`. Open those in the browser, not Obsidian.
