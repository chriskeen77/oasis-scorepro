# Bookmark — Speed Control Design

How the user changes reading speed. Two stages: a software **click-wheel
gesture** on the round touchscreen (build and test this first), and a
physical **magnetic rotating bezel** reserved as the Pro-tier feature if
testing shows the tactile version is worth it.

---

## 1. Click-wheel touch gesture (build this now)

The user slides a finger around the rim of the round display — like an iPod
wheel. Clockwise = faster, counterclockwise = slower. Center of the screen
stays tap-for-play/pause. Implemented entirely in firmware; replaces the
current vertical-drag speed control in `firmware/src/main.cpp`.

### Geometry (240×240 panel, center C = (120, 120))

- **Wheel zone:** annulus 70 px ≤ r ≤ 120 px from C. Touches that *start*
  here are wheel input.
- **Tap zone:** r < 70 px. Touches that start here are tap (play/pause) or
  long-press (theme) — unchanged behavior.
- A touch keeps its initial role for its whole life: a wheel touch that
  drifts inward stays a wheel touch; a center touch never becomes a wheel.

### Angle math

For each touch sample in the wheel zone:

```
angle = atan2(y - 120, x - 120)        // radians
delta = angle - prevAngle
if (delta >  π) delta -= 2π            // unwrap across the ±180° seam
if (delta < -π) delta += 2π
accum += delta
```

On-screen, clockwise rotation produces **increasing** angle with this
formula (y grows downward), so `accum > 0` = clockwise = faster.

### Step conversion

- **1 detent = 12° of rotation = ±10 wpm** (`accum` consumed in ±12°
  notches, same residual-consumption pattern as the current drag code).
- Full lap of the dial ≈ 30 detents = 300 wpm — big changes are one
  confident swirl, fine changes are a nudge.
- Clamp to the existing 60–1200 wpm range.

### Guards (what makes it feel solid instead of glitchy)

- **Activation travel:** the touch must move ≥ 8 px before any wheel steps
  fire — so a fingertip resting on the rim doesn't jitter the speed.
- **Sample sanity:** discard any single-frame `|delta|` > 90° (finger
  lift/rejoin or touch-controller glitch, not real motion).
- **No momentum/inertia.** The wheel stops when the finger stops. Reading
  speed is a precision setting, not a scroll view.
- **While playing:** the gesture works live without pausing — the word
  cadence simply changes. This is the point: speed up as you warm into a
  chapter without breaking flow.

### Feedback (no haptics on the prototype board)

- While a wheel touch is active, show the wpm readout large near the rim
  ("340 wpm"), fading out ~800 ms after release.
- Optional polish: a faint ring of tick marks in the wheel zone during the
  gesture, rotating with `accum`, so the dial feels physical.

### Test protocol (this gesture is an experiment — treat it like one)

Hand the device to ~10 people with no instructions beyond "make it faster."
Record: did they find the rim gesture unprompted? Did they overshoot? What
wpm did they settle at? Accidental speed changes while gripping?
**This data decides whether the Pro bezel is necessary or redundant.**

---

## 2. Magnetic rotating bezel — the Pro version

A free-spinning physical ring around the display with tactile detents.
Reserved for a **Bookmark Pro** tier, and only if click-wheel testing shows
people crave a physical dial. The hypothesis (worth validating, not
assuming): a real bezel would feel tactilely wonderful — the Galaxy-Watch
"click-click-click" — and could be the premium tier's signature feature.

### How it works (no electrical contacts, nothing to wear out)

- A multipole **ring magnet** embedded in the underside of the rotating
  bezel ring.
- Two **hall-effect sensors** on the PCB beneath, offset to produce
  quadrature — direction + step count, exactly like a rotary encoder but
  fully sealed. (Alternative: an off-axis magnetic angle sensor like the
  AS5600 for absolute position; quadrature halls are simpler and cheaper.)
- A small **spring-and-ball detent** between bezel and case provides the
  physical clicks; align detent spacing with magnetic pole spacing so every
  click = exactly one wpm step. The click *is* the feedback — no haptic
  motor needed.
- Firmware-wise it arrives as the same ±step events as the touch wheel —
  the two controls share one code path, so Pro and base firmware stay
  unified.

### Why it's the Pro tier and not the base model

- **BOM delta is small** (~$3–5: magnet ring, 2 hall sensors, detent
  hardware) but the **mechanical engineering is real**: bezel retention that
  spins freely for years without wobble, detent feel tuning, tolerance
  stack-up on the rotating seam. That's tooling iterations = money and time.
- Base model with touch wheel keeps the entry price low and the case a
  sealed monocoque (no moving parts, no seam for pocket lint).
- "Pro adds the machined rotating bezel" is a clean, honest upsell — same
  reader, luxury control — and a natural Kickstarter stretch-goal or
  premium pledge tier.

### Shared requirement for both controls: stow lockout

Any always-available speed control will get bumped in a pocket or while
snapping the puck on/off the phone magnet. Rule: **screen off or stowed =
controls locked; wake on detach, lift (IMU on the board), or tap.** Log this
in the firmware backlog now so it ships in both tiers.

---

## Decision status

- ✅ Prototype: implement the click-wheel gesture (section 1) — software
  only, on the board already ordered.
- 🧪 Gate: run the test protocol; the results decide the bezel's fate.
- 💤 Pro bezel (section 2): parked until that data exists. If the touch
  wheel tests great, the bezel may be unnecessary — that's a fine outcome
  and saves a mold.
