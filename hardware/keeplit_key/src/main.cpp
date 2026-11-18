// KeepLit operator key.
//
// The gateway laptop never holds the radio key. For every frame it asks this key over USB serial:
//   gateway -> key   SIGN KL1|<device_id>|<on>|<periods_left>|<block_height>|<counter>
//   key -> gateway   KL SIG KL1|...|<counter>|<mac>        (mac as in the pump controller)
//                    KL DENY <reason>
// The key shows each frame on its screen (device, ON or LOCKED, periods left), so the operator sees every
// unlock. It refuses a counter that is not above the last one it signed (kept in flash), so an old frame
// cannot be signed again.
// Red button (BT2): "hold all". While held, the key signs only LOCKED frames: an ON request is turned
// into LOCKED before signing. The green button (BT1) releases the hold. Use it if a pump must stop now.
//
// Wiring as the HumanKey board: SSD1306 128x64 on SDA 8 / SCL 9, BT1 on 4, BT2 on 5 (to GND),
// RGB LED on 48, green LED 15, red LED 16, blue LED 17, buzzer 18.
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <Preferences.h>
#include <Wire.h>
#include "mbedtls/md.h"
#include "secret.h"

#define OLED_SDA 8
#define OLED_SCL 9
#define BT1 4
#define BT2 5
#define RGB_PIN 48
#define GREEN_PIN 15
#define RED_PIN 16
#define BLUE_PIN 17
#define BUZZER_PIN 18

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
Preferences prefs;
bool oledOk = false, hold = false;
uint32_t lastCounter = 0, signedCount = 0;
String line;

String mac(const String& msg) {
  uint8_t out[32];
  const mbedtls_md_info_t* md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_hmac(md, (const uint8_t*)KEEPLIT_KEY, strlen(KEEPLIT_KEY), (const uint8_t*)msg.c_str(), msg.length(), out);
  char hex[17];
  for (int i = 0; i < 8; i++) sprintf(hex + 2 * i, "%02x", out[i]);
  return String(hex);
}

void lights(bool g, bool r, bool b) {
  digitalWrite(GREEN_PIN, g);
  digitalWrite(RED_PIN, r);
  digitalWrite(BLUE_PIN, b);
  neopixelWrite(RGB_PIN, r ? 40 : 0, g ? 40 : 0, b ? 40 : 0);
}

void beep(int ms, int times = 1) {
  for (int i = 0; i < times; i++) {
    if (i) delay(120);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(ms);
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void screen(const String& title, const String& big, const String& small) {
  if (!oledOk) return;
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print(title);
  oled.drawFastHLine(0, 11, 128, SSD1306_WHITE);
  oled.setTextSize(2);
  oled.setCursor(0, 18);
  oled.print(big);
  oled.setTextSize(1);
  oled.setCursor(0, 40);
  oled.print(small);
  oled.display();
}

// Screen layout: 21 small characters per line, 10 big ones.
String lastTitle = "", lastBig = "", lastSmall = "";
bool lastOn = false, haveLast = false;

void showLast() {
  lights(lastOn, !lastOn, false);
  screen(lastTitle, lastBig, lastSmall);
}

void idle() {
  if (hold) { lights(false, true, false); screen("KEEPLIT KEY", "HOLD ALL", "every pump locked\ngreen button: release"); }
  else if (haveLast) showLast();
  else { lights(false, false, false); screen("KEEPLIT KEY", "READY", String(signedCount) + " frames signed\nradio key inside"); }
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

void sign(String body) {
  String p[7];
  if (split(body, p, 7) != 6 || p[0] != "KL1" || (p[2] != "0" && p[2] != "1")) { Serial.println("KL DENY bad-frame"); return; }
  uint32_t counter = p[5].toInt();
  if (counter <= lastCounter) { Serial.printf("KL DENY replay %u <= %u\n", counter, lastCounter); return; }
  bool forced = hold && p[2] == "1";
  if (forced) { p[2] = "0"; body = p[0] + "|" + p[1] + "|0|" + p[3] + "|" + p[4] + "|" + p[5]; }
  bool on = p[2] == "1";
  lastCounter = counter;
  prefs.putUInt("counter", counter);
  signedCount++;
  lastOn = on;
  haveLast = true;
  lastTitle = p[1] + "  block " + p[4];
  lastBig = on ? "PUMP ON" : "LOCKED";
  bool low = on && (p[3] == "1" || p[3] == "0");
  lastSmall = low ? "LOW: top up soon\n" + String(signedCount) + " frames signed"
                  : p[3] + (p[3] == "1" ? " period paid" : " periods paid") + "\n" + (forced ? "HELD BY OPERATOR" : String(signedCount) + " frames signed");
  if (hold) screen("KEEPLIT KEY", "HOLD ALL", "every pump locked\n" + p[1] + " held");
  else screen(lastTitle, lastBig, lastSmall);
  lights(on, !on, true);   // blue = just signed
  beep(40, on ? 1 : 2);
  delay(250);
  lights(on, !on, false);
  Serial.printf("KL SIG %s|%s\n", body.c_str(), mac(body).c_str());
}

void command(String c) {
  c.trim();
  if (c.startsWith("SIGN ")) sign(c.substring(5));
  else if (c == "reset-counter") { lastCounter = 0; prefs.putUInt("counter", 0); Serial.println("KL counter reset"); }
  else Serial.printf("KL KEY ready hold=%d counter=%u\n", hold, lastCounter);
}

void setup() {
  for (int p : {GREEN_PIN, RED_PIN, BLUE_PIN, BUZZER_PIN}) { pinMode(p, OUTPUT); digitalWrite(p, LOW); }
  pinMode(BT1, INPUT_PULLUP);
  pinMode(BT2, INPUT_PULLUP);
  Serial.begin(115200);
  Wire.begin(OLED_SDA, OLED_SCL);
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  prefs.begin("keeplitkey", false);
  lastCounter = prefs.getUInt("counter", 0);
  hold = prefs.getBool("hold", false);
  idle();
  delay(800);
  command("");
}

uint32_t lastSigned = 0, lastButton = 0;
void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') { if (line.length()) { command(line); lastSigned = millis(); } line = ""; }
    else line += ch;
  }
  if (millis() - lastButton > 300) {
    bool b1 = digitalRead(BT1) == LOW, b2 = digitalRead(BT2) == LOW;
    if (b2 && !hold) { hold = true; prefs.putBool("hold", true); beep(300); idle(); lastButton = millis(); Serial.println("KL KEY hold=1"); }
    else if (b1 && hold) { hold = false; prefs.putBool("hold", false); beep(80, 2); idle(); lastButton = millis(); Serial.println("KL KEY hold=0"); }
  }
}
