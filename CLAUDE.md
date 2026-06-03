# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## Project overview

`oasis-scorepro` is a frontend web application scaffolded with **Vite** and
**React 19**. It is an ES module project (`"type": "module"` in
`package.json`) using plain JavaScript with JSX (`.jsx`), not TypeScript.

> **Current state:** This repo is at the very start of its life. It is
> essentially the default `create-vite` React template plus a GitHub Actions
> publish workflow. There is **no application source code committed yet** — see
> "Known gaps" below before assuming files exist.

## Tech stack

- **Build tool:** Vite `^8.0.0-beta.13` (pinned via `overrides`)
- **UI library:** React `^19.2.0` / React DOM `^19.2.0`
- **Vite plugin:** `@vitejs/plugin-react` (Babel-based Fast Refresh / HMR)
- **Linting:** ESLint `^10` with the new flat config (`eslint.config.js`)
- **Language:** JavaScript + JSX (no TypeScript; `@types/react` present for editor IntelliSense only)
- **Node:** version 20 in CI (`.github/workflows`)

## Repository layout

```
.
├── index.html            # Vite entry HTML; loads /src/main.jsx
├── package.json          # Scripts and dependencies
├── vite.config.js        # Vite config (registers the React plugin)
├── eslint.config.js      # ESLint flat config
├── .github/workflows/    # CI: publish to GitHub Packages on release
└── (src/)                # App source — NOT yet created (see Known gaps)
```

When app code is added, follow the standard Vite + React convention that
`index.html` already assumes:

- `src/main.jsx` — entry point that mounts React into `#root`
- `src/App.jsx` — root component
- Components in `src/`, typically `PascalCase.jsx` for components

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (run once after cloning) |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally to verify the build |
| `npm run lint` | Run ESLint over the project |

There is **no `test` script defined**. Do not assume `npm test` works (see
Known gaps).

## Conventions

- **Modules:** Use ES module `import`/`export` syntax everywhere.
- **Components:** Function components with hooks; React 19 idioms.
- **File extensions:** Use `.jsx` for files containing JSX.
- **Linting rules** (from `eslint.config.js`):
  - `js.configs.recommended`, `react-hooks` recommended, and
    `react-refresh/vite` are all extended — respect the Rules of Hooks.
  - `no-unused-vars` is an **error**, but variables matching
    `^[A-Z_]` (e.g. constants / components) are ignored. Don't leave unused
    locals.
  - `dist/` is globally ignored by ESLint.
- Run `npm run lint` before committing; CI does not currently lint, so this is
  the main automated quality gate available locally.

## CI / publishing

`.github/workflows/npm-publish-github-packages.yml` runs **only when a GitHub
release is created**:

1. `build` job: `npm ci` then `npm test`.
2. `publish-gpr` job: `npm ci` then `npm publish` to GitHub Packages
   (`https://npm.pkg.github.com/`), authenticated with `GITHUB_TOKEN`.

There is no CI on push/PR (no lint/build/test on ordinary commits).

## Known gaps & gotchas

These are real inconsistencies in the current repo. Be aware of them and fix
them deliberately if your task touches the area:

1. **Missing `src/`.** `index.html` references `/src/main.jsx`, but no `src/`
   directory or entry file exists. `npm run dev`/`build` will fail until app
   source is added.
2. **`npm test` is not defined.** The publish workflow's `build` job runs
   `npm test`, which will fail. Add a `test` script (and tests) before relying
   on releases, or adjust the workflow.
3. **Publishing vs. `private`.** `package.json` has `"private": true` and
   `"version": "0.0.0"` with no `publishConfig`, yet the workflow runs
   `npm publish`. A private package cannot be published — resolve this
   (set scope/`publishConfig` and unset `private`, or repurpose the workflow)
   before expecting releases to publish.
4. **Pre-release Vite.** Vite `8.0.0-beta.13` is pinned via `overrides`; expect
   occasional beta rough edges.

## Working agreements for AI assistants

- Prefer the existing tooling (Vite, ESLint flat config) over introducing new
  build systems or TypeScript unless explicitly asked.
- After code changes, run `npm run lint` and, when source exists,
  `npm run build` to verify.
- Keep changes minimal and consistent with the established Vite + React
  conventions above.
- Do not commit `node_modules/`, `dist/`, or `*.local` files (already covered
  by `.gitignore`).
