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

**Business framing — the Kindle model.** The phone app is a full product in
its own right; people will use bookmark.app whether or not they own the
puck. Structure: free app (breadth, funnel) → Bookmark+ subscription
(recurring revenue, works phone-only) → the puck as the premium physical
tier for the most engaged users. Consequences: launch the app publicly
*before* the Kickstarter to build the subscriber/email base; expect and
accept a modest hardware attach rate (~5–15% of engaged users, like
Kindle); app usage metrics become the campaign's proof of demand; and
subscription revenue no longer depends on hardware shipping. The free app
strengthens rather than cannibalizes the device pitch — app users learn the
notification-interruption problem firsthand; the puck is the answer.

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

## 9. Waterproofing decisions

- **Target spec: "rain and pocket proof" (IP54–IPX5), not IP68.** Real
  failure scenarios are rain, sweat, and splashes — nobody reads submerged,
  and capacitive touch misbehaves on a wet screen anyway. Don't join the
  IP68 arms race.
- **Qi-only charging on the production base model is the keystone:** no
  USB-C port = no hole = a fully glued/gasketed sealed monocoque, which can
  reach IP67 nearly for free. This upgrades wireless charging from
  convenience to engineering cornerstone. (If a USB-C port survives into
  production, use a sealed IPX7-rated connector + gasket, ~$1 BOM.)
- **The Pro rotating bezel works against sealing** — a rotating seam needs
  O-rings and tighter tolerances (solvable; every dive watch does it, but
  it's tooling iterations). Acceptable outcome: base model carries the
  higher water rating; Pro trades some of it for the tactile dial. Decide
  consciously, before tooling.
- **Conformal-coat the PCB in every version** (sprayed protective film,
  pennies/unit) — cheap insurance so a splash that sneaks in doesn't kill
  the board. Do this even on garage-built units.
- **Claims discipline:** IP ratings are marketing claims, not certifications
  — only print numbers a lab has verified (IP tests ≈ $1–5k per enclosure
  revision). Market as "water-resistant (IPX5)", never a bigger number than
  tested, and don't exclude water damage from warranty while advertising a
  rating.
- **Timing:** irrelevant for the 3D-printed prototype (printed cases leak by
  nature). Must be decided **before production tooling** — gasket channels
  and glue grooves are mold features. Lock the enclosure before paying for
  IP testing; every revision re-tests.

## 10. IP & legal checklist

- **Freedom-to-operate check on Spritz patents (priority).** Spritz Inc.
  patented aspects of RSVP display with ORP letter alignment (~2014, likely
  still in force). Before taking public money for a device whose signature
  feature is ORP-highlighted flashing, get a patent attorney's opinion.
- **Kickstarter launch = public disclosure.** The US allows a 12-month grace
  period to file after disclosure; most other countries have absolute
  novelty — foreign patent rights die at launch. If any patent filing is
  wanted, file a **provisional** (cheap, buys 12 months of "patent
  pending") *before* the campaign goes live.
- **Naming:** "Bookmark" is generic — weak trademark, unwinnable SEO.
  Choose a distinctive brand or coined name before printing anything.
- Business basics before preorders: LLC, product liability insurance
  (battery device), returns/warranty policy, sales-tax handling.

## 11. Content strategy (the Kindle question)

Kindle books are DRM-locked and stay off-limits: DMCA anti-circumvention
makes DRM stripping illegal even for owned books — the company never builds
around it or winks at it. Workarounds, in order of daily-use value:

1. **Articles/newsletters/web — the killer source, all DRM-free.** Android
   share-sheet target + browser extension ("Read on Bookmark"), plus a
   personal forwarding email address (send-to-Kindle style) for
   newsletters. Most people's daily reading is this, not novels, and RSVP
   suits a long article even better than a book chapter.
2. **Public domain in-app catalog:** Project Gutenberg (70k+ books) and
   Standard Ebooks (beautiful formatting) — a full free library on day one,
   zero licensing cost.
3. **DRM-free stores:** Tor, Baen, Smashwords, Leanpub, Humble Bundles,
   indie authors — "works with every DRM-free EPUB."
4. **Web serials & fanfiction:** AO3 (open EPUB downloads), Royal Road —
   huge, voracious, underserved communities.
5. **Personal documents:** EPUB/TXT/PDF extraction, paste-from-clipboard.
6. **Later:** publisher/affiliate partnerships once hardware has shipped.

**Positioning:** never a Kindle replacement — the device for *everything
you read that isn't a Kindle book*. FAQ framing: "Bookmark reads anything
DRM-free — articles, newsletters, EPUBs, 70,000 free classics. It can't
open books locked to Amazon's ecosystem; no device except a Kindle legally
can." Every source above flows through the app — which is the real moat
(a cloned puck without the content pipeline is just a blinking screen).

## 12. Monetization — subscription layer

The user owns three AI book-generation apps (**Storybooks, Storytales,
Book Loom**) — existing assets that become the recurring-revenue layer on
top of hardware sales.

- **Model:** device is a one-time purchase and must remain fully useful
  forever without paying (own EPUBs, articles, public-domain catalog —
  free, always). The subscription (**"Bookmark+"**, ~$5–8/mo) sells
  *content creation*, never core reading — paywalling reading is the
  review that kills hardware products.
- **Subscription features:** AI story/book generation (from the existing
  apps), and an **AI daily briefing** — NOT AI-generated "news"
  (hallucination liability) but real articles from user-chosen feeds,
  summarized and stitched into one five-minute morning read with sources
  credited. The briefing is the retention engine: subscriptions survive on
  daily habits, and stories alone are occasional-use.
- **Economics:** hardware margin ~$50 once; a subscriber adds $60–96/yr
  recurring. Watch inference costs as COGS — cap generation volume by
  tier, use cheap models for briefings, know per-user cost before pricing.
  Don't promise users legal "ownership" of AI-generated books (murky
  copyright status); "for personal use" framing.
- **Briefing pipeline (generate once, serve everyone):** (1) scheduled
  morning job fetches real articles from RSS/news APIs — the model must
  summarize real reporting, never write "news" from memory; (2) **Opus**
  (`claude-opus-4-8`) writes the master sections once daily (~$1–2/day
  fixed regardless of subscriber count; use the API's Batch mode for 50%
  off since nobody is waiting); (3) serving the finished text to
  subscribers is a plain server/CDN fetch — **no AI in distribution**;
  (4) optional per-user personalization with **Haiku**
  (`claude-haiku-4-5`) assembling custom editions from the master
  sections (~1.5¢/user/day). Fixed cost ~$20–50/mo + pennies per
  subscriber — margins work from the first hundred subscribers.
- **Kickstarter tie-in:** pledge tiers bundling "device + 1 year of
  Bookmark+" — high perceived value, near-zero marginal cost, and
  recurring revenue makes the business fundable beyond the campaign.
- **App consolidation:** fold the three generator apps into one Bookmark
  content-hub app (Read + Library + Create tabs, one subscription, one
  brand) rather than maintaining four codebases/brands; existing apps
  become the feature backlog or export-to-Bookmark feeders.

## 13. Immediate next actions

1. Order the Waveshare board + battery + magnet rings.
2. Compile & flash `firmware/` (fix any first-build library mismatches).
3. Validate device with nRF Connect per `docs/BLE_PROTOCOL.md`.
4. Write the Android BLE layer against the protocol doc.
5. Print the case, assemble, film the first demo.
