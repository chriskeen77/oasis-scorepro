#!/usr/bin/env bash
# Install the Keep on this machine. Idempotent — safe to run again.
set -euo pipefail

KEEP_DIR="${KEEP_DIR:-$HOME/keep}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
MARKER="# --- the-keep ---"

echo "The Keep — installer"
echo

# 1. Put the Keep in place (skip if we're already running from it).
if [ "$SCRIPT_DIR" != "$KEEP_DIR" ]; then
  if [ -d "$KEEP_DIR" ]; then
    echo "• $KEEP_DIR already exists — leaving it alone (not overwriting memory)."
  else
    cp -r "$SCRIPT_DIR" "$KEEP_DIR"
    echo "• Copied the Keep to $KEEP_DIR"
  fi
else
  echo "• Running from $KEEP_DIR — files already in place."
fi

# 2. Install the slash commands globally.
mkdir -p "$CLAUDE_DIR/commands"
cp "$KEEP_DIR/commands/keep.md" "$CLAUDE_DIR/commands/keep.md"
cp "$KEEP_DIR/commands/recall.md" "$CLAUDE_DIR/commands/recall.md"
echo "• Installed /keep and /recall into $CLAUDE_DIR/commands/"

# 3. Point every Claude Code session at the Keep via global CLAUDE.md.
mkdir -p "$CLAUDE_DIR"
touch "$CLAUDE_DIR/CLAUDE.md"
if grep -qF "$MARKER" "$CLAUDE_DIR/CLAUDE.md"; then
  echo "• $CLAUDE_DIR/CLAUDE.md already points at the Keep."
else
  cat >> "$CLAUDE_DIR/CLAUDE.md" <<EOF

$MARKER
# The Keep (personal memory)
Chris has a personal memory system, the Keep, at $KEEP_DIR. At the start of
a session, read $KEEP_DIR/index.md to orient yourself; open profile.md and
the relevant projects/*.md file when useful. When Chris types /keep, write
the session's reflection there. Do not start from a blank slate.
$MARKER
EOF
  echo "• Added the Keep pointer to $CLAUDE_DIR/CLAUDE.md"
fi

# 4. Version the memory.
if [ ! -d "$KEEP_DIR/.git" ]; then
  git -C "$KEEP_DIR" init -q
  git -C "$KEEP_DIR" add -A
  git -C "$KEEP_DIR" commit -qm "keep: founding commit" || true
  echo "• Initialized git in $KEEP_DIR"
else
  echo "• $KEEP_DIR is already a git repo."
fi

echo
echo "Done. Try it:"
echo "  • In any Claude Code session: /recall   (orient)  and  /keep  (save)"
echo "  • Weekly tending: python3 $KEEP_DIR/dashboard.py"
