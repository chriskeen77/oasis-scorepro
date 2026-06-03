# Conventions

The rules that keep the vault consistent. (Mirrored into the vault at
`_System/Conventions.md`; this repo copy is the source of truth.)

## 1. Every note has YAML frontmatter

```yaml
---
title: Human-readable title (never "Untitled")
type: note            # note | moc | source | exam | scenario | fiction | project | system
source: keep          # keep | claude | perplexity | manual
source_url:           # link back to the original (Google Doc / Keep / chat)
created: 2026-06-03
tags: []              # see Tags
related: []           # [[wikilinks]] to related notes
---
```

## 2. Titles are derived from content — never "Untitled"

In priority order: (1) the first heading, (2) the first sentence / the question
the note answers, (3) `<Topic> — <specific subject>`. Keep titles short and
avoid `()` so `[[wikilinks]]` stay clean.

## 3. Links, not silos

- Link every note to at least one other note (usually its MOC) before filing.
- `[[Note Title]]` for vault notes; normal markdown links for external sources.
- Long notes end with a `## Related` section.

## 4. Folder roles

| Folder | Purpose |
|--------|---------|
| `00-Inbox/` | Raw, unprocessed captures |
| `Notes/` | Processed atomic notes (the real vault) |
| `MOCs/` | Maps of Content — index/hub notes |
| `_Templates/` | Note & source templates |
| `_System/` | Home, Conventions, Tags |

## 5. Lifecycle

`#status/inbox` → process (title, tag, link) → `#status/processed`
(or `#status/needs-review` if it needs your input).

## 6. Tag taxonomy

Keep it small. Type (`#type/...`), Status (`#status/...`), Topic
(`#nursing`, `#writing`, `#project/...`), Source
(`#src/keep`, `#src/claude`, `#src/gemini`, `#src/perplexity`). Full list in the
vault's `_System/Tags.md`.

## 7. Captured chats

Chats clipped from Claude/Gemini/Perplexity use `type: source` and always carry
`source_url` (the chat link) plus the matching `#src/<service>` tag, so a note is
both self-contained (full text) and traceable back to the live conversation.
The nightly job (see `AUTOMATION.md`) adds tags/links and files them.
