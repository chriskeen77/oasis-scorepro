// Bookmark — round RSVP speed-reading device, prototype firmware.
//
// Board: Waveshare ESP32-S3-Touch-LCD-1.28
// Role:  BLE peripheral. The phone app uploads text (see docs/BLE_PROTOCOL.md);
//        this firmware flashes it one word at a time with an ORP highlight.
// Controls on-device: tap = play/pause, vertical drag = speed,
//        long-press = light/dark theme.

#include <Arduino.h>
#include <Wire.h>
#include <Preferences.h>
#include <NimBLEDevice.h>

#include "config.h"
#include "lgfx_bookmark.h"
#include "cst816s.h"

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
static LGFX lcd;
static LGFX_Sprite canvas(&lcd);
static Preferences prefs;
static SemaphoreHandle_t stateMux;

struct AppState {
  // content (owned by phone, held in RAM)
  char    *text = nullptr;
  uint32_t textLen = 0;
  bool     receiving = false;
  uint32_t expectedLen = 0;
  uint16_t docId = 0;
  uint32_t totalWords = 0;
  bool     docLoaded = false;
  // playback (owned by device)
  bool     playing = false;
  uint16_t wpm = WPM_DEFAULT;
  uint32_t wordIndex = 0;
  uint32_t wordOffset = 0;   // byte offset of the word at wordIndex
  bool     lightTheme = false;
  bool     connected = false;
};
static AppState st;

// cross-task flags: BLE callbacks set these, loop() acts on them
static volatile bool needRender = false;
static volatile bool needNotify = false;
static volatile bool settingsDirty = false;

static uint32_t nextWordAt = 0;
static uint32_t lastNotifyAt = 0;
static uint32_t lastSaveAt = 0;
static uint32_t lastActivityAt = 0;
static bool     backlightDimmed = false;

static NimBLECharacteristic *chState = nullptr;

#define LOCK()   xSemaphoreTake(stateMux, portMAX_DELAY)
#define UNLOCK() xSemaphoreGive(stateMux)

// ---------------------------------------------------------------------------
// Word scanning — no index arrays; we scan the buffer directly. A full pass
// over a 96 KB buffer takes well under a millisecond on the S3.
// ---------------------------------------------------------------------------
static inline bool isWs(char c) {
  return c == ' ' || c == '\n' || c == '\r' || c == '\t';
}
static uint32_t skipSpace(uint32_t o) {
  while (o < st.textLen && isWs(st.text[o])) o++;
  return o;
}
static uint32_t wordEnd(uint32_t o) {
  while (o < st.textLen && !isWs(st.text[o])) o++;
  return o;
}
static uint32_t offsetForIndex(uint32_t idx) {
  uint32_t o = skipSpace(0);
  for (uint32_t i = 0; i < idx && o < st.textLen; i++) o = skipSpace(wordEnd(o));
  return o;
}
static uint32_t countWords() {
  uint32_t n = 0, o = skipSpace(0);
  while (o < st.textLen) { n++; o = skipSpace(wordEnd(o)); }
  return n;
}
// true if the gap after the word at `o` contains a blank line (paragraph break)
static bool paragraphAfter(uint32_t o) {
  uint32_t e = wordEnd(o);
  int newlines = 0;
  while (e < st.textLen && isWs(st.text[e])) {
    if (st.text[e] == '\n' && ++newlines >= 2) return true;
    e++;
  }
  return false;
}

// ---------------------------------------------------------------------------
// RSVP timing
// ---------------------------------------------------------------------------
static uint32_t delayForWord(const char *w, size_t len, bool paraAfter) {
  uint32_t base = 60000UL / st.wpm;
  float m = 1.0f;
  if (len >= 9) m *= 1.3f;                    // long words need a beat more
  size_t li = len;                            // last "real" char, skipping quotes
  while (li > 0 && (w[li-1] == '"' || w[li-1] == '\'' || w[li-1] == ')')) li--;
  char last = li ? w[li-1] : 0;
  if (last == '.' || last == '!' || last == '?') m *= 2.2f;
  else if (last == ',' || last == ';' || last == ':') m *= 1.6f;
  if (paraAfter) m *= 1.5f;
  return (uint32_t)(base * m);
}

// Optimal Recognition Point: the letter the eye should land on.
static size_t orpIndex(size_t len) {
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  size_t i = len * 3 / 10;
  return i < 1 ? 1 : i;
}

// ---------------------------------------------------------------------------
// Battery
// ---------------------------------------------------------------------------
static uint8_t batteryPct() {
  // On-board divider is ~1:3 — calibrate the multiplier against a multimeter.
  uint32_t mv = analogReadMilliVolts(PIN_BAT_ADC) * 3;
  if (mv <= 3300) return 0;
  if (mv >= 4200) return 100;
  return (uint8_t)((mv - 3300) / 9);
}

// ---------------------------------------------------------------------------
// Rendering (loop task only — never from BLE callbacks)
// ---------------------------------------------------------------------------
static const lgfx::IFont *kFonts[] = {
  &fonts::FreeSansBold24pt7b,
  &fonts::FreeSansBold18pt7b,
  &fonts::FreeSansBold12pt7b,
  &fonts::FreeSansBold9pt7b,
};

static void renderIdle() {
  uint32_t bg = st.lightTheme ? 0xFFFFFFu : 0x000000u;
  uint32_t fg = st.lightTheme ? 0x101010u : 0xE8E8E8u;
  uint32_t dim = st.lightTheme ? 0x909090u : 0x585858u;
  canvas.fillSprite(bg);
  canvas.setTextDatum(lgfx::middle_center);
  canvas.setFont(&fonts::FreeSansBold18pt7b);
  canvas.setTextColor(fg, bg);
  canvas.drawString("Bookmark", 120, 100);
  canvas.setFont(&fonts::Font2);
  canvas.setTextColor(dim, bg);
  canvas.drawString(st.connected ? "connected - send a book" : "waiting for phone...", 120, 145);
  canvas.pushSprite(0, 0);
}

static void renderWord() {
  if (!st.docLoaded) { renderIdle(); return; }

  uint32_t bg     = st.lightTheme ? 0xFFFFFFu : 0x000000u;
  uint32_t fg     = st.lightTheme ? 0x101010u : 0xE8E8E8u;
  uint32_t accent = 0xFF6A00u;                       // ORP letter
  uint32_t dim    = st.lightTheme ? 0xB0B0B0u : 0x404040u;

  canvas.fillSprite(bg);

  // word text, clamped to a sane display length
  char buf[40];
  uint32_t e = wordEnd(st.wordOffset);
  size_t len = e - st.wordOffset;
  if (len > sizeof(buf) - 1) len = sizeof(buf) - 1;
  memcpy(buf, &st.text[st.wordOffset], len);
  buf[len] = 0;

  // pick the largest font that fits the round screen's usable width
  canvas.setTextSize(1);
  const lgfx::IFont *font = kFonts[3];
  for (auto f : kFonts) {
    canvas.setFont(f);
    if (canvas.textWidth(buf) <= 200) { font = f; break; }
  }
  canvas.setFont(font);

  // split at the ORP letter and center that letter on screen
  size_t oi = orpIndex(len);
  char pre[40], orp[2], post[40];
  memcpy(pre, buf, oi); pre[oi] = 0;
  orp[0] = buf[oi]; orp[1] = 0;
  strncpy(post, buf + oi + 1, sizeof(post) - 1); post[sizeof(post) - 1] = 0;

  int preW = canvas.textWidth(pre);
  int orpW = canvas.textWidth(orp);
  int x = 120 - preW - orpW / 2;
  canvas.setTextDatum(lgfx::middle_left);
  canvas.setTextColor(fg, bg);
  canvas.drawString(pre, x, 120);
  canvas.setTextColor(accent, bg);
  canvas.drawString(orp, x + preW, 120);
  canvas.setTextColor(fg, bg);
  canvas.drawString(post, x + preW + orpW, 120);

  // focus ticks above/below the ORP position
  canvas.fillTriangle(115, 66, 125, 66, 120, 76, dim);
  canvas.fillTriangle(115, 174, 125, 174, 120, 164, dim);

  // progress arc around the rim (12 o'clock, clockwise)
  if (st.totalWords > 1) {
    float progress = (float)st.wordIndex / (float)(st.totalWords - 1);
    canvas.fillArc(120, 120, 114, 119, -90.0f, -90.0f + 360.0f * progress, accent);
  }

  // status line: speed, or paused hint
  canvas.setFont(&fonts::Font2);
  canvas.setTextDatum(lgfx::middle_center);
  canvas.setTextColor(dim, bg);
  char hud[32];
  if (st.playing) snprintf(hud, sizeof(hud), "%u wpm", st.wpm);
  else            snprintf(hud, sizeof(hud), "|| %u wpm - tap to read", st.wpm);
  canvas.drawString(hud, 120, 200);

  canvas.pushSprite(0, 0);
}

// ---------------------------------------------------------------------------
// BLE
// ---------------------------------------------------------------------------
static void notifyState() {
  if (!chState) return;
  uint8_t b[14];
  b[0] = st.docId & 0xFF;         b[1] = st.docId >> 8;
  uint32_t wi = st.wordIndex;
  b[2] = wi; b[3] = wi >> 8; b[4] = wi >> 16; b[5] = wi >> 24;
  uint32_t tw = st.totalWords;
  b[6] = tw; b[7] = tw >> 8; b[8] = tw >> 16; b[9] = tw >> 24;
  b[10] = st.wpm & 0xFF;          b[11] = st.wpm >> 8;
  b[12] = (st.playing ? 1 : 0) | (st.lightTheme ? 2 : 0) | (st.docLoaded ? 4 : 0);
  b[13] = batteryPct();
  chState->setValue(b, sizeof(b));
  chState->notify();
}

static void saveSettings() {
  prefs.putUShort("wpm", st.wpm);
  prefs.putBool("light", st.lightTheme);
  prefs.putUShort("docId", st.docId);
  prefs.putUInt("wIdx", st.wordIndex);
}

class ServerCB : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *) override {
    LOCK(); st.connected = true; UNLOCK();
    needRender = true;
  }
  void onDisconnect(NimBLEServer *) override {
    LOCK(); st.connected = false; UNLOCK();
    settingsDirty = true;   // persist position now that the phone is gone
    needRender = true;
    NimBLEDevice::startAdvertising();
  }
};

class TextCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c) override {
    NimBLEAttValue v = c->getValue();
    LOCK();
    if (st.receiving && v.length() > 0) {
      uint32_t room = TEXT_BUF_MAX - st.textLen;
      uint32_t n = v.length() < room ? v.length() : room;
      memcpy(st.text + st.textLen, v.data(), n);
      st.textLen += n;
    }
    UNLOCK();
  }
};

class CtrlCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c) override {
    NimBLEAttValue v = c->getValue();
    if (v.length() < 1) return;
    const uint8_t *d = v.data();
    size_t n = v.length();
    LOCK();
    switch (d[0]) {
      case OP_PLAY:
        if (st.docLoaded) { st.playing = true; nextWordAt = 0; }
        break;
      case OP_PAUSE:
        st.playing = false; settingsDirty = true;
        break;
      case OP_TOGGLE:
        if (st.docLoaded) { st.playing = !st.playing; nextWordAt = 0; }
        if (!st.playing) settingsDirty = true;
        break;
      case OP_SET_WPM:
        if (n >= 3) {
          uint16_t w = d[1] | (d[2] << 8);
          st.wpm = constrain(w, WPM_MIN, WPM_MAX);
          settingsDirty = true;
        }
        break;
      case OP_SEEK:
        if (n >= 5 && st.docLoaded) {
          uint32_t idx = d[1] | (d[2] << 8) | ((uint32_t)d[3] << 16) | ((uint32_t)d[4] << 24);
          if (idx >= st.totalWords) idx = st.totalWords ? st.totalWords - 1 : 0;
          st.wordIndex = idx;
          st.wordOffset = offsetForIndex(idx);
          nextWordAt = 0;
        }
        break;
      case OP_THEME:
        if (n >= 2) { st.lightTheme = d[1] != 0; settingsDirty = true; }
        break;
      case OP_BEGIN_DOC:
        if (n >= 7) {
          st.docId = d[1] | (d[2] << 8);
          st.expectedLen = d[3] | (d[4] << 8) | ((uint32_t)d[5] << 16) | ((uint32_t)d[6] << 24);
          st.textLen = 0;
          st.totalWords = 0;
          st.docLoaded = false;
          st.playing = false;
          st.receiving = true;
        }
        break;
      case OP_END_DOC: {
        st.receiving = false;
        st.totalWords = countWords();
        st.docLoaded = st.totalWords > 0;
        // resume saved position if this is the doc we were reading before
        uint16_t savedDoc = prefs.getUShort("docId", 0);
        uint32_t savedIdx = prefs.getUInt("wIdx", 0);
        st.wordIndex = (st.docLoaded && savedDoc == st.docId && savedIdx < st.totalWords)
                         ? savedIdx : 0;
        st.wordOffset = offsetForIndex(st.wordIndex);
        settingsDirty = true;
        break;
      }
      case OP_REQ_STATE:
      default:
        break;   // unknown opcodes ignored for forward compatibility
    }
    UNLOCK();
    needRender = true;
    needNotify = true;
  }
};

static void bleInit() {
  NimBLEDevice::init(BLE_DEVICE_NAME);
  NimBLEDevice::setMTU(247);
  NimBLEDevice::setPower(ESP_PWR_LVL_P6);

  NimBLEServer *server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCB());

  NimBLEService *svc = server->createService(BOOKMARK_SVC_UUID);

  NimBLECharacteristic *chText = svc->createCharacteristic(
      BOOKMARK_TEXT_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  chText->setCallbacks(new TextCB());

  NimBLECharacteristic *chCtrl = svc->createCharacteristic(
      BOOKMARK_CTRL_UUID, NIMBLE_PROPERTY::WRITE);
  chCtrl->setCallbacks(new CtrlCB());

  chState = svc->createCharacteristic(
      BOOKMARK_STATE_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);

  NimBLECharacteristic *chInfo = svc->createCharacteristic(
      BOOKMARK_INFO_UUID, NIMBLE_PROPERTY::READ);
  char info[64];
  snprintf(info, sizeof(info), "proto=%d;fw=%s;buf=%d",
           PROTO_VERSION, FW_VERSION, TEXT_BUF_MAX);
  chInfo->setValue(info);

  svc->start();

  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(BOOKMARK_SVC_UUID);
  adv->setScanResponse(true);
  adv->start();
}

// ---------------------------------------------------------------------------
// Touch gestures: tap = play/pause, vertical drag = speed, long-press = theme
// ---------------------------------------------------------------------------
struct TouchTracker {
  bool down = false;
  int16_t startY = 0, lastY = 0;
  uint32_t downAt = 0;
  int totalDy = 0;
  int dragResidual = 0;
  bool moved = false;
  bool longFired = false;
};
static TouchTracker tt;

static void handleTouch(uint32_t now) {
  int16_t x, y;
  bool touching = cst816sRead(x, y);

  if (touching) {
    lastActivityAt = now;
    if (!tt.down) {
      tt = TouchTracker();
      tt.down = true;
      tt.startY = tt.lastY = y;
      tt.downAt = now;
    } else {
      int dy = y - tt.lastY;
      tt.lastY = y;
      tt.totalDy += dy;
      if (abs(tt.totalDy) > 10) tt.moved = true;
      if (tt.moved) {
        // live speed adjust: drag up = faster, down = slower
        tt.dragResidual += dy;
        while (tt.dragResidual <= -DRAG_NOTCH_PX) {
          tt.dragResidual += DRAG_NOTCH_PX;
          LOCK(); st.wpm = min((int)st.wpm + WPM_DRAG_STEP, WPM_MAX); UNLOCK();
          settingsDirty = true; needRender = true; needNotify = true;
        }
        while (tt.dragResidual >= DRAG_NOTCH_PX) {
          tt.dragResidual -= DRAG_NOTCH_PX;
          LOCK(); st.wpm = max((int)st.wpm - WPM_DRAG_STEP, WPM_MIN); UNLOCK();
          settingsDirty = true; needRender = true; needNotify = true;
        }
      } else if (!tt.longFired && now - tt.downAt >= LONGPRESS_MS) {
        tt.longFired = true;
        LOCK(); st.lightTheme = !st.lightTheme; UNLOCK();
        settingsDirty = true; needRender = true; needNotify = true;
      }
    }
  } else if (tt.down) {
    // release
    if (!tt.moved && !tt.longFired && now - tt.downAt <= TAP_MAX_MS) {
      LOCK();
      if (st.docLoaded) {
        st.playing = !st.playing;
        nextWordAt = 0;
        if (!st.playing) settingsDirty = true;
      }
      UNLOCK();
      needRender = true; needNotify = true;
    }
    tt.down = false;
  }
}

// ---------------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  stateMux = xSemaphoreCreateMutex();

  st.text = (char *)malloc(TEXT_BUF_MAX);
  if (!st.text) {
    Serial.println("FATAL: text buffer alloc failed");
    while (true) delay(1000);
  }

  prefs.begin("bookmark", false);
  st.wpm = constrain(prefs.getUShort("wpm", WPM_DEFAULT), WPM_MIN, WPM_MAX);
  st.lightTheme = prefs.getBool("light", false);
  st.docId = prefs.getUShort("docId", 0);

  lcd.init();
  lcd.setBrightness(BL_ACTIVE);
  canvas.setColorDepth(8);          // 8-bit sprite: 57 KB, fits internal RAM
  canvas.createSprite(240, 240);

  Wire.begin(PIN_TP_SDA, PIN_TP_SCL, 400000);
  cst816sInit();

  analogReadResolution(12);

  bleInit();

  lastActivityAt = millis();
  renderIdle();
  Serial.println("Bookmark ready");
}

void loop() {
  uint32_t now = millis();

  handleTouch(now);

  // advance the flashing word
  LOCK();
  bool advance = st.playing && st.docLoaded && (nextWordAt == 0 || now >= nextWordAt);
  if (advance) {
    if (nextWordAt != 0) {
      // move to next word (nextWordAt==0 means "just started: show current word")
      uint32_t nextOff = skipSpace(wordEnd(st.wordOffset));
      if (nextOff >= st.textLen) {
        st.playing = false;               // end of document
        settingsDirty = true;
        advance = false;
      } else {
        st.wordOffset = nextOff;
        st.wordIndex++;
      }
    }
    if (st.playing) {
      uint32_t e = wordEnd(st.wordOffset);
      nextWordAt = now + delayForWord(&st.text[st.wordOffset],
                                      e - st.wordOffset,
                                      paragraphAfter(st.wordOffset));
    }
    needRender = true;
  }
  bool playing = st.playing;
  UNLOCK();

  if (playing) lastActivityAt = now;

  // backlight management
  if (!playing && now - lastActivityAt > IDLE_DIM_MS) {
    if (!backlightDimmed) { lcd.setBrightness(BL_DIM); backlightDimmed = true; }
  } else if (backlightDimmed) {
    lcd.setBrightness(BL_ACTIVE);
    backlightDimmed = false;
  }

  if (needRender) {
    needRender = false;
    LOCK();
    renderWord();
    UNLOCK();
  }

  // state notifications: on demand, plus 1 Hz heartbeat while playing
  if (needNotify || (playing && now - lastNotifyAt >= 1000)) {
    needNotify = false;
    lastNotifyAt = now;
    LOCK();
    notifyState();
    UNLOCK();
  }

  // persist settings/position: when dirty and at most every 15 s while playing
  if (settingsDirty && (!playing || now - lastSaveAt >= 15000)) {
    settingsDirty = false;
    lastSaveAt = now;
    LOCK();
    saveSettings();
    UNLOCK();
  }

  delay(5);
}
