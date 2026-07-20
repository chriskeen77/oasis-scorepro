#pragma once

// Minimal CST816S capacitive touch driver (I2C addr 0x15).
// We read raw coordinates and do our own gesture detection in main.cpp —
// the chip's built-in gesture register varies between firmware revisions,
// raw points don't.

#include <Arduino.h>
#include <Wire.h>
#include "config.h"

#define CST816S_ADDR 0x15

inline void cst816sWriteReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(CST816S_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

inline void cst816sInit() {
  pinMode(PIN_TP_RST, OUTPUT);
  digitalWrite(PIN_TP_RST, LOW);
  delay(10);
  digitalWrite(PIN_TP_RST, HIGH);
  delay(80);
  // Disable auto-sleep so polling always sees touches (chip otherwise naps
  // after ~2 s and drops the first tap).
  cst816sWriteReg(0xFE, 0xFF);
}

// Returns true while a finger is on the panel; x/y in screen pixels.
inline bool cst816sRead(int16_t &x, int16_t &y) {
  Wire.beginTransmission(CST816S_ADDR);
  Wire.write(0x02);  // FingerNum register, XY follow
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)CST816S_ADDR, 5) != 5) return false;
  uint8_t fingers = Wire.read();
  uint8_t xh = Wire.read(), xl = Wire.read();
  uint8_t yh = Wire.read(), yl = Wire.read();
  if ((fingers & 0x0F) == 0) return false;
  x = ((xh & 0x0F) << 8) | xl;
  y = ((yh & 0x0F) << 8) | yl;
  return true;
}
