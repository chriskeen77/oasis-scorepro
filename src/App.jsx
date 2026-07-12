import { useState, useRef, useEffect } from "react";
import { parseFile, countWords } from "./parsers.js";

const SAMPLE = `The art of speed reading has fascinated researchers for decades. Traditional reading forces your eyes to scan left to right, line by line, wasting time on saccadic movements. But what if you could eliminate that entirely? Rapid Serial Visual Presentation, or RSVP, flashes words one at a time at a fixed point. Your eyes stay locked in place while your brain processes language at remarkable speeds. Most people read around 250 words per minute with traditional methods. With practice, RSVP readers can reach 500, 700, even 1000 words per minute while maintaining comprehension. The key is letting go of subvocalization — that inner voice that reads along with you. At higher speeds, your brain shifts from hearing words to absorbing meaning directly. Start slow, build confidence, and gradually increase your speed. You might be surprised how fast you can go.`;

const ACCEPT = ".txt,.md,.markdown,.mdown,.pdf,.epub,.html,.htm,.xhtml";

const Panel = ({ children, style }) => (
  <div style={{
    background: "rgba(12,18,30,0.75)", border: "1px solid rgba(51,65,85,0.5)",
    borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(12px)", ...style,
  }}>{children}</div>
);

const fmtTime = (words, wpm = 250) => {
  const mins = words / wpm;
  if (mins < 1) return "under a minute";
  if (mins < 60) return `~${Math.round(mins)} min`;
  return `~${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
};

export default function SpeedReader() {
  const [view, setView] = useState("input"); // input | reading
  const [text, setText] = useState(SAMPLE);
  const [doc, setDoc] = useState(null); // { title, chapters: [{title, text}] }
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [words, setWords] = useState([]);
  const [marks, setMarks] = useState([]); // chapter boundaries: [{start, title}]
  const [readingTitle, setReadingTitle] = useState("");
  const [docKey, setDocKey] = useState(null); // localStorage key for resume
  const [idx, setIdx] = useState(0);
  const [wpm, setWpm] = useState(0); // 0 = paused
  // Word brightness 0..1: lifts how bright the letters away from the focus point stay
  const [bright, setBright] = useState(() => {
    const s = parseFloat(localStorage.getItem("bookmark:brightness"));
    return Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0.75;
  });
  // Warm mode swaps the two reading palettes for a warmer environment:
  // words render amber while reading, cool white becomes the paused/reverse accent.
  const [warmMode, setWarmMode] = useState(() => localStorage.getItem("bookmark:warm") === "1");
  const timerRef = useRef(null);
  const sliderRef = useRef(null);
  const fileInputRef = useRef(null);
  const brightRef = useRef(null);
  const prevWpmRef = useRef(250);

  useEffect(() => {
    localStorage.setItem("bookmark:brightness", String(bright));
  }, [bright]);

  useEffect(() => {
    localStorage.setItem("bookmark:warm", warmMode ? "1" : "0");
  }, [warmMode]);

  const onBrightDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = brightRef.current;
    const apply = (ev) => {
      const rect = el?.getBoundingClientRect();
      if (!rect) return;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      setBright(1 - y);
    };
    apply(e);
    const move = (ev) => { ev.preventDefault(); apply(ev); };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
  };

  const MAX_WPM = 1000;
  const MIN_WPM = 60;
  const MID_WPM = 200; // reading speed at the slider's midpoint
  const REV_MAX = 600; // fastest reverse scrub speed
  // Slider zones: [0, REV_END) reverse · [REV_END, FWD_START) pause · [FWD_START, 1] forward
  const REV_END = 0.22;
  const FWD_START = 0.28;

  // Negative wpm means reading in reverse.
  const wpmFromSlider = (x) => {
    if (x < REV_END) {
      const t = (REV_END - x) / REV_END;
      return -Math.round(MIN_WPM + t * (REV_MAX - MIN_WPM));
    }
    if (x < FWD_START) return 0;
    if (x <= 0.5) return Math.round(MIN_WPM + ((x - FWD_START) / (0.5 - FWD_START)) * (MID_WPM - MIN_WPM));
    return Math.round(MID_WPM + ((x - 0.5) / 0.5) * (MAX_WPM - MID_WPM));
  };

  const sliderPos = (v) => {
    if (v === 0) return (REV_END + FWD_START) / 2;
    if (v < 0) return REV_END * (1 - (-v - MIN_WPM) / (REV_MAX - MIN_WPM));
    if (v <= MID_WPM) return FWD_START + ((v - MIN_WPM) / (MID_WPM - MIN_WPM)) * (0.5 - FWD_START);
    return 0.5 + ((v - MID_WPM) / (MAX_WPM - MID_WPM)) * 0.5;
  };

  const loadFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    try {
      const parsed = await parseFile(file);
      const total = parsed.chapters.reduce((n, c) => n + countWords(c.text), 0);
      if (total === 0) throw new Error("No readable text found in this file");
      setDoc(parsed);
    } catch (err) {
      setParseError(err.message || "Could not read this file");
      setDoc(null);
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files?.[0]);
  };

  // Begin reading. chapterIdx === null → whole document / pasted text
  const startReading = (chapterIdx = null) => {
    let w = [];
    let boundaries = [];
    let title = "";
    let key = null;
    if (doc) {
      const chapters = chapterIdx === null ? doc.chapters : [doc.chapters[chapterIdx]];
      for (const c of chapters) {
        const cw = c.text.trim().split(/\s+/).filter(Boolean);
        boundaries.push({ start: w.length, title: c.title });
        w = w.concat(cw);
      }
      title = doc.title;
      key = `bookmark:${doc.title}:${chapterIdx === null ? "all" : chapterIdx}:${w.length}`;
    } else {
      w = text.trim().split(/\s+/).filter(Boolean);
      boundaries = [{ start: 0, title: "" }];
      title = "Pasted text";
    }
    if (w.length === 0) return;
    setWords(w);
    setMarks(boundaries);
    setReadingTitle(title);
    setDocKey(key);
    let startAt = 0;
    if (key) {
      const saved = parseInt(localStorage.getItem(key) || "0", 10);
      if (saved > 0 && saved < w.length - 1) startAt = saved;
    }
    setIdx(startAt);
    setWpm(250);
    prevWpmRef.current = 250;
    setView("reading");
  };

  // Persist position so long documents resume where you left off
  useEffect(() => {
    if (view === "reading" && docKey) localStorage.setItem(docKey, String(idx));
  }, [idx, view, docKey]);

  // Timer loop
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (view !== "reading" || wpm === 0 || idx >= words.length) return;

    const ms = (60 / Math.abs(wpm)) * 1000;
    // Add slight pause for punctuation
    const word = words[idx] || "";
    const punct = /[.!?;:]$/.test(word) ? 1.6 : /[,]$/.test(word) ? 1.25 : 1;
    const delay = ms * punct;

    timerRef.current = setTimeout(() => {
      setIdx((i) => {
        if (wpm < 0) {
          if (i <= 0) {
            setWpm(0);
            return 0;
          }
          return i - 1;
        }
        if (i >= words.length - 1) {
          setWpm(0);
          return i;
        }
        return i + 1;
      });
    }, delay);

    return () => clearTimeout(timerRef.current);
  }, [idx, wpm, view, words]);

  const pct = words.length > 0 ? ((idx + 1) / words.length) * 100 : 0;
  const sliderPct = sliderPos(wpm) * 100;

  const [touching, setTouching] = useState(false);

  const onSliderDown = (e) => {
    e.preventDefault();
    setTouching(true);
    const el = sliderRef.current;
    const apply = (ev) => {
      const rect = el?.getBoundingClientRect();
      if (!rect) return;
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const v = wpmFromSlider(x);
      setWpm(v);
      if (v > 0) prevWpmRef.current = v;
    };
    apply(e);
    const move = (ev) => { ev.preventDefault(); apply(ev); };
    const up = () => {
      setTouching(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
  };

  const togglePause = () => {
    if (idx >= words.length - 1 && wpm >= 0) { restart(); return; }
    if (wpm === 0) {
      setWpm(prevWpmRef.current || 250);
    } else {
      if (wpm > 0) prevWpmRef.current = wpm;
      setWpm(0);
    }
  };

  // −40 / +40 move along the slider's axis: slower → pause → reverse, and back.
  const slowDown = () => {
    if (wpm > MIN_WPM) {
      const newWpm = Math.max(wpm - 40, MIN_WPM);
      setWpm(newWpm); prevWpmRef.current = newWpm;
    } else if (wpm > 0) {
      prevWpmRef.current = wpm;
      setWpm(0);
    } else if (wpm === 0) {
      if (idx > 0) setWpm(-MIN_WPM);
    } else {
      setWpm(Math.max(wpm - 40, -REV_MAX));
    }
  };

  const speedUp = () => {
    if (wpm < 0) {
      setWpm(wpm + 40 > -MIN_WPM ? 0 : wpm + 40);
    } else if (wpm === 0) {
      const newWpm = Math.min(prevWpmRef.current || 250, MAX_WPM);
      prevWpmRef.current = newWpm;
      setWpm(newWpm);
      if (idx >= words.length - 1) setIdx(0);
    } else {
      const newWpm = Math.min(wpm + 40, MAX_WPM);
      setWpm(newWpm);
      prevWpmRef.current = newWpm;
    }
  };

  const rewind10 = () => {
    const currentWpm = Math.abs(wpm) || prevWpmRef.current || 250;
    const wordsBack = Math.round((currentWpm / 60) * 10);
    setIdx((i) => Math.max(0, i - wordsBack));
  };

  const restart = () => { setIdx(0); if (wpm === 0) setWpm(prevWpmRef.current || 250); };
  const back = () => { setView("input"); setWpm(0); setIdx(0); };

  // Keyboard controls
  useEffect(() => {
    if (view !== "reading") return;
    const onKey = (e) => {
      if (e.key === " ") { e.preventDefault(); togglePause(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); rewind10(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); speedUp(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); slowDown(); }
      else if (e.key === "Escape") { back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Find the "focus letter" - roughly 1/3 into the word
  const currentWord = words[idx] || "";
  const focusIdx = Math.min(Math.floor(currentWord.length * 0.3), currentWord.length - 1);

  // Reverse and paused states shift the reading UI to the accent palette.
  // Default: reading = cool white, paused/reverse = amber. Warm mode inverts that.
  const rev = wpm < 0;
  const amber = warmMode ? !(rev || wpm === 0) : rev || wpm === 0;
  const accentRGB = warmMode ? "226,232,240" : "251,191,36"; // paused/reverse accent
  const accentHex = warmMode ? "#e2e8f0" : "#fbbf24";
  const nebulaCore = amber ? "251,191,36" : "255,255,255";
  const nebulaMid = amber ? "250,204,120" : "210,220,240";
  const nebulaEdge = amber ? "217,160,60" : "180,200,230";

  // Which chapter are we in right now?
  const currentMark = marks.reduce((acc, m) => (idx >= m.start ? m : acc), marks[0]);

  const totalDocWords = doc ? doc.chapters.reduce((n, c) => n + countWords(c.text), 0) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: "50vmax", height: "50vmax", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", top: "-15vmax", right: "-10vmax" }} />
        <div style={{ position: "absolute", width: "45vmax", height: "45vmax", background: "radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 70%)", bottom: "-12vmax", left: "-10vmax" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(148,163,184,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.02) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, height: "100vh", display: "flex", flexDirection: "column" }}>

        {/* INPUT VIEW */}
        {view === "input" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 600, margin: "0 auto", padding: "16px 16px", width: "100%", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ display: "inline-block", background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 100, padding: "4px 14px", fontSize: 10, fontWeight: 700, color: "#93c5fd", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                RSVP Reader
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
                <span style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>BookMark</span>
              </h1>
              <p style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Read books, PDFs, and articles word by word</p>
            </div>

            {/* Upload zone */}
            <input
              ref={fileInputRef} type="file" accept={ACCEPT} style={{ display: "none" }}
              onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                border: `1.5px dashed ${dragOver ? "#3b82f6" : "rgba(51,65,85,0.7)"}`,
                background: dragOver ? "rgba(59,130,246,0.08)" : "rgba(12,18,30,0.5)",
                borderRadius: 14, padding: "18px 16px", textAlign: "center", cursor: "pointer",
                marginBottom: 10, transition: "border-color 0.15s, background 0.15s",
              }}
            >
              {parsing ? (
                <div style={{ fontSize: 13, color: "#93c5fd", fontWeight: 600 }}>Reading file…</div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 3 }}>
                    Drop a file or tap to browse
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    EPUB &nbsp;·&nbsp; PDF &nbsp;·&nbsp; Markdown &nbsp;·&nbsp; HTML &nbsp;·&nbsp; TXT
                  </div>
                </>
              )}
            </div>

            {parseError && (
              <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>
                {parseError}
              </div>
            )}

            {/* Loaded document card */}
            {doc ? (
              <Panel style={{ flex: 1, display: "flex", flexDirection: "column", marginBottom: 10, minHeight: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {totalDocWords.toLocaleString()} words · {fmtTime(totalDocWords)} at 250 WPM
                    </div>
                  </div>
                  <button onClick={() => { setDoc(null); setParseError(null); }} style={{
                    background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.5)",
                    borderRadius: 8, color: "#94a3b8", padding: "4px 10px", fontSize: 11,
                    fontWeight: 600, cursor: "pointer", flexShrink: 0, marginLeft: 10,
                  }}>
                    ✕ Clear
                  </button>
                </div>

                {doc.chapters.length > 1 && (
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0, margin: "0 -6px", padding: "0 6px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, margin: "6px 0" }}>
                      {doc.chapters.length} chapters — tap one to read it
                    </div>
                    {doc.chapters.map((c, i) => (
                      <button key={i} onClick={() => startReading(i)} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                        width: "100%", textAlign: "left", background: "rgba(15,23,42,0.5)",
                        border: "1px solid rgba(51,65,85,0.35)", borderRadius: 8,
                        color: "#cbd5e1", padding: "9px 12px", fontSize: 13, cursor: "pointer",
                        marginBottom: 5, fontFamily: "inherit",
                      }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{c.title}</span>
                        <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{countWords(c.text).toLocaleString()} w</span>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            ) : (
              <Panel style={{ flex: 1, display: "flex", flexDirection: "column", marginBottom: 10, minHeight: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, display: "block" }}>
                  Or paste your text
                </label>
                <textarea
                  value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Paste a book chapter, article, or any text here..."
                  style={{
                    flex: 1, width: "100%", minHeight: 120, background: "rgba(15,23,42,0.6)",
                    border: "1px solid rgba(51,65,85,0.5)", borderRadius: 8, color: "#e2e8f0",
                    padding: 12, fontSize: 14, resize: "none", outline: "none", boxSizing: "border-box",
                    lineHeight: 1.6, fontFamily: "inherit",
                  }}
                />
                <div style={{ marginTop: 4, fontSize: 11, color: "#475569" }}>
                  {countWords(text)} words
                </div>
              </Panel>
            )}

            <button
              onClick={() => startReading(null)}
              disabled={parsing || (!doc && !text.trim())}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
                fontSize: 16, fontWeight: 700, cursor: doc || text.trim() ? "pointer" : "default", flexShrink: 0,
                background: doc || text.trim() ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "rgba(30,41,59,0.5)",
                color: doc || text.trim() ? "#fff" : "#475569",
                boxShadow: doc || text.trim() ? "0 4px 20px rgba(59,130,246,0.3)" : "none",
                marginBottom: 12, fontFamily: "inherit",
              }}
            >
              {doc && doc.chapters.length > 1 ? "Read Entire Book" : "Start Reading"}
            </button>
          </div>
        )}

        {/* READING VIEW */}
        {view === "reading" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
            {/* Top bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 8px", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={back} style={{
                  background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.5)",
                  borderRadius: 8, color: "#94a3b8", padding: "6px 14px", fontSize: 12,
                  fontWeight: 600, cursor: "pointer",
                }}>
                  ← Back
                </button>
                <button
                  aria-label="Warm mode"
                  onClick={() => setWarmMode((w) => !w)}
                  style={{
                    background: warmMode ? "rgba(251,146,60,0.15)" : "rgba(30,41,59,0.6)",
                    border: `1px solid ${warmMode ? "rgba(251,146,60,0.45)" : "rgba(51,65,85,0.5)"}`,
                    borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {warmMode ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="4"/>
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  )}
                </button>
              </div>
              <div style={{ minWidth: 0, textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{readingTitle}</div>
                {currentMark?.title && marks.length > 1 && (
                  <div style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentMark.title}</div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: wpm === 0 || rev ? accentHex : "#34d399" }}>
                  {wpm === 0 ? "Paused" : rev ? `◀ ${-wpm}` : `${wpm}`}
                  {wpm !== 0 && <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>WPM</span>}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ padding: "0 20px", marginBottom: 4 }}>
              <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 4, height: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: rev ? (warmMode ? "linear-gradient(90deg, #64748b, #e2e8f0)" : "linear-gradient(90deg, #b45309, #fbbf24)") : "linear-gradient(90deg, #3b82f6, #8b5cf6, #34d399)", borderRadius: 4, transition: "width 0.1s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#475569" }}>
                <span>{idx + 1} / {words.length}</span>
                <span>{fmtTime(words.length - idx, wpm > 0 ? wpm : prevWpmRef.current || 250)} left</span>
                <span>{Math.round(pct)}%</span>
              </div>
            </div>

            {/* Word display */}
            <div
              onClick={togglePause}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px", cursor: "pointer", userSelect: "none", position: "relative" }}
            >
              {/* Brightness slider — vertical, right edge */}
              <div
                aria-label="Brightness"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={onBrightDown}
                onTouchStart={onBrightDown}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  width: 36, height: 170, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 8, cursor: "pointer", touchAction: "none",
                  padding: "6px 0",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={amber ? "#fbbf24" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" opacity="0.7">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
                <div ref={brightRef} style={{ position: "relative", flex: 1, width: 3, borderRadius: 2, background: "rgba(51,65,85,0.5)" }}>
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: `${bright * 100}%`, borderRadius: 2,
                    background: amber
                      ? "linear-gradient(180deg, rgba(251,191,36,0.9), rgba(251,191,36,0.25))"
                      : "linear-gradient(180deg, rgba(248,250,252,0.9), rgba(148,163,184,0.25))",
                  }} />
                  <div style={{
                    position: "absolute", left: "50%", bottom: `${bright * 100}%`,
                    transform: "translate(-50%, 50%)",
                    width: 13, height: 13, borderRadius: "50%",
                    background: amber ? "#fbbf24" : "#e2e8f0",
                    boxShadow: `0 0 10px ${amber ? "rgba(251,191,36,0.5)" : "rgba(248,250,252,0.4)"}`,
                  }} />
                </div>
              </div>

              <div style={{ textAlign: "center", width: "100%" }}>
                {/* The word with focus letter highlighted */}
                <div style={{ position: "relative", display: "inline-block" }}>
                  <div style={{ fontSize: "clamp(28px, 9vw, 58px)", fontWeight: 700, letterSpacing: 3, fontFamily: "'Georgia', 'Times New Roman', serif", minHeight: "1.2em" }}>
                    {(() => {
                      const len = currentWord.length;
                      return currentWord.split("").map((ch, ci) => {
                        const dist = Math.abs(ci - focusIdx);
                        const maxDist = Math.max(focusIdx, len - 1 - focusIdx) || 1;
                        // Gradient: focal = bright warm white, edges fade to dim cool blue;
                        // amber when reversed or paused (matching the slider's pause bar).
                        // Brightness lifts the floor: at bright=0.5 this matches the
                        // original gradient; at 1 even edge letters stay near-focal.
                        const t = (1 - dist / maxDist) + (dist / maxDist) * 0.7 * bright;
                        const focal = amber ? [253, 230, 168] : [248, 250, 252];
                        const edge = amber ? [146, 96, 30] : [71, 85, 105];
                        const r = Math.round(focal[0] * t + edge[0] * (1 - t));
                        const g = Math.round(focal[1] * t + edge[1] * (1 - t));
                        const b = Math.round(focal[2] * t + edge[2] * (1 - t));
                        const opacity = 0.35 + 0.65 * t;
                        const glow = t > 0.7 ? `0 0 ${Math.round(t * 25)}px rgba(${focal[0]},${focal[1]},${focal[2]},${t * 0.3})` : "none";
                        return (
                          <span key={ci} style={{
                            color: `rgba(${r},${g},${b},${opacity})`,
                            textShadow: glow,
                          }}>{ch}</span>
                        );
                      });
                    })()}
                  </div>
                  <div style={{
                    position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
                    width: 3, height: 3, background: "rgba(248,250,252,0.3)", borderRadius: "50%",
                  }} />
                </div>

                {/* Tap hint */}
                {wpm === 0 && idx < words.length - 1 && (
                  <div style={{ marginTop: 24, fontSize: 13, color: "#475569", fontWeight: 500 }}>
                    Tap to resume · space bar works too
                  </div>
                )}

                {/* Done message */}
                {idx >= words.length - 1 && wpm === 0 && (
                  <div style={{ marginTop: 32 }}>
                    <div style={{ fontSize: 16, color: "#34d399", fontWeight: 700, marginBottom: 12 }}>Done!</div>
                    <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>Tap to restart</div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "0 20px 4px" }}>
              <button onClick={(e) => { e.stopPropagation(); rewind10(); }} style={{
                background: "rgba(12,18,30,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                borderRadius: 10, color: "#94a3b8", padding: "8px 18px", fontSize: 13,
                fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                10s
              </button>
              <button onClick={(e) => { e.stopPropagation(); slowDown(); }} style={{
                background: "rgba(12,18,30,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                borderRadius: 10, color: "#94a3b8", padding: "8px 18px", fontSize: 13,
                fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                opacity: wpm === 0 && idx === 0 ? 0.4 : 1,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M12 5l-7 7 7 7"/>
                </svg>
                −40
              </button>
              <button onClick={(e) => { e.stopPropagation(); speedUp(); }} style={{
                background: "rgba(12,18,30,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                borderRadius: 10, color: "#94a3b8", padding: "8px 18px", fontSize: 13,
                fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>
                +40
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M12 19l7-7-7-7"/>
                </svg>
              </button>
            </div>

            {/* Speed slider */}
            <div style={{ padding: "12px 20px 32px" }}>
              <div style={{
                background: "rgba(4,6,12,0.95)", border: "1px solid rgba(30,41,59,0.5)",
                borderRadius: 12, padding: 0, overflow: "hidden",
              }}>
                <div
                  ref={sliderRef}
                  onMouseDown={onSliderDown}
                  onTouchStart={onSliderDown}
                  style={{
                    position: "relative", height: 64, cursor: "pointer",
                    display: "flex", alignItems: "center", touchAction: "none",
                  }}
                >
                  {/* Subtle filled track */}
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${sliderPct}%`,
                    background: wpm === 0
                      ? "rgba(15,23,42,0.3)"
                      : `linear-gradient(90deg, rgba(${nebulaCore},0.01), rgba(${nebulaCore},0.03))`,
                    transition: touching ? "none" : "width 0.05s",
                  }} />

                  {/* Amber pause bar — marks the press-to-pause zone between reverse and forward */}
                  <div style={{
                    position: "absolute",
                    left: `${REV_END * 100}%`, width: `${(FWD_START - REV_END) * 100}%`,
                    top: "50%", transform: "translateY(-50%)", height: 4, borderRadius: 2,
                    background: wpm === 0 ? `rgba(${accentRGB},0.95)` : `rgba(${accentRGB},0.45)`,
                    boxShadow: wpm === 0 ? `0 0 12px rgba(${accentRGB},0.6)` : "none",
                    transition: "background 0.3s, box-shadow 0.3s",
                    pointerEvents: "none",
                  }} />

                  {/* Reverse-zone hint */}
                  <div style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    fontSize: 9, letterSpacing: 1, pointerEvents: "none",
                    color: rev ? `rgba(${accentRGB},0.75)` : "rgba(148,163,184,0.3)",
                    transition: "color 0.3s",
                  }}>◀◀</div>

                  {/* Nebula glow — wide diffuse cloud */}
                  <div style={{
                    position: "absolute",
                    left: `calc(${sliderPct}% - 60px)`,
                    top: -10, bottom: -10,
                    width: 120,
                    borderRadius: "50%",
                    background: wpm === 0
                      ? "radial-gradient(ellipse 100% 120%, rgba(148,163,184,0.15) 0%, rgba(120,140,170,0.08) 30%, transparent 65%)"
                      : touching
                        ? `radial-gradient(ellipse 100% 130%, rgba(${nebulaCore},0.4) 0%, rgba(${nebulaMid},0.18) 25%, rgba(${nebulaEdge},0.07) 50%, transparent 70%)`
                        : `radial-gradient(ellipse 100% 130%, rgba(${nebulaCore},0.25) 0%, rgba(${nebulaMid},0.12) 25%, rgba(${nebulaEdge},0.05) 50%, transparent 70%)`,
                    filter: "blur(8px)",
                    animation: touching ? "none" : "nebulaPulse 4s ease-in-out infinite",
                    transition: touching ? "left 0.02s" : "left 0.05s, background 0.5s",
                    pointerEvents: "none",
                  }} />

                  {/* Inner wisp — slightly brighter core drift */}
                  <div style={{
                    position: "absolute",
                    left: `calc(${sliderPct}% - 30px)`,
                    top: 2, bottom: 2,
                    width: 60,
                    borderRadius: "50%",
                    background: wpm === 0
                      ? "radial-gradient(ellipse 80% 100%, rgba(148,163,184,0.18) 0%, transparent 60%)"
                      : touching
                        ? `radial-gradient(ellipse 80% 110%, rgba(${nebulaCore},0.45) 0%, rgba(${nebulaMid},0.15) 35%, transparent 65%)`
                        : `radial-gradient(ellipse 80% 110%, rgba(${nebulaCore},0.28) 0%, rgba(${nebulaMid},0.1) 35%, transparent 65%)`,
                    filter: "blur(4px)",
                    animation: touching ? "none" : "nebulaPulse 4s ease-in-out infinite 0.5s",
                    transition: touching ? "left 0.02s" : "left 0.05s",
                    pointerEvents: "none",
                  }} />

                  {/* Faint star core */}
                  <div style={{
                    position: "absolute",
                    left: `calc(${sliderPct}% - 5px)`,
                    top: "50%", transform: "translateY(-50%)",
                    width: 10, height: 10,
                    borderRadius: "50%",
                    background: wpm === 0
                      ? "radial-gradient(circle, rgba(148,163,184,0.25) 0%, transparent 100%)"
                      : `radial-gradient(circle, rgba(${nebulaCore},0.8) 0%, rgba(${nebulaCore},0.2) 40%, transparent 100%)`,
                    filter: "blur(1px)",
                    animation: touching ? "none" : "nebulaPulse 4s ease-in-out infinite 1s",
                    transition: touching ? "left 0.02s" : "left 0.05s",
                    pointerEvents: "none",
                  }} />
                </div>

                <style>{`
                  @keyframes nebulaPulse {
                    0%, 100% { opacity: 0.45; }
                    50% { opacity: 1; }
                  }
                `}</style>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
