"""Tiny YAML-frontmatter helpers (no external deps).

Kept dependency-free so the nightly job stays light. Handles the simple
frontmatter we use: scalars and flat lists of strings.
"""
from __future__ import annotations

import re


def build_note(fm: dict, body: str) -> str:
    """Render a markdown note string from a frontmatter dict + body."""
    lines = ["---"]
    for key, val in fm.items():
        if isinstance(val, list):
            if not val:
                lines.append(f"{key}: []")
            else:
                inner = ", ".join(_yaml_scalar(v) for v in val)
                lines.append(f"{key}: [{inner}]")
        else:
            lines.append(f"{key}: {_yaml_scalar(val)}")
    lines.append("---")
    lines.append("")
    lines.append(body.rstrip() + "\n")
    return "\n".join(lines)


def _yaml_scalar(v) -> str:
    s = "" if v is None else str(v)
    # Quote values that contain characters YAML would misread.
    if s == "" or re.search(r'[:#\[\]{}",]', s) or s.strip() != s:
        return '"' + s.replace('"', '\\"') + '"'
    return s


def split_frontmatter(text: str) -> tuple[dict, str]:
    """Return (frontmatter_dict, body). Best-effort parse of our own format."""
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.DOTALL)
    if not m:
        return {}, text
    fm: dict = {}
    for line in m.group(1).splitlines():
        if not line.strip() or ":" not in line:
            continue
        key, _, raw = line.partition(":")
        raw = raw.strip()
        if raw.startswith("[") and raw.endswith("]"):
            items = [i.strip().strip('"').strip("'")
                     for i in raw[1:-1].split(",") if i.strip()]
            fm[key.strip()] = items
        else:
            fm[key.strip()] = raw.strip('"').strip("'")
    return fm, m.group(2)
