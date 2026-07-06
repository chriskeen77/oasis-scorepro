#!/usr/bin/env python3
"""The Keep — tending dashboard.

Run:  python3 dashboard.py        (opens http://127.0.0.1:8787)

Zero dependencies. Reads and writes the markdown files of the Keep so you
can do your weekly tending: read recent journal entries, rewrite or archive
them, promote durable facts into profile/project files, and add entries
pasted from claude.ai chats.
"""

import json
import os
import re
import sys
import webbrowser
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

KEEP_DIR = Path(os.environ.get("KEEP_DIR", Path(__file__).resolve().parent))
PORT = int(os.environ.get("KEEP_PORT", "8787"))
TENDED_FILE = KEEP_DIR / ".tended"

# Only these locations are readable/writable through the dashboard.
TOP_FILES = ("index.md", "profile.md")
DIRS = ("journal", "projects", "archive")


def safe_path(rel: str) -> Path:
    """Resolve a repo-relative path, refusing anything outside the Keep."""
    p = (KEEP_DIR / rel).resolve()
    if p.suffix != ".md":
        raise ValueError("only .md files")
    if not str(p).startswith(str(KEEP_DIR.resolve()) + os.sep):
        raise ValueError("path escapes the Keep")
    rel_parts = p.relative_to(KEEP_DIR.resolve()).parts
    if len(rel_parts) == 1 and rel_parts[0] in TOP_FILES:
        return p
    if len(rel_parts) == 2 and rel_parts[0] in DIRS:
        return p
    raise ValueError("path not managed by the dashboard")


def read_dir(name: str):
    d = KEEP_DIR / name
    items = []
    if d.is_dir():
        for f in sorted(d.glob("*.md"), reverse=True):
            if name == "archive" and f.name == "README.md":
                continue
            items.append({"path": f"{name}/{f.name}", "name": f.name,
                          "content": f.read_text(encoding="utf-8")})
    return items


def state():
    top = []
    for name in TOP_FILES:
        f = KEEP_DIR / name
        top.append({"path": name, "name": name,
                    "content": f.read_text(encoding="utf-8") if f.exists() else ""})
    return {
        "keepDir": str(KEEP_DIR),
        "today": date.today().isoformat(),
        "lastTended": TENDED_FILE.read_text().strip() if TENDED_FILE.exists() else None,
        "top": top,
        "journal": read_dir("journal"),
        "projects": read_dir("projects"),
        "archive": read_dir("archive"),
    }


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:40] or "entry"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # keep the terminal quiet
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        if self.path == "/":
            self._send(200, PAGE.encode(), "text/html")
        elif self.path == "/api/state":
            self._send(200, state())
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        try:
            body = self._body()
            if self.path == "/api/save":
                p = safe_path(body["path"])
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(body["content"], encoding="utf-8")
            elif self.path == "/api/archive":
                src = safe_path(body["path"])
                if not src.exists():
                    raise ValueError("no such file")
                dest_name = src.name
                if not re.match(r"\d{4}-\d{2}-\d{2}", dest_name):
                    dest_name = f"{date.today().isoformat()}-{dest_name}"
                dest = safe_path(f"archive/{dest_name}")
                dest.parent.mkdir(exist_ok=True)
                # never overwrite an existing archive file
                i = 1
                while dest.exists():
                    dest = dest.with_name(f"{dest.stem}-{i}{dest.suffix}")
                    i += 1
                src.rename(dest)
            elif self.path == "/api/add":
                title = (body.get("title") or "entry").strip()
                fname = f"{date.today().isoformat()}-{slugify(title)}.md"
                p = safe_path(f"journal/{fname}")
                i = 1
                while p.exists():
                    p = safe_path(f"journal/{date.today().isoformat()}-{slugify(title)}-{i}.md")
                    i += 1
                src = (body.get("source") or "added by hand in the dashboard").strip()
                text = (f"# {date.today().isoformat()} — {title}\n\n"
                        f"*Source: {src}*\n\n{body.get('content', '').strip()}\n")
                p.parent.mkdir(exist_ok=True)
                p.write_text(text, encoding="utf-8")
            elif self.path == "/api/tended":
                TENDED_FILE.write_text(date.today().isoformat())
            else:
                return self._send(404, {"error": "not found"})
            self._send(200, {"ok": True, "state": state()})
        except Exception as e:  # surface the reason to the UI
            self._send(400, {"error": str(e)})


PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Keep — Tending</title>
<style>
  :root {
    --bg: #f6f4ef; --panel: #fffdf8; --ink: #2b2926; --muted: #7a756c;
    --line: #e3ded4; --accent: #7c5cbf; --accent-ink: #fff; --danger: #b3502e;
    --code: #efece4;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17161a; --panel: #201f24; --ink: #e8e5df; --muted: #97928a;
      --line: #34323a; --accent: #a687e8; --accent-ink: #17161a;
      --danger: #e0764f; --code: #2a282f;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 15px/1.55 ui-sans-serif, system-ui, sans-serif; }
  header { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
           padding: 20px 24px 0; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0; letter-spacing: .2px; }
  h1 .tower { color: var(--accent); }
  #tended { color: var(--muted); font-size: 13px; margin-left: auto; }
  #tended button { margin-left: 8px; }
  nav { display: flex; gap: 6px; flex-wrap: wrap; padding: 14px 24px;
        max-width: 900px; margin: 0 auto; }
  nav button { background: none; border: 1px solid var(--line); color: var(--ink);
               border-radius: 999px; padding: 5px 14px; cursor: pointer; font: inherit;
               font-size: 13.5px; }
  nav button.on { background: var(--accent); color: var(--accent-ink);
                  border-color: var(--accent); }
  main { max-width: 900px; margin: 0 auto; padding: 0 24px 60px; }
  .card { background: var(--panel); border: 1px solid var(--line);
          border-radius: 10px; padding: 16px 18px; margin: 14px 0; }
  .card h3 { margin: 0 0 2px; font-size: 15px; }
  .meta { color: var(--muted); font-size: 12.5px; margin-bottom: 8px; }
  .bar { display: flex; gap: 8px; margin-top: 10px; }
  button.act { font: inherit; font-size: 13px; border: 1px solid var(--line);
               background: none; color: var(--ink); border-radius: 6px;
               padding: 4px 12px; cursor: pointer; }
  button.act.primary { background: var(--accent); color: var(--accent-ink);
                       border-color: var(--accent); }
  button.act.danger { color: var(--danger); border-color: var(--danger); }
  textarea { width: 100%; min-height: 180px; font: 13px/1.5 ui-monospace, monospace;
             color: var(--ink); background: var(--code); border: 1px solid var(--line);
             border-radius: 8px; padding: 10px; resize: vertical; }
  input[type=text] { width: 100%; font: inherit; color: var(--ink);
             background: var(--code); border: 1px solid var(--line);
             border-radius: 8px; padding: 8px 10px; }
  .md :is(h1,h2,h3) { font-size: 15px; margin: 10px 0 4px; }
  .md h1 { font-size: 16px; }
  .md ul { margin: 6px 0; padding-left: 22px; }
  .md li { margin: 3px 0; }
  .md p { margin: 6px 0; }
  .md em { color: var(--muted); }
  .md code { background: var(--code); border-radius: 4px; padding: 1px 5px;
             font-size: 12.5px; }
  .md a { color: var(--accent); }
  .hint { color: var(--muted); font-size: 13px; margin: 18px 0 6px; }
  #toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
           background: var(--ink); color: var(--bg); border-radius: 8px;
           padding: 8px 18px; font-size: 13.5px; opacity: 0; transition: opacity .25s;
           pointer-events: none; }
  #toast.show { opacity: 1; }
</style>
</head>
<body>
<header>
  <h1><span class="tower">⌂</span> The Keep</h1>
  <span id="tended"></span>
</header>
<nav id="tabs"></nav>
<main id="main"></main>
<div id="toast"></div>
<script>
let S = null, tab = 'Journal', editing = new Set();

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// A tiny markdown renderer: headings, bullets, bold/italic/code/links.
function md(src) {
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out = []; let inList = false;
  for (const line of src.split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)/), b = line.match(/^\s*[-*]\s+(.*)/);
    if (b) { if (!inList) { out.push('<ul>'); inList = true; }
             out.push('<li>' + inline(b[1]) + '</li>'); continue; }
    if (inList) { out.push('</ul>'); inList = false; }
    if (h) out.push(`<h${h[1].length}>` + inline(h[2]) + `</h${h[1].length}>`);
    else if (line.trim()) out.push('<p>' + inline(line) + '</p>');
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

async function api(path, body) {
  const r = await fetch(path, body ? {method:'POST', body: JSON.stringify(body)} : {});
  const j = await r.json();
  if (!r.ok) { toast('Error: ' + j.error); throw new Error(j.error); }
  if (j.state) S = j.state;
  return j;
}

function card(f, {archivable=false} = {}) {
  const isEd = editing.has(f.path);
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `<h3>${esc(f.name.replace(/\.md$/,''))}</h3>
    <div class="meta">${esc(f.path)}</div>
    <div class="body"></div><div class="bar"></div>`;
  const body = div.querySelector('.body'), bar = div.querySelector('.bar');
  if (isEd) {
    const ta = document.createElement('textarea');
    ta.value = f.content; body.appendChild(ta);
    bar.appendChild(btn('Save', 'act primary', async () => {
      await api('/api/save', {path: f.path, content: ta.value});
      editing.delete(f.path); toast('Saved'); render();
    }));
    bar.appendChild(btn('Cancel', 'act', () => { editing.delete(f.path); render(); }));
  } else {
    body.innerHTML = '<div class="md">' + md(f.content) + '</div>';
    bar.appendChild(btn('Edit', 'act', () => { editing.add(f.path); render(); }));
    if (archivable) bar.appendChild(btn('Archive', 'act danger', async () => {
      await api('/api/archive', {path: f.path}); toast('Archived'); render();
    }));
  }
  return div;
}

function btn(label, cls, fn) {
  const b = document.createElement('button');
  b.textContent = label; b.className = cls; b.onclick = fn; return b;
}

function quickAdd() {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `<h3>Quick add</h3>
    <div class="meta">Paste a Keep reflection from a claude.ai chat, or jot a note.</div>
    <p><input type="text" id="qa-title" placeholder="Title (e.g. Chat about ScorePro pricing)"></p>
    <textarea id="qa-body" placeholder="- bullet points…"></textarea>
    <div class="bar"></div>`;
  div.querySelector('.bar').appendChild(btn('Add to journal', 'act primary', async () => {
    const title = div.querySelector('#qa-title').value.trim();
    const content = div.querySelector('#qa-body').value.trim();
    if (!content) return toast('Nothing to add');
    await api('/api/add', {title: title || 'note', content, source: 'claude.ai chat / by hand'});
    toast('Kept'); render();
  }));
  return div;
}

function render() {
  const tabs = ['Journal', 'Profile', 'Index', 'Projects', 'Archive'];
  const nav = document.getElementById('tabs');
  nav.replaceChildren(...tabs.map(t => {
    const counts = {Journal: S.journal.length, Projects: S.projects.length,
                    Archive: S.archive.length};
    const b = btn(t + (counts[t] != null ? ` · ${counts[t]}` : ''),
                  t === tab ? 'on' : '', () => { tab = t; render(); });
    return b;
  }));

  const tended = document.getElementById('tended');
  tended.textContent = S.lastTended
    ? `last tended ${S.lastTended}` : 'never tended';
  const tb = btn('Mark tended', 'act', async () => {
    await api('/api/tended'); toast('Tended 🌱'); render();
  });
  tended.appendChild(tb);

  const main = document.getElementById('main');
  main.replaceChildren();
  const hint = txt => { const d = document.createElement('div');
                        d.className = 'hint'; d.textContent = txt; main.appendChild(d); };

  if (tab === 'Journal') {
    main.appendChild(quickAdd());
    hint('Raw memory, newest first. Promote what lasts into Profile or a ' +
         'project file (copy the fact over, then archive the entry).');
    S.journal.forEach(f => main.appendChild(card(f, {archivable: true})));
    if (!S.journal.length) hint('No journal entries yet.');
  } else if (tab === 'Profile') {
    hint('Distilled memory about Chris. Keep it short, dated, and true.');
    main.appendChild(card(S.top.find(f => f.name === 'profile.md')));
  } else if (tab === 'Index') {
    hint('The map Claude reads at the start of every session. Under a page, always.');
    main.appendChild(card(S.top.find(f => f.name === 'index.md')));
  } else if (tab === 'Projects') {
    hint('One file per project: state, decisions, next steps.');
    S.projects.forEach(f => main.appendChild(card(f)));
    if (!S.projects.length) hint('No project files yet.');
  } else if (tab === 'Archive') {
    hint('Retired entries. The Keep forgets gracefully — prune whenever you like.');
    S.archive.forEach(f => main.appendChild(card(f)));
    if (!S.archive.length) hint('Nothing archived yet.');
  }
}

api('/api/state').then(j => { S = j; render(); });
</script>
</body>
</html>
"""


def main():
    if not KEEP_DIR.is_dir():
        sys.exit(f"Keep directory not found: {KEEP_DIR}")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"The Keep — tending dashboard\n  {url}\n  keep: {KEEP_DIR}\n"
          "Ctrl-C to close.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nTended. 🌱")


if __name__ == "__main__":
    main()
