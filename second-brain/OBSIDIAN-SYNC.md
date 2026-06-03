# Connecting Obsidian to the Drive vault

The vault is a folder of real `.md` files in Google Drive
(`AI_Brain_Notes/`). To get the full second-brain experience — graph view,
backlinks, clickable `[[wikilinks]]`, tag pane — open that folder as an Obsidian
vault. Pick whichever sync path fits your devices.

> **Chosen setup:** the **Drive folder is canonical** (Option A below). You mount
> it locally with Google Drive for Desktop and open it in Obsidian. The 3am job
> writes into the same folder, so everything stays in one place.

## Merging your existing `D:\obsidian\ck-vault`

Your old vault is local and I can't read it from the cloud. To fold it in, copy
its `.md` files into the mounted `AI_Brain_Notes` folder (drop loose notes into
`00-Inbox/` so the nightly job titles/tags/links them; put already-organized
notes into `Notes/`). Then either keep using `AI_Brain_Notes` as your only vault,
or, if you'd rather keep working in `ck-vault`, point Google Drive for Desktop to
sync into that path instead.

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
