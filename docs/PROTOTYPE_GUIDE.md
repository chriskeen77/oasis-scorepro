# Bookmark — round prototype build guide

Goal: a working, hand-holdable round Bookmark that snaps magnetically to the
back of a phone, talks BLE to the existing Android app, and demos the full
reading experience. Total parts cost: **roughly $40–60**.

## Parts list

| Part | Approx. cost | Notes |
|------|--------------|-------|
| Waveshare **ESP32-S3-Touch-LCD-1.28** | $18–25 | The heart of the prototype: round 1.28" 240×240 touch LCD, ESP32-S3 (Wi-Fi/BLE), Li-Po charge circuit, USB-C — all on a ~36 mm round board |
| Li-Po battery, 3.7 V 250 mAh (502025) with MX1.25 plug | $6–10 | **Verify polarity against the board before plugging in** — vendor pigtails vary and reverse polarity is fatal to the board |
| MagSafe-compatible magnet ring (sticker type, 3M adhesive) | $6–10 | Sold as "universal MagSafe ring" 2-packs; sticks to the printed case back |
| 3D-printed enclosure | $0–15 | Two-piece puck: ring + back. Print at home, a library makerspace, or a print service |
| USB-C cable, misc | have already | Flashing + charging |

Nice-to-haves: a magnet-ready case for your Android phone (or a second ring
sticker for the phone itself), a spare board in case of battery-polarity
accidents.

## Assembly

1. **Flash first, assemble second.** Flash `firmware/` over USB-C and verify
   the screen, touch, and BLE advertising before anything goes in a case
   (see `firmware/README.md` first-boot checklist).
2. **Battery**: confirm polarity with a multimeter against the board's
   markings, then connect and confirm it charges (LED) and runs unplugged.
3. **Enclosure**: puck of ~40 mm diameter × ~12 mm. Back shell holds the
   battery flat against the board; front ring clamps the display edge.
   Leave a USB-C cutout for charging/reflashing.
4. **Magnet ring** sticks to the flat back of the case. Center it — MagSafe
   alignment is self-centering, so a centered ring snaps satisfyingly to the
   phone.

## Bring-up order (each step is independently testable)

1. Firmware on bare board — screen shows idle scene, touch toggles theme.
2. nRF Connect (free Android app) — connect, write a sentence via the TEXT
   characteristic per `docs/BLE_PROTOCOL.md`, send PLAY, watch it flash.
   This proves the whole device without touching your app's code.
3. Add the BLE layer to the Android app (protocol doc has the skeleton) —
   send a real chapter, read it end to end.
4. Battery + case + magnet ring — the actual product moment: pull it off the
   phone and read.

## What the prototype deliberately punts on

- **Wireless charging** — prototype charges via USB-C. The Qi coil comes with
  the custom PCB revision.
- **Custom PCB & thinness** — the dev board is ~2× thicker than a production
  puck would be. Fine for demos; the works-like video never shows calipers.
- **iOS app** — Android-first is fine for the prototype stage; the BLE
  protocol is already iOS-compatible (no MFi needed for BLE) whenever the
  cross-platform port happens.

## After the prototype works

1. **Film it.** Working prototype + polished app = the Kickstarter video core.
2. **User-test it.** Hand it to 10 people; watch where their fingers go and
   what speed they settle at. Cheap data that shapes the real industrial
   design.
3. **Then** talk to a design-for-manufacture partner about the custom board
   (same ESP32-S3 + display driver, plus Qi coil and magnet array) and real
   tooling/cert quotes. The firmware and protocol carry over nearly unchanged.
