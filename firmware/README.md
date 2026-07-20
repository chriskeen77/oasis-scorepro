# Bookmark prototype firmware

Firmware for the round Bookmark prototype, targeting the
**Waveshare ESP32-S3-Touch-LCD-1.28** dev board (round 1.28" 240×240 touch
LCD + ESP32-S3 + battery charging on one $20 board).

## What it does

- Advertises over BLE as `Bookmark` and implements the protocol in
  [`../docs/BLE_PROTOCOL.md`](../docs/BLE_PROTOCOL.md) — the phone app uploads
  a chapter of text and controls playback.
- Flashes one word at a time (RSVP) with the ORP letter highlighted in orange,
  automatic pauses at punctuation and paragraph breaks, and a progress arc
  around the rim of the round screen.
- On-device controls: **tap** = play/pause, **drag up/down** = speed
  (live, 10 wpm per notch), **long-press** = light/dark theme.
- Remembers speed, theme, and reading position across power cycles (position
  resumes automatically when the app re-sends the same document).
- Keeps reading if the phone disconnects; dims the backlight when idle.

## Build & flash

1. Install [PlatformIO](https://platformio.org/) (VS Code extension or
   `pip install platformio`).
2. Plug the board in over USB-C. If it doesn't enumerate, hold **BOOT**,
   tap **RESET**, release **BOOT** to enter download mode.
3. From this `firmware/` directory:

   ```
   pio run -t upload
   pio device monitor        # serial log at 115200
   ```

## First-boot checklist

- Screen shows "Bookmark / waiting for phone…" → display + pins are good.
- Tap the screen and watch the serial log → touch is good.
- Scan from a BLE app (e.g. nRF Connect on Android) → you should see
  `Bookmark` advertising the `b00c…0001` service. Writing text per the
  protocol doc from nRF Connect works even before the phone app has its BLE
  layer — handy for bring-up.
- If the display is dark/garbled, double-check the pin map in `src/config.h`
  against the Waveshare wiki for your board revision.

## Battery

The board has an on-board Li-Po charger and an MX1.25 battery connector.
**Check polarity before plugging in a battery** — pre-wired Li-Po pigtails
from different vendors are wired both ways, and reversed polarity kills the
board. A 3.7 V 250 mAh pouch cell (502025 size) fits the puck form factor.

Battery percentage reported over BLE is estimated from the on-board voltage
divider on GPIO1; calibrate the multiplier in `batteryPct()` against a
multimeter reading for your unit.
