# Bookmark — Project Brief

A complete summary of the product concept, every decision made so far, the
work already done, and the roadmap to a Kickstarter-ready prototype. Written
to hand off into any new working session with full context.

---

## 1. The product

**Bookmark** is a small dedicated speed-reading device. It pairs over
Bluetooth with a phone app (already built and working on Android). The app
holds the user's books and sends text to the device, which flashes one word
at a time — RSVP (Rapid Serial Visual Presentation) style — so the user
reads fast with zero eye movement and zero phone distractions.

**Pitch angle:** "the anti-phone for reading." A phone can run an RSVP app,
but it also carries every notification and temptation. Bookmark is a
single-purpose object that feels like reading, not like using a phone. The
name doubles as the sync feature: it always holds your place.

## 2. Form factor — decision history

- **Original idea:** a 3" × 0.75" handheld stick with a touch strip screen,
  USB-C, and a physical connector to the bottom of the phone for charging.
- **Final direction (chosen): a round magnetic puck** (~40 mm ⌀ × 8–12 mm)
  that snaps to the MagSafe/Qi2 magnet ring on the back of the phone for
  storage. Pull it off to read.

**Why the round puck won:**
- Solves "where does it live?" — it stores on the phone; detaching it is the
  signature product gesture (great for the Kickstarter video).
- Kills the custom phone-bottom connector (which would have meant Apple MFi
  certification, per-phone geometry problems, extra tooling). Production
  version charges via Qi wireless instead; prototype charges via USB-C.
- Uses the **smartwatch parts bin**: round 1.28–1.4" touch AMOLED/LCD panels
  are mass-produced and cheap, vs. a custom narrow strip display.
- Qi2 is bringing MagSafe-style magnet rings to Android — the concept is
  going cross-platform right on schedule.
- Enables great controls: tap, vertical drag for speed, potentially a
  rotating bezel in the production version.

**Known tradeoffs accepted:** shorter max word length on a round screen
(fine for single-word RSVP); the device is no longer literally shaped like a
bookmark (the name still works via the hold-your-place feature).

## 3. Display & interaction decisions

- **OLED/LCD, never e-ink** — e-ink refresh is far too slow for words
  flashing at 300–600 wpm. OLED also gives a perfect dark mode.
- **RSVP rendering:** ORP (Optimal Recognition Point) letter highlighted in
  orange and centered; longer pauses at punctuation and paragraph breaks;
  long words get extra display time; progress arc around the round rim.
- **Touch controls:** tap = play/pause · long-press = light/dark theme ·
  speed via the **click-wheel gesture** — finger circles the rim of the
  round screen like an iPod wheel (spec in `docs/SPEED_CONTROL.md`;
  supersedes the vertical-drag control currently in the firmware).
- Speed range 60–1200 wpm, default 300.
- **Bookmark Pro concept:** a physical magnetic rotating bezel with tactile
  detents as a premium-tier upgrade — parked until click-wheel user testing
  shows whether it's needed (see `docs/SPEED_CONTROL.md` §2).

## 4. Architecture decisions

- **Phone owns content; device owns playback.** Books never leave the app
  except as the current chapter, sent to the device's RAM. Position, speed,
  and theme are authoritative on the device (the user's hands are on it),
  and the app mirrors them from notifications. On conflict, the device wins.
- **Chapter-at-a-time sync** (up to 96 KB per document) rather than
  word-by-word streaming — so the device keeps working if the phone
  disconnects or locks, which also sidesteps iOS BLE backgrounding issues
  later.
- **BLE (Bluetooth Low Energy), custom GATT service.** Important: BLE
  accessories need **no Apple MFi certification** — the device will work
  with iPhones freely once the app is ported.
- The device persists speed/theme/position in flash and auto-resumes when
  the app re-sends the same document (documents are identified by a 16-bit
  `docId` hash chosen by the app).

## 5. What already exists

**The user's side:** a working Android RSVP reading app (built previously,
outside this repo). It needs a BLE client layer added — nothing else.

**In this repo (branch `claude/bookmark-speed-reading-fv9uqr`):**

| File | What it is |
|------|------------|
| `docs/BLE_PROTOCOL.md` | Full app↔device protocol v1: GATT UUIDs, CTRL opcodes, chunked text upload with flow control, 14-byte STATE notification, connect/resume/disconnect flows, Android/Kotlin sketch. Build the app's BLE layer against this. |
| `firmware/` | Complete PlatformIO project for the prototype board: RSVP engine, rendering, touch gestures, NimBLE peripheral implementing the protocol, NVS persistence, backlight management. |
| `docs/PROTOTYPE_GUIDE.md` | Parts list with prices, assembly steps, bring-up order. |
| `firmware/README.md` | Flash instructions, first-boot checklist, battery polarity warning. |

**Firmware status caveat:** written and host syntax/type-checked clean, but
not yet compiled with the real ESP32 toolchain or run on hardware (the
authoring sandbox couldn't reach the PlatformIO registry). Expect the first
`pio run` to possibly surface minor library API mismatches — structure and
logic are solid, but budget a first-flash debugging session. Libraries
pinned: `espressif32@6.5.0`, `NimBLE-Arduino@^1.4.1`, `LovyanGFX@^1.1.16`.

## 6. Prototype plan (~$40–60 total)

**Hardware:** Waveshare **ESP32-S3-Touch-LCD-1.28** dev board ($18–25) — a
~36 mm round board with 1.28" 240×240 touch LCD, ESP32-S3 (BLE), Li-Po
charging, USB-C: essentially the Bookmark's guts off the shelf. Plus a
3.7 V 250 mAh 502025 Li-Po ($6–10, **verify connector polarity — reversed
pigtails kill the board**), a stick-on MagSafe magnet ring ($6–10), and a
3D-printed two-piece puck case.

**Bring-up order (each step independently testable):**
1. Flash firmware over USB-C; verify screen, touch, BLE advertising.
2. Test the whole device with the free **nRF Connect** Android app per the
   protocol doc — before touching the app's code.
3. Add the BLE layer to the existing Android app; read a real chapter
   end-to-end. (On Android: request MTU 247, serialize GATT operations —
   Nordic's `android-ble-library` or Kable recommended.)
4. Battery + case + magnet ring → complete demo unit.

## 7. Cross-platform (decided, deferred)

The user is Android-first ("not an Apple guy") but iOS cannot be skipped for
launch: MagSafe users are the natural market and iPhones are 55–60% of US
phones. Plan: port the app once to **Flutter** (recommended for pixel-exact
text rendering; `flutter_blue_plus` for BLE) or React Native. iOS specifics:
$99/yr Apple Developer account; build via cloud CI (Codemagic / GitHub
Actions macOS runners) — no Mac ownership required; borrow one iPhone for
real-device BLE testing. Estimated: weeks if already cross-platform, up to
a couple of months if porting from native Android. Not needed for the
prototype or campaign filming — Android-only is fine until then.

## 8. Path to production & Kickstarter

**Estimated production costs (ballpark):** injection-mold tooling $15–50k;
certifications (FCC, CE, Bluetooth SIG, UN38.3 battery) $15–30k; realistic
all-in for a first production run **$100–250k**. Classic failure mode to
avoid: raising enough to build but not to certify, fulfill, and support —
budget those into the campaign goal.

**Production hardware evolves to:** custom PCB (same ESP32-S3 class chip +
same display family, so firmware and protocol carry over), Qi wireless
charging coil + magnet array (like every MagSafe battery pack), thinner
stack, possibly a rotating bezel for speed control.

**Campaign sequence:**
1. Finish the works-like prototype (section 6) — it plus the polished app is
   the core of the video.
2. User-test with ~10 people; watch finger placement and settled wpm.
3. Commission a "looks-like" model (resin/CNC, true production size) for
   photography — standard practice to shoot works-like and looks-like
   separately.
4. Get real tooling/cert quotes from a design-for-manufacture firm before
   setting the funding goal.
5. Launch with the "anti-phone for reading" story; the pull-off-the-phone
   gesture opens the video.

## 9. Immediate next actions

1. Order the Waveshare board + battery + magnet rings.
2. Compile & flash `firmware/` (fix any first-build library mismatches).
3. Validate device with nRF Connect per `docs/BLE_PROTOCOL.md`.
4. Write the Android BLE layer against the protocol doc.
5. Print the case, assemble, film the first demo.
