---
description: Reflect on this session and save what matters to the Keep
---

Write this session's reflection into the Keep — Chris's personal memory
system. The Keep lives at `$KEEP_DIR` if that environment variable is set,
otherwise at `~/keep`. If neither exists, say so and stop.

Do the following:

1. **Reflect on the whole conversation so far.** Identify: what we worked
   on, the high points, decisions made (and why), open questions, next
   steps, and anything new learned about Chris himself (preferences, facts,
   context). Weigh what will matter in a week, not what filled the minutes.

2. **Write a journal entry** at `journal/YYYY-MM-DD-<short-slug>.md`
   (today's date; if an entry for this session already exists, update it
   rather than adding a duplicate). Format:

   ```markdown
   # YYYY-MM-DD — <Short title>

   *Source: <Claude Code session in <project> | claude.ai chat>*

   - 3–10 bullets: concrete, dated, self-contained. A stranger (or Claude,
     next month) should understand each bullet without the transcript.
   ```

3. **Update the relevant project file** in `projects/` — current state,
   new decisions, next steps. Create the file from the pattern of the
   existing ones if this is a new project. Add `(YYYY-MM-DD)` to new facts.

4. **If you learned something durable about Chris**, add a dated bullet to
   `profile.md` in the right section. Be conservative — profile is distilled
   memory, not a log.

5. **If the "in flight" picture changed**, update the few lines in
   `index.md`. Keep index.md under a page — trim as needed.

6. If the Keep is a git repo, commit with message
   `keep: YYYY-MM-DD <short title>`. Do not push unless Chris asked.

Then tell Chris in one or two sentences what you kept.

Rules: never delete existing Keep content from this command (tending is
Chris's job, in the dashboard); write plainly; no transcript dumps —
reflections, not recordings.
