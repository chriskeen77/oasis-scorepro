# Getting Google Keep into the vault

**Important:** Google Keep is **not** reachable through the Google Drive MCP used
by this system. The MCP can read/search/create files in Drive, but it cannot see
Keep notes. So Keep notes have to be brought into Drive first. Here are the
options, best first.

## Why notes show up as "Untitled"

Keep notes frequently have **no title** (you type straight into the body). When a
titleless Keep note is exported/copied into Drive, it becomes `Untitled document`.
The fix is to **derive a title from the body at ingest time** — which is exactly
what the Ingestion Playbook does, and what the script below does too.

## Option A — Google Apps Script (recommended, automatable)

Apps Script can read Keep (via the Keep API on a Workspace account, or via the
mobile "share to Drive" pattern) and write titled markdown straight into the
vault's `00-Inbox/`. It also gives you the rename/move/delete the MCP lacks.

Sketch of the logic to implement in Apps Script (`script.google.com`):

```javascript
// Pseudocode — adapt to Keep API (Workspace) or a Keep export folder.
function ingestKeepToInbox() {
  const INBOX_ID = '1vw_1b9HMkStULkc2AXgqnBcoABbBif1a'; // 00-Inbox
  const inbox = DriveApp.getFolderById(INBOX_ID);

  getNewKeepNotes().forEach(note => {            // your source: API or export
    const body  = note.text.trim();
    const title = deriveTitle(body);             // never "Untitled"
    const md = [
      '---',
      `title: ${title}`,
      'type: note',
      'source: keep',
      `created: ${note.created.toISOString().slice(0,10)}`,
      'tags: [status/inbox, src/keep]',
      'related: []',
      '---',
      '',
      `# ${title}`,
      '',
      body,
    ].join('\n');

    // Write as a real .md file (not a Google Doc):
    inbox.createFile(`${title}.md`, md, 'text/markdown');
  });
}

function deriveTitle(body) {
  const firstLine = (body.split('\n').find(l => l.trim()) || 'Untitled note').trim();
  return firstLine.replace(/^#+\s*/, '').slice(0, 80) || 'Untitled note';
}
```

Run it on a **time-driven trigger** (e.g. daily). New Keep notes then arrive in
`00-Inbox/` already titled and tagged; the Ingestion Playbook does the linking.

## Option B — Google Takeout (one-time bulk import)

1. Go to **takeout.google.com**, export **Keep** only.
2. Keep exports as one HTML/JSON file per note. Drop the export into Drive.
3. Run the Ingestion Playbook (or a small script) to convert each into a titled
   `.md` in `00-Inbox/`.

Good for migrating your existing Keep backlog once.

## Option C — Manual "share to Drive"

On mobile, share a Keep note → Docs/Drive. Quick, but recreates the "Untitled"
problem, so only use it for one-offs and let the Ingestion Playbook clean up.

## Claude / Perplexity captures

These are easier: paste the chat/answer into a markdown file in `00-Inbox/`
(or have your capture automation write `.md` with `source: claude` /
`source: perplexity` in the frontmatter). The playbook handles the rest.
