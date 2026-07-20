#pragma once

// ---------------------------------------------------------------------------
// Pin map: Waveshare ESP32-S3-Touch-LCD-1.28
// If anything misbehaves on first boot, verify against the board wiki:
// https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-1.28
// ---------------------------------------------------------------------------
#define PIN_LCD_SCLK 10
#define PIN_LCD_MOSI 11
#define PIN_LCD_MISO 12
#define PIN_LCD_DC    8
#define PIN_LCD_CS    9
#define PIN_LCD_RST  14
#define PIN_LCD_BL    2

#define PIN_TP_SDA    6
#define PIN_TP_SCL    7
#define PIN_TP_INT    5
#define PIN_TP_RST   13

#define PIN_BAT_ADC   1   // battery voltage through on-board divider (~1:3)

// ---------------------------------------------------------------------------
// BLE — must match docs/BLE_PROTOCOL.md and the phone app
// ---------------------------------------------------------------------------
#define BLE_DEVICE_NAME     "Bookmark"
#define BOOKMARK_SVC_UUID   "b00c0000-feed-4c0d-a5e1-000000000001"
#define BOOKMARK_TEXT_UUID  "b00c0000-feed-4c0d-a5e1-000000000002"
#define BOOKMARK_CTRL_UUID  "b00c0000-feed-4c0d-a5e1-000000000003"
#define BOOKMARK_STATE_UUID "b00c0000-feed-4c0d-a5e1-000000000004"
#define BOOKMARK_INFO_UUID  "b00c0000-feed-4c0d-a5e1-000000000005"

#define PROTO_VERSION 1
#define FW_VERSION    "0.1.0"

// Control opcodes (phone -> device)
#define OP_PLAY      0x01
#define OP_PAUSE     0x02
#define OP_TOGGLE    0x03
#define OP_SET_WPM   0x10
#define OP_SEEK      0x11
#define OP_THEME     0x12
#define OP_BEGIN_DOC 0x20
#define OP_END_DOC   0x21
#define OP_REQ_STATE 0x30

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
#define TEXT_BUF_MAX   (96 * 1024)  // document buffer; keep in sync with INFO buf=
#define WPM_MIN        60
#define WPM_MAX        1200
#define WPM_DEFAULT    300
#define WPM_DRAG_STEP  10           // wpm change per drag notch
#define DRAG_NOTCH_PX  12           // vertical pixels per notch
#define TAP_MAX_MS     350
#define LONGPRESS_MS   700
#define IDLE_DIM_MS    30000        // dim backlight after this long paused
#define BL_ACTIVE      210
#define BL_DIM         20
