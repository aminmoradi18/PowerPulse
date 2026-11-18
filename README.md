# PowerPulse

Pay-as-you-go solar on Bitcoin Cash, unlocked over LoRa radio.

A farmer, or a son working abroad, pays a farm's solar water pump (or a family's solar home kit). The money waits in a vault contract on
Bitcoin Cash that the payer controls. Each period, one collection is allowed; the contract checks its timing and
provider. While enough remains, the provider gets the period's pledge. The final collection sweeps the remaining
vault output to the provider after the miner fee.
The payer can cancel at any time and gets back everything not yet paid. A gateway with internet reads the vaults
and, through an operator key board that holds the radio key, sends a signed frame over 433 MHz LoRa to the device on a remote farm or village with weak or no mobile signal; the device switches
its power output on or off.

Entry for BCH BLAZE 2026.

## Parts

| Folder | What |
| --- | --- |
| `contracts/power_subscription.cash` | CashScript covenant (based on the CashScript "Mecenas" example): `collect()` and `cancel(sig)`. `cancel` is also used to top up: old vault coins and new coins merge into one vault coin |
| `src/` | Static web app (Vite + TypeScript). Wallet connection with WizardConnect (Cashonize). |
| `gateway/gateway.mjs` | Village gateway: reads vaults, triggers due payments, sends LoRa frames over a USB board |
| `hardware/keeplit_lora/` | ESP32-S3 + RFM96W (SX1278) firmware, same on the gateway radio board and the pump controller |
| `hardware/keeplit_key/` | Operator key (ESP32-S3 + OLED + 2 buttons): holds the radio key, signs every frame, shows it; red button holds every pump locked |
| `test/contract.test.mjs` | Script tests of the covenant (CashScript MockNetworkProvider) |

## Run

```
npm install
npm run dev          # web app on http://localhost:5173
npm test             # contract tests
npm run compile      # after editing the contract
```

## Publish on GitHub Pages

The `main` branch is deployed automatically by `.github/workflows/pages.yml` after tests, typecheck, and build pass.
For this repository, the site URL is <https://aminmoradi18.github.io/PowerPulse/>.
In the repository settings, open **Pages** and set **Build and deployment → Source** to **GitHub Actions**.

## Test safely

- The app starts on Chipnet. tBCH is test money with no real-world value. Switching to Mainnet requires a warning confirmation and uses real BCH.
- Funding spends wallet BCH only after the user reviews and approves the transaction in Cashonize. The amount, provider address, period count, and fees are shown before signing.
- A due collection pays the provider from the vault and charges the contract's network fee. The final collection sweeps the selected vault output's remainder to the provider. The payer can cancel and recover the unspent vault balance, less the network fee.
- The visual simulation on the home page is not a real pump. Use “Simulate one payment” to step the demo down to its low-balance warning. A physical pump changes state only when the gateway, operator-key board, LoRa boards, and device firmware are correctly configured and running.
- When one paid period remains, the web device card warns the payer, the top-up card pulses, and the pump controller blinks amber while powered on. The operator-key display also says to top up soon.
- Each vault page offers a printable 90 × 55 mm device label. Its QR code opens that vault page; use the browser print dialog's “Save as PDF” option to download it.
- Test with Chipnet and a low amount first. Do not connect real pump power during bench testing; use the documented relay/MOSFET interface and suitable electrical protection.

Gateway:

```
cp gateway/devices.example.json gateway/devices.json   # paste vault links
node gateway/gateway.mjs --key-port <key board> --port <radio board>   # the gateway program never holds the radio key
KEEPLIT_KEY=<same as firmware secret.h> node gateway/gateway.mjs --port <radio board>   # software key, for tests
KEEPLIT_KEY=test node gateway/gateway.mjs --dry-run --once               # without boards
```

Firmware (PlatformIO):

```
cd hardware/keeplit_lora                # radio board and pump controller
cp src/secret.h.example src/secret.h   # set KEEPLIT_KEY and DEVICE_ID
pio run -t upload --upload-port <port>
cd ../keeplit_key                       # operator key, same KEEPLIT_KEY
cp src/secret.h.example src/secret.h
pio run -t upload --upload-port <port>
```

## LoRa frame

```
KL1|<device_id>|<on 0/1>|<periods_left>|<block_height>|<counter>|<mac>
mac = first 8 bytes of HMAC-SHA256(KEEPLIT_KEY, everything before "|<mac>"), hex
```

The device accepts a frame only for its own id, with a valid mac and a counter above the last accepted one (kept in
flash). If no frame arrives it keeps its last state.

## Security notes

- The provider never holds a key to the vault: `collect()` pays only the provider's address, only `pledge`, and only
  after `period` blocks since the vault output was created (relative timelock).
- Only the payer's key can `cancel`.
- The HMAC key lives only in the operator key and the pump controller (like OpenPAYGo tokens), not in the gateway
  program. The key refuses counters it has already signed and shows every frame on its screen. A hacked laptop can
  still ask it to sign; the red "hold all" button is the operator's override. A future version can sign frames with
  a Schnorr key so devices hold no secret.
- Not audited. Tested with local script tests and end to end on chipnet with Cashonize (fund, collect, top up, cancel) and on the boards (key signs, LoRa unlock, hold all).
# PowerPulse
