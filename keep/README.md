# The Keep

Your personal memory across every Claude conversation. A keep is the strongest
tower of a castle — the place you protect what matters. This one holds what
you and Claude have learned together: who you are, what you're building, and
what happened along the way.

Everything is plain markdown in folders. No database, no lock-in. You can read
it, edit it, grep it, and version it with git.

```
keep/
├── index.md              The map. Short. Read at the start of every session.
├── profile.md            Stable facts about you and how you like to work.
├── projects/             One file per project: state, decisions, next steps.
├── journal/              Dated reflections, one file per entry.
├── archive/              Retired entries (the dashboard moves things here).
├── commands/             /keep and /recall slash commands for Claude Code.
├── dashboard.py          The tending dashboard (see below).
└── install.sh            One-time setup on your machine.
```

## Install (one time, on your machine)

```bash
# 1. Get the keep folder onto your machine, e.g. copy it to your home dir:
cp -r keep ~/keep        # or clone it if you gave it its own repo

# 2. Run the installer:
cd ~/keep && bash install.sh
```

The installer:
- installs the `/keep` and `/recall` commands into `~/.claude/commands/`
- adds a short pointer to `~/.claude/CLAUDE.md` so every Claude Code
  session, in any folder, knows the Keep exists and reads `index.md` at start
- initializes git in `~/keep` so your memory is versioned

## Daily use

**In Claude Code** — at the end of a session (or any time something worth
remembering happened), type:

```
/keep
```

Claude reflects on the session and writes to the Keep: a journal entry with
the high points, plus updates to the relevant project file. To start a session
already oriented, type `/recall` (though the CLAUDE.md pointer means Claude
reads the index automatically anyway).

**In claude.ai chats** — at the end of a chat worth saving, say:

> Write a Keep reflection for this conversation: 3–8 bullet points covering
> what we worked on, decisions made, open questions, and anything you learned
> about me. Plain markdown.

Then paste the result into the dashboard's **Quick add** box. Thirty seconds,
and the chat is part of your memory. (A future upgrade: an MCP connector so
claude.ai writes to the Keep directly.)

## Weekly tending

The Keep stays healthy the way a garden does — a little regular attention.
Once a week, open the dashboard:

```bash
python3 ~/keep/dashboard.py
```

It opens at http://127.0.0.1:8787 and lets you:
- read recent journal entries and **edit, rewrite, or archive** them
- edit `profile.md`, `index.md`, and every project file in place
- **promote** the durable stuff — move a lasting fact from a journal entry
  up into your profile or a project file, then archive the entry
- add entries by hand (paste reflections from claude.ai chats)
- mark the Keep as tended, so you can see how long it's been

The ritual that keeps it working: journal entries are *raw memory* and should
flow through — promote what lasts, archive the rest. Profile and project files
are *distilled memory* and should stay short and current. If everything is
important, nothing is.

## Rules of the Keep

1. **index.md stays under a page.** It's the map, not the territory.
2. **Date things.** Every journal entry is dated; stale facts get retired.
3. **This is private.** It will come to contain a lot about you. Private
   repo only, if you push it anywhere.

## Later, if you want it

- **Auto-reflection**: a Claude Code `SessionEnd` hook can run `/keep`
  automatically after every session — no typing required. Ask Claude to
  "set up the Keep session-end hook" when you're ready.
- **claude.ai connector**: a small MCP server exposing the Keep, connected
  to claude.ai as a custom connector, so chats read and write it directly.
- **Weekly distill**: a scheduled Claude job that drafts the promotions for
  you, leaving you just the approve/edit pass in the dashboard.
