# Architecture

## The problem, precisely

The "second brain" was a Google Drive (reached through a Google Drive MCP
connector) into which notes from Claude, Perplexity, and Google Keep were
copied. Two structural issues made it fail as a knowledge base:

1. **Untitled captures.** Many files are literally named `Untitled document`
   (going back years). Google's Drive API also auto-converts uploaded plain text
   into Google Docs, so captures lost their formatting *and* their title.
2. **No linking layer.** Google Docs do not support `[[wikilinks]]`, `#tags`,
   backlinks, or graph view. Notes could not reference each other, so the
   collection was a flat pile, not a web of knowledge.

### What the Drive actually contains

- Notes live on a **Shared Drive** (root id `0AN4R0HdHnd_1Uk9PVA`), which is why
  `owner = 'me'` filters return nothing for the Docs.
- The drive is also full of **unrelated junk** (years of Overwatch game error
  logs, Tor browser files, etc.). These must be excluded from the vault.
- The real knowledge content clusters into three areas:
  - **Nursing School** — pathophysiology/gerontology exams, vSim scenarios,
    cranial nerves, NCOA, study guides. (The "Untitled" docs were mostly these.)
  - **Creative Writing** — *Gridfall* (a saga with many overlapping drafts) and
    *Becoming AEGIS* (a complete short story).
  - **Projects** — *Project LITEN* (spec + drawings).

## The solution

A **markdown vault** stored inside the existing `AI_Brain_Notes/` Drive folder,
written as real `.md` files (not converted to Google Docs). Obsidian syncs to
this folder and gets full wikilink/tag/graph functionality.

```
AI_Brain_Notes/                 (vault root)
├── _System/
│   ├── Home.md                 # dashboard + master MOC
│   ├── Conventions.md          # note format & rules
│   └── Tags.md                 # controlled tag vocabulary
├── _Templates/
│   ├── Note Template.md
│   └── Source Template.md
├── 00-Inbox/                   # raw captures land here
│   └── README.md
├── MOCs/
│   ├── Nursing School MOC.md
│   ├── Creative Writing MOC.md
│   └── Projects MOC.md
└── Notes/                      # processed atomic notes
    ├── Geriatric Nursing - 50-Question Practice Exam.md
    ├── Gerontological Nursing - 30-Question Advanced Exam.md
    ├── vSim - Vernon Russell Stroke Scenario.md
    └── Becoming AEGIS.md
```

### Linking model

- **Notes ↔ Notes:** `[[wikilinks]]` and a `related:` frontmatter list.
- **Notes → MOCs:** every note links to at least one MOC, so nothing is orphaned.
- **MOCs → Home:** every MOC links back to `Home.md`.
- **Notes → original sources:** a `source_url` (markdown link) to the original
  Google Doc / file, so the canonical long-form copy is one click away and
  content is **not duplicated**.

## Known constraints (important)

The Drive MCP exposes only: `search_files`, `read_file_content`,
`get_file_metadata`, `list_recent_files`, `create_file`, `copy_file`,
`download_file_content`, `get_file_permissions`. It has **no rename / move /
update-metadata / delete** tool. Consequences:

- We **cannot rename** an existing "Untitled" Google Doc in place, nor move it.
- Strategy: create a properly titled markdown **note** that links to the
  original Doc. The Doc stays as-is (canonical full copy); the markdown note adds
  the title, tags, and links. This is non-destructive — no originals are touched.
- To truly rename/move/delete originals, do it in the Drive web UI, or use a
  Google Apps Script (see `KEEP-INGESTION.md` for the scripting pattern).

## What was built in this pass

- The full folder scaffold + `_System` + `_Templates` + `00-Inbox` notes.
- Three MOCs covering every known content cluster (processed items use
  `[[wikilinks]]`; unprocessed originals are listed as `🔲` links to finish later).
- Four seed notes converted from the orphaned "Untitled"/loose files:
  the two gerontology exams, the Vernon Russell vSim scenario, and *Becoming AEGIS*.

## Source-aware layer

Captures carry a `source:` field (`keep` / `claude` / `gemini` / `perplexity` /
`manual`) and a `#src/...` tag. The **Sources MOC** is a provenance hub that
complements the topic MOCs, and chat notes keep their `source_url` so they're
traceable back to the live conversation.

## Nightly automation

A 3am US-Central job (`tools/nightly.py`) scrapes Keep + processes inbox captures
+ titles/tags/`[[wikilinks]]`/updates MOCs, running in **both** GitHub Actions
(cloud, primary) and Windows Task Scheduler (local backup). It uses the Drive
*API* (which, unlike the MCP, can update files) in cloud mode and the mounted
folder in local mode. Linking uses Claude when `ANTHROPIC_API_KEY` is set, else
deterministic rules. See `AUTOMATION.md` and `CAPTURE.md`.

## Two manual vault edits

Because the Drive MCP can't edit existing files, two seed files need a one-time
tweak in Obsidian: add `[[Sources MOC]]` to `_System/Home.md`, and `#src/gemini`
to `_System/Tags.md`. (The nightly job's Drive-API backend *can* edit files, so
future edits are automatic.)

## What's left (run the playbook to finish)

- Convert the remaining `🔲` items listed in each MOC.
- Consolidate the many *Gridfall* drafts down to one canonical version.
- Make the two manual vault edits above.
