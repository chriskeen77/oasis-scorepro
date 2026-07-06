# The Keep

*Yes, the Keep has a file about itself. Memory systems are projects too.*

## What it is

- (2026-07-06) Chris's personal memory across all Claude conversations:
  markdown files + `/keep` reflection command + weekly tending dashboard.
  Lives at `~/keep` on Chris's machine (once installed).

## How it works

- (2026-07-06) Write path: `/keep` in Claude Code appends a journal entry
  and updates project files. claude.ai chats: Chris asks for a "Keep
  reflection" and pastes it into the dashboard's Quick add.
- (2026-07-06) Read path: `~/.claude/CLAUDE.md` points every Claude Code
  session at `keep/index.md`.
- (2026-07-06) Maintenance: weekly tending in `dashboard.py` — edit,
  promote durable facts to profile/projects, archive spent journal entries.

## Decisions

- (2026-07-06) Named "the Keep" (from Chris: "save the ones I want to
  keep"; also the castle tower). Replaced the rejected "Christopher's Brain."
- (2026-07-06) Plain markdown + git, no database. Dashboard is a
  zero-dependency Python file. Chris tends it manually by choice — he wants
  to be a good steward, not fully automate it.

## Next steps

- Install on Chris's machine (`bash install.sh`), ideally move `keep/` to
  its own private repo.
- First week of real use, then the first tending session.

## Later / ideas

- SessionEnd hook for automatic reflection after every Claude Code session.
- MCP connector so claude.ai chats read/write the Keep directly.
- Scheduled weekly distill job that drafts promotions for Chris to approve.
