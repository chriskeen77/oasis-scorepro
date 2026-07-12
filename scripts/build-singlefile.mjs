// Inline the built JS bundle into index.html so the app is one file.
// Run after: vite build --config vite.artifact.config.js
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const dir = new URL('../dist-artifact/', import.meta.url)
let html = readFileSync(new URL('index.html', dir), 'utf8')

html = html.replace(
  /<script type="module"[^>]*src="\/?([^"]+)"[^>]*><\/script>/g,
  (_, src) => {
    const js = readFileSync(new URL(src, dir), 'utf8')
    return `<script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</script>`
  }
)

writeFileSync(new URL('bookmark.html', dir), html)
const kb = Math.round(Buffer.byteLength(html) / 1024)
console.log(`dist-artifact/bookmark.html written (${kb} kB)`)
console.log('assets left behind:', readdirSync(new URL('assets', dir)).join(', '))
