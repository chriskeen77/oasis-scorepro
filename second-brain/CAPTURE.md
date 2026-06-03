# Capturing chats & Keep into the vault

This is the **capture layer** that feeds the nightly job. Chats are captured with
the Obsidian Web Clipper; Keep is scraped by the nightly script.

## Claude / Gemini / Perplexity — Obsidian Web Clipper

The [Obsidian Web Clipper](https://obsidian.md/clipper) is a free official browser
extension. It saves the page text **plus the URL** into your vault — exactly the
"full content + link" you wanted.

1. Install the Web Clipper extension (Chrome/Edge/Firefox/Safari).
2. In its settings, set the vault to your `AI_Brain_Notes` vault and the default
   folder to `00-Inbox`.
3. Add one template per service. You can **import** the JSON in
   `tools/clipper-templates/` (`claude.json`, `gemini.json`, `perplexity.json`),
   or recreate them manually with these settings:
   - **Trigger URL:** `https://claude.ai/chat/` · `https://gemini.google.com/app/`
     · `https://www.perplexity.ai/search/`
   - **Note name:** `{{title}}`  · **Folder:** `00-Inbox`
   - **Properties (frontmatter):** `title={{title}}`, `type=source`,
     `source=claude|gemini|perplexity`, `source_url={{url}}`, `created={{date}}`,
     `tags=type/source,src/<service>,status/inbox`
4. On any chat/answer page, click the clipper → it drops a titled markdown note
   (with the link) into `00-Inbox`. The 3am job files and cross-links it.

> Template JSON keys can vary slightly between Web Clipper versions. If an import
> is rejected, just create the template by hand using the settings above.

## Google Keep — nightly scraper

Keep has no consumer API, so `keep_scrape.py` uses the community `gkeepapi`
library with a **master token**.

**Get a master token (one time):**
1. `pip install gkeepapi gpsoauth`
2. Follow the current method in the
   [gkeepapi docs](https://gkeepapi.readthedocs.io/) to exchange your Google
   login for a master token (it starts with `aas_et/`). Using an
   [app password](https://myaccount.google.com/apppasswords) for the exchange is
   usually the smoothest path.
3. Store it as `KEEP_MASTER_TOKEN` (and `KEEP_EMAIL`) in `.env` or GitHub Secrets.

The nightly job then pulls Keep notes edited in the last `KEEP_DAYS` (default 1),
derives a title from the note body (so titleless Keep notes never become
"Untitled"), maps Keep labels to `#keep/<label>` tags, and files them.

**One-time backlog:** to import your *existing* Keep notes, run once with a big
window: `python nightly.py --days 3650`. (Or use Google Takeout → Keep and drop
the export into `00-Inbox`.)

## Why this split

A scheduled job can hold a Keep token and run unattended. It **cannot** log into
Claude/Gemini/Perplexity as you and browse your private chats — those need your
authenticated browser, which is what the Web Clipper provides. Capture (clipper +
Keep token) happens where your data lives; the nightly job does the librarian
work of titling, tagging, and linking.
