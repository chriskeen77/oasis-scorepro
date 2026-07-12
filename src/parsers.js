// A parsed document: { title, chapters: [{ title, text }] }
// pdfjs-dist and jszip are heavy, so they load lazily when first needed.

async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (import.meta.env.VITE_SINGLEFILE) {
    // Single-file build (artifact): no separate worker file can be served, so
    // import the worker module on the main thread — it registers
    // globalThis.pdfjsWorker, which pdf.js picks up as its "fake worker".
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
  } else {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  return pdfjsLib;
}

const baseName = (name) => name.replace(/\.[^.]+$/, "");

export function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ---------- Markdown ----------

export function stripMarkdown(md) {
  return (
    md
      // fenced code blocks — drop entirely, code is unreadable at RSVP speeds
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/~~~[\s\S]*?~~~/g, " ")
      // html tags
      .replace(/<[^>\n]+>/g, " ")
      // images: keep alt text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      // links: keep link text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      // reference link definitions
      .replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, "")
      // headings, blockquotes, list markers
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+[.)]\s+/gm, "")
      // horizontal rules
      .replace(/^\s*([-*_]\s*){3,}$/gm, "")
      // tables: drop separator rows, turn pipes into spaces
      .replace(/^\s*\|?[\s:|-]+\|[\s:|-]+$/gm, "")
      .replace(/\|/g, " ")
      // emphasis / inline code / strikethrough
      .replace(/(\*\*\*|\*\*|\*|___|__|_|~~|`)/g, "")
      .replace(/[ \t]+/g, " ")
  );
}

function parseMarkdown(raw, fallbackTitle) {
  // Split into chapters on top-level headings (# or ##)
  const lines = raw.split("\n");
  const chapters = [];
  let current = { title: null, lines: [] };
  for (const line of lines) {
    const m = line.match(/^#{1,2}\s+(.+?)\s*#*\s*$/);
    if (m) {
      if (current.lines.some((l) => l.trim())) chapters.push(current);
      current = { title: m[1].replace(/[*_`]/g, ""), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((l) => l.trim()) || chapters.length === 0) {
    chapters.push(current);
  }
  const parsed = chapters
    .map((c, i) => ({
      title: c.title || (i === 0 ? "Beginning" : `Section ${i + 1}`),
      text: stripMarkdown(c.lines.join("\n")),
    }))
    .filter((c) => countWords(c.text) > 0);
  // A heading with no body (e.g. title-only doc) — fall back to whole text
  if (parsed.length === 0) {
    return { title: fallbackTitle, chapters: [{ title: fallbackTitle, text: stripMarkdown(raw) }] };
  }
  const docTitle = chapters.length && chapters[0].title ? chapters[0].title : fallbackTitle;
  return { title: fallbackTitle || docTitle, chapters: parsed };
}

// ---------- HTML ----------

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, nav, noscript").forEach((el) => el.remove());
  // Block elements should break words apart
  doc.querySelectorAll("p, div, br, li, h1, h2, h3, h4, h5, h6, tr, blockquote").forEach((el) =>
    el.appendChild(doc.createTextNode(" "))
  );
  return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
}

// ---------- PDF ----------

async function parsePdf(file) {
  const pdfjsLib = await loadPdfjs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageTexts = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
    pageTexts.push(text);
  }
  let title = baseName(file.name);
  try {
    const meta = await pdf.getMetadata();
    if (meta?.info?.Title && meta.info.Title.trim()) title = meta.info.Title.trim();
  } catch {
    // metadata is optional
  }
  const full = pageTexts.join("\n").replace(/-\n(?=[a-z])/g, "").replace(/\s+/g, " ").trim();
  return { title, chapters: [{ title, text: full }] };
}

// ---------- EPUB ----------

function findZipFile(zip, path) {
  if (zip.file(path)) return zip.file(path);
  // Some epubs use inconsistent case or leading ./
  const clean = path.replace(/^\.\//, "");
  const lower = clean.toLowerCase();
  const match = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
  return match ? zip.file(match) : null;
}

function resolvePath(basePath, href) {
  const stack = basePath.split("/").slice(0, -1);
  for (const part of decodeURIComponent(href.split("#")[0]).split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

async function parseEpub(file) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const container = await findZipFile(zip, "META-INF/container.xml")?.async("string");
  if (!container) throw new Error("Not a valid EPUB (missing container.xml)");
  const containerDoc = new DOMParser().parseFromString(container, "application/xml");
  const rootfile = containerDoc.getElementsByTagName("rootfile")[0];
  const opfPath = rootfile?.getAttribute("full-path");
  if (!opfPath) throw new Error("Not a valid EPUB (no OPF package)");

  const opfXml = await findZipFile(zip, opfPath)?.async("string");
  if (!opfXml) throw new Error("Not a valid EPUB (OPF missing)");
  const opf = new DOMParser().parseFromString(opfXml, "application/xml");

  let title = baseName(file.name);
  const titleEl =
    opf.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "title")[0] ||
    opf.getElementsByTagName("dc:title")[0];
  if (titleEl?.textContent?.trim()) title = titleEl.textContent.trim();

  const manifest = {};
  for (const item of Array.from(opf.getElementsByTagName("item"))) {
    manifest[item.getAttribute("id")] = item.getAttribute("href");
  }

  const chapters = [];
  for (const ref of Array.from(opf.getElementsByTagName("itemref"))) {
    const href = manifest[ref.getAttribute("idref")];
    if (!href) continue;
    const entry = findZipFile(zip, resolvePath(opfPath, href));
    if (!entry) continue;
    const html = await entry.async("string");
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style").forEach((el) => el.remove());
    const heading =
      doc.querySelector("h1, h2, h3")?.textContent?.trim() ||
      doc.querySelector("title")?.textContent?.trim();
    const text = htmlToText(html);
    if (countWords(text) < 5) continue; // skip covers, blank pages
    chapters.push({
      title: heading || `Chapter ${chapters.length + 1}`,
      text,
    });
  }
  if (chapters.length === 0) throw new Error("No readable text found in this EPUB");
  return { title, chapters };
}

// ---------- Entry point ----------

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".epub")) return parseEpub(file);
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".mdown")) {
    return parseMarkdown(await file.text(), baseName(file.name));
  }
  if (name.endsWith(".html") || name.endsWith(".htm") || name.endsWith(".xhtml")) {
    const text = htmlToText(await file.text());
    const title = baseName(file.name);
    return { title, chapters: [{ title, text }] };
  }
  // .txt and anything else that is text
  const text = await file.text();
  if (text.includes("\u0000")) throw new Error(`Unsupported file type: ${file.name}`);
  const title = baseName(file.name);
  return { title, chapters: [{ title, text }] };
}
