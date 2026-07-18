"""Dependency-free EPUB text extraction.

An EPUB is a zip of XHTML files plus an OPF manifest listing reading order.
We read the spine, strip each document to plain text, and use the first
heading (or the TOC title when available) as the chapter title. Good enough
for narration; layout-only front matter comes through as short chapters the
user can untick in the UI.
"""
import html
import io
import posixpath
import re
import zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree as ET

_NS = {
    "c": "urn:oasis:names:tc:opendocument:xmlns:container",
    "opf": "http://www.idpf.org/2007/opf",
    "dc": "http://purl.org/dc/elements/1.1/",
}

_SKIP_TAGS = {"script", "style", "head", "title"}
_BLOCK_TAGS = {
    "p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "tr", "blockquote", "section", "article",
}
_HEADING_TAGS = {"h1", "h2", "h3", "h4"}


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.heading = None
        self._skip_depth = 0
        self._heading_buf = None

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
        if tag in _BLOCK_TAGS:
            self.parts.append("\n")
        if tag in _HEADING_TAGS and self.heading is None:
            self._heading_buf = []

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
        if tag in _BLOCK_TAGS:
            self.parts.append("\n")
        if tag in _HEADING_TAGS and self._heading_buf is not None:
            text = " ".join("".join(self._heading_buf).split())
            if text:
                self.heading = text
            self._heading_buf = None

    def handle_data(self, data):
        if self._skip_depth:
            return
        self.parts.append(data)
        if self._heading_buf is not None:
            self._heading_buf.append(data)


def _html_to_text(markup):
    parser = _TextExtractor()
    parser.feed(markup)
    text = "".join(parser.parts)
    text = html.unescape(text)
    # Collapse whitespace but keep paragraph breaks.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{2,}", "\n\n", text)
    return text.strip(), parser.heading


def parse_epub(data: bytes):
    """Returns {"title": str, "chapters": [{"title": str, "text": str}]}."""
    zf = zipfile.ZipFile(io.BytesIO(data))

    container = ET.fromstring(zf.read("META-INF/container.xml"))
    rootfile = container.find(".//c:rootfile", _NS)
    if rootfile is None:
        raise ValueError("invalid EPUB: no rootfile in container.xml")
    opf_path = rootfile.get("full-path")
    opf_dir = posixpath.dirname(opf_path)
    opf = ET.fromstring(zf.read(opf_path))

    book_title = None
    title_el = opf.find(".//dc:title", _NS)
    if title_el is not None and title_el.text:
        book_title = title_el.text.strip()

    manifest = {}
    for item in opf.findall(".//opf:manifest/opf:item", _NS):
        manifest[item.get("id")] = item.get("href")

    chapters = []
    for itemref in opf.findall(".//opf:spine/opf:itemref", _NS):
        href = manifest.get(itemref.get("idref"))
        if not href:
            continue
        path = posixpath.normpath(posixpath.join(opf_dir, href)) if opf_dir else href
        try:
            markup = zf.read(path).decode("utf-8", errors="replace")
        except KeyError:
            continue
        text, heading = _html_to_text(markup)
        if not text:
            continue
        chapters.append({
            "title": heading or f"Chapter {len(chapters) + 1}",
            "text": text,
        })

    if not chapters:
        raise ValueError("no readable chapters found in EPUB")
    return {"title": book_title or "Untitled", "chapters": chapters}


_CHAPTER_HEADING_RE = re.compile(
    r"^\s*(chapter|part|book|prologue|epilogue|interlude)\b[^\n]{0,80}$",
    re.IGNORECASE | re.MULTILINE,
)


def split_plain_text_chapters(text):
    """Split pasted plain text on 'Chapter N'-style heading lines.

    Returns a list of {"title", "text"} dicts; a single chapter if no
    headings are found.
    """
    matches = list(_CHAPTER_HEADING_RE.finditer(text))
    if len(matches) < 2:
        return [{"title": "", "text": text}]
    chapters = []
    preamble = text[: matches[0].start()].strip()
    if preamble:
        chapters.append({"title": "Front matter", "text": preamble})
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.end():end].strip()
        title = " ".join(m.group(0).split())
        if body:
            chapters.append({"title": title, "text": f"{title}.\n\n{body}"})
    return chapters or [{"title": "", "text": text}]
