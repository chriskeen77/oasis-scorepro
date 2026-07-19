# 📖 StoryTime — AI Story Maker

StoryTime builds a story with you, one ingredient at a time. For each ingredient —
**genre, theme, location, characters, backstory, twist, and finishing details** —
the AI brainstorms six summarized ideas to pick from, and you can always write
your own option instead (or skip a step and let the storyteller decide). Once the
recipe is complete, the AI thinks hard about structure, emotional arc, and where
to hide the twist, then writes and streams your story live onto the page.

## Features

- **Guided 7-step wizard** — genre → theme → location → characters → backstory → twist → details
- **AI-generated idea cards** — six fresh, story-aware options per step, summarized so they're easy to compare; regenerate for more
- **Write your own** — every step accepts a custom option, and custom entries are given extra weight when the story is written
- **Skip / surprise me** — leave any ingredient to the storyteller's judgment
- **Review screen** — see the whole recipe, edit any ingredient, and pick a length (short tale / full story / epic)
- **Deep-thinking story generation** — the final story uses Claude's adaptive thinking at high effort and streams in token by token
- **Narration + WAV export** — have the finished story read aloud with your browser's speech voices (with a voice picker and pause/resume), and once narration completes, save a WAV of the story rendered by the built-in offline narrator (browsers can't record their own speech voices, so the file uses a bundled espeak voice)
- **Demo mode & graceful fallback** — explore the full flow with curated sample ideas if you don't have an API key or the API is unreachable

## Getting started

```bash
npm install --legacy-peer-deps
npm run dev
```

Open the printed URL, paste your [Anthropic API key](https://platform.claude.com/)
(it's stored only in your browser's localStorage and sent only to Anthropic), and
start building. No key? Choose **demo mode** to explore the wizard with sample ideas.

## How it works

- React + Vite single-page app, no backend — the browser talks to the Claude API
  directly via the official `@anthropic-ai/sdk`.
- Idea generation uses **structured outputs** (`output_config.format` with a JSON
  schema) on `claude-opus-4-8`, feeding all previously chosen ingredients into each
  brainstorm so options stay coherent with the story taking shape.
- Story generation uses **adaptive thinking** with `effort: "high"` and the
  streaming API, so the model plans the story before writing and the prose appears
  live as it's composed.

## Run it on your phone (Cloudflare Workers)

The app is a static build, so it deploys as a Cloudflare Worker with static
assets — giving you an HTTPS `*.workers.dev` URL that works on any phone:

```bash
npx wrangler login      # one-time: opens a browser to link your Cloudflare account
npm run cf:deploy       # builds and deploys → https://storytime.<your-subdomain>.workers.dev
```

To preview the Worker locally before deploying, run `npm run cf:dev`.

Alternative for quick phone testing without deploying: keep `npm run dev` running
and expose it with a Cloudflare quick tunnel — `npx cloudflared tunnel --url http://localhost:5173` —
which prints a temporary public `trycloudflare.com` URL.

## Scripts

| Command           | What it does             |
| ----------------- | ------------------------ |
| `npm run dev`     | Start the dev server     |
| `npm run build`   | Production build         |
| `npm run preview` | Preview the built app    |
| `npm run lint`    | Lint the source          |
| `npm run cf:dev`  | Build + serve via a local Cloudflare Worker |
| `npm run cf:deploy` | Build + deploy to Cloudflare Workers      |
