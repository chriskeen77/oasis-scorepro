# BookMark — RSVP Speed Reader

Read books, PDFs, and articles one word at a time with Rapid Serial Visual
Presentation (RSVP). Your eyes stay fixed while words flash at a focal point,
letting you read at 250–1000 words per minute.

## Supported inputs

- **EPUB** — full books with chapter navigation (parsed in the browser via JSZip)
- **PDF** — text extracted with pdf.js
- **Markdown** (`.md`) — syntax stripped, split into chapters by headings, code blocks skipped
- **HTML** and plain **TXT**
- Or just paste text directly

Everything is parsed locally in your browser — no file ever leaves your device.

## Features

- Focus-letter highlighting (optimal recognition point) with a smooth brightness gradient
- Adjustable speed via nebula slider, ±40 buttons, or arrow keys: 60–1000 WPM
  forward with 200 WPM at the slider midpoint; slide past the pause notch on
  the left to scrub in reverse (the UI turns amber)
- Punctuation-aware pacing (longer pauses at sentence ends)
- Tap or press space to pause/resume, `←` to rewind 10 seconds, `Esc` to go back
- Per-document resume — reopen a book and continue where you left off
- Chapter list for EPUBs and Markdown files: read one chapter or the whole book
- Progress bar with time-remaining estimate

## Development

```bash
npm install --legacy-peer-deps
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # serve the production build
```

Built with React 19 + Vite. PDF and EPUB parsers are lazy-loaded so the
initial bundle stays small.
