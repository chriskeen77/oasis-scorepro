"""Split long-form text into TTS-friendly chunks.

TTS models degrade on long inputs, so we split on sentence boundaries and
group sentences up to a character target. Paragraph breaks are preserved as
chunk boundaries so pauses land in natural places.
"""
import re

_SENTENCE_RE = re.compile(r"(?<=[.!?…])[\"'”’)\]]*\s+")
_ABBREV = {"mr.", "mrs.", "ms.", "dr.", "st.", "vs.", "etc.", "e.g.", "i.e.", "jr.", "sr.", "prof."}


def split_sentences(paragraph):
    parts = _SENTENCE_RE.split(paragraph.strip())
    # Re-join splits caused by common abbreviations.
    merged = []
    for part in parts:
        if merged and merged[-1].lower().rsplit(" ", 1)[-1] in _ABBREV:
            merged[-1] += " " + part
        else:
            merged.append(part)
    return [p.strip() for p in merged if p.strip()]


def _split_oversized(sentence, limit):
    """Break a single too-long sentence on commas/semicolons, then hard-wrap."""
    if len(sentence) <= limit:
        return [sentence]
    pieces, current = [], ""
    for frag in re.split(r"(?<=[,;:])\s+", sentence):
        if current and len(current) + len(frag) + 1 > limit:
            pieces.append(current)
            current = frag
        else:
            current = f"{current} {frag}".strip()
    if current:
        pieces.append(current)
    out = []
    for p in pieces:
        while len(p) > limit:
            cut = p.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            out.append(p[:cut])
            p = p[cut:].strip()
        if p:
            out.append(p)
    return out


def chunk_text(text, char_target=350):
    """Returns a list of (chunk_text, is_paragraph_end) tuples."""
    chunks = []
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    for para in paragraphs:
        para = re.sub(r"\s+", " ", para)
        current = ""
        sentences = []
        for s in split_sentences(para):
            sentences.extend(_split_oversized(s, char_target))
        for sentence in sentences:
            if current and len(current) + len(sentence) + 1 > char_target:
                chunks.append([current, False])
                current = sentence
            else:
                current = f"{current} {sentence}".strip()
        if current:
            chunks.append([current, False])
        if chunks:
            chunks[-1][1] = True  # paragraph end -> longer pause
    return [(c, end) for c, end in chunks]
