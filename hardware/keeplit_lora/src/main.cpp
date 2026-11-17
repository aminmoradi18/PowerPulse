// KeepLit LoRa node: RFM96W (SX1278) on an ESP32-S3. Same firmware on both boards.
//
// Gateway role (board next to the laptop): the host gateway script writes a line "TX <frame>" on USB serial,
// the board sends <frame> over LoRa. It never decides anything itself.
//
// Device role (board in the village): it listens for frames
//   KL1|<device_id>|<on 0/1>|<periods_left>|<block_height>|<counter>|<mac>
//   mac = first 8 bytes of HMAC-SHA256(KEEPLIT_KEY, everything before "|<mac>"), in hex.
// A frame is accepted only if the id is ours, the mac is right and the counter is above the last accepted one
// (kept in flash), so a recorded frame cannot be replayed and nobody without the key can forge one.
// Then the power output follows <on>: RGB LED green + POWER_PIN high = power on, red + low = locked.
// If no valid frame arrives for GRACE_MS the device keeps its last state (a radio gap never cuts the power).
//
// Wiring as the earlier LoRa boards: SCK12 MISO13 MOSI11 NSS10 RST14, DIO0 not used (IRQ flags are polled).
#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include <Preferences.h>
#include <RadioLib.h>
#include <SPI.h>
#include "mbedtls/md.h"
#include "secret.h"

#define LORA_SCK 12
#define LORA_MISO 13
#define LORA_MOSI 11
#define LORA_NSS 10
#define LORA_RST 14
#define RGB_PIN 48    // on-board RGB LED of the ESP32-S3-DevKitC-1
#define POWER_PIN 4   // drives a relay / MOSFET for the lamp or pump (LED on a resistor for the demo)

#define FLAG_RX_DONE 0x40
#define FLAG_TX_DONE 0x08

SX1278 radio = new Module(LORA_NSS, RADIOLIB_NC, LORA_RST, RADIOLIB_NC);
Adafruit_NeoPixel rgb(1, RGB_PIN, NEO_GRB + NEO_KHZ800);
Preferences prefs;
String line;
bool ready = false, powerOn = false;
uint32_t lastPoll = 0, lastCounter = 0, lastRx = 0;

String mac(const String& msg) {
  uint8_t out[32];
  const mbedtls_md_info_t* md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_hmac(md, (const uint8_t*)KEEPLIT_KEY, strlen(KEEPLIT_KEY), (const uint8_t*)msg.c_str(), msg.length(), out);
  char hex[17];
  for (int i = 0; i < 8; i++) sprintf(hex + 2 * i, "%02x", out[i]);
  return String(hex);
}

void showPower() {
  digitalWrite(POWER_PIN, powerOn ? HIGH : LOW);
  rgb.setPixelColor(0, powerOn ? rgb.Color(0, 40, 0) : rgb.Color(40, 0, 0));
  rgb.show();
}

bool sendPacket(String msg) {
  if (radio.startTransmit(msg) != RADIOLIB_ERR_NONE) return false;
  uint32_t t0 = millis();
  while (!(radio.getIRQFlags() & FLAG_TX_DONE)) {
    if (millis() - t0 > 3000) { radio.finishTransmit(); return false; }
    delay(2);
  }
  radio.finishTransmit();
  return true;
}

// Split "a|b|c" into at most n parts.
int split(const String& s, String* parts, int n) {
  int count = 0, start = 0;
  while (count < n) {
    int bar = s.indexOf('|', start);
    if (bar < 0) { parts[count++] = s.substring(start); break; }
    parts[count++] = s.substring(start, bar);
    start = bar + 1;
  }
  return count;
}

void handleFrame(const String& frame, float rssi) {
  String p[7];
  if (split(frame, p, 7) != 7 || p[0] != "KL1") { Serial.printf("KL IGNORE %s\n", frame.c_str()); return; }
  if (p[1] != DEVICE_ID) { Serial.printf("KL OTHER %s\n", p[1].c_str()); return; }
  String body = frame.substring(0, frame.lastIndexOf('|'));
  if (mac(body) != p[6]) { Serial.printf("KL REJECT bad-mac %s\n", frame.c_str()); return; }
  uint32_t counter = p[5].toInt();
  if (counter <= lastCounter) { Serial.printf("KL REJECT replay counter %u <= %u\n", counter, lastCounter); return; }
  lastCounter = counter;
  prefs.putUInt("counter", counter);
  powerOn = p[2] == "1";
  prefs.putBool("on", powerOn);
  showPower();
  Serial.printf("KL ACCEPT on=%d periods=%s height=%s counter=%u RSSI %.0f\n", powerOn, p[3].c_str(), p[4].c_str(),
                counter, rssi);
}

void command(String c) {
  c.trim();
  if (c.startsWith("TX ")) {
    String frame = c.substring(3);
    bool ok = sendPacket(frame);
    Serial.printf("KL TX %s %s\n", frame.c_str(), ok ? "OK" : "FAIL");
    radio.startReceive();
  } else if (c == "reset-counter") {
    lastCounter = 0;
    prefs.putUInt("counter", 0);
    Serial.println("KL counter reset");
  } else if (c.startsWith("RX ")) {
    handleFrame(c.substring(3), 0);  // bench test without radio
  }
  Serial.printf("KL READY id %s on=%d counter=%u radio=%s\n", DEVICE_ID, powerOn, lastCounter, ready ? "ok" : "FAIL");
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  pinMode(POWER_PIN, OUTPUT);
  rgb.begin();
  prefs.begin("keeplit", false);
  lastCounter = prefs.getUInt("counter", 0);
  powerOn = prefs.getBool("on", false);
  showPower();
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  // 2 dBm: plenty on a desk, safe with an untuned wire antenna
  int st = radio.begin(433.0, 125.0, 9, 7, RADIOLIB_SX127X_SYNC_WORD, 2);
  ready = st == RADIOLIB_ERR_NONE;
  Serial.printf("KL BEGIN %d %s\n", st, ready ? "OK" : "FAIL (check wiring and 3.3V)");
  if (ready) radio.startReceive();
  command("");
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') { if (line.length()) command(line); line = ""; }
    else line += ch;
  }
  if (!ready) return;
  if (millis() - lastPoll > 20) {
    lastPoll = millis();
    // Re-arm the receiver if nothing arrived for a while (the gateway sends every 30 s): on the bench the
    // SX1278 sometimes stopped reporting packets until it was set up again.
    // A loose wire can scramble the radio's settings, so set it up again from scratch.
    if (millis() - lastRx > 65000) {
      lastRx = millis();
      int st = radio.begin(433.0, 125.0, 9, 7, RADIOLIB_SX127X_SYNC_WORD, 2);
      Serial.printf("KL RADIO re-init %d\n", st);
      radio.startReceive();
    }
    if (radio.getIRQFlags() & FLAG_RX_DONE) {
      lastRx = millis();
      String msg;
      if (radio.readData(msg) == RADIOLIB_ERR_NONE) handleFrame(msg, radio.getRSSI());
      else Serial.println("KL RX damaged");
      radio.startReceive();
    }
  }
}
