// PowerPulse village gateway.
// Every 30 s: read each registered vault from the chain, trigger the payment if a period is due (no key needed,
// the contract decides where the money goes), and send the device state over LoRa as a signed frame:
//   KL1|<device_id>|<on 0/1>|<periods_left>|<block_height>|<counter>|<mac>
//   mac = first 8 bytes (hex) of HMAC-SHA256(KEEPLIT_KEY, everything before "|<mac>")
// The counter always grows (kept in state.json), so the device can reject replayed frames.
// With --key-port the laptop never holds KEEPLIT_KEY: the operator key board (hardware/keeplit_key) signs
// every frame, shows it on its screen, and can hold every pump locked with its red button.
//
// Usage: node gateway.mjs --key-port <key board> [--port <radio board>] [--every <seconds, default 30>] [--dry-run] [--once] [--no-collect]
//    or: KEEPLIT_KEY=... node gateway.mjs [--port <radio board>] ...   (software key, for tests)
import { Contract, ElectrumNetworkProvider, TransactionBuilder } from "cashscript";
import { decodeCashAddress, hexToBin } from "@bitauth/libauth";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, createReadStream, openSync, writeSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url);
const artifact = JSON.parse(readFileSync(here("../src/power_subscription.json")));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const PORT = opt("--port", null);
const DRY = flag("--dry-run") || !PORT;
const KEY_PORT = opt("--key-port", null);
const KEY = process.env.KEEPLIT_KEY;
const MINER_FEE = 1000n;
if (!KEY && !KEY_PORT) { console.error("Use --key-port <key board>, or set KEEPLIT_KEY (same value as in the firmware secret.h)"); process.exit(1); }

// devices.json: [{ "vault": "<link or code from the web app>" }, ...]
const devicesFile = here("devices.json");
if (!existsSync(devicesFile)) { console.error("Create gateway/devices.json (see devices.example.json)"); process.exit(1); }
const decode = (s) => {
  const code = s.includes("#/v/") ? s.split("#/v/")[1] : s;
  const o = JSON.parse(Buffer.from(code.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  return { net: o.n, deviceId: o.d, label: o.l, providerAddress: o.a, payerPubkey: o.k, pledge: BigInt(o.s), period: o.t };
};
const devices = JSON.parse(readFileSync(devicesFile)).map((d) => decode(d.vault));

const stateFile = here("state.json");
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile)) : { counter: Math.floor(Date.now() / 1000) };
const nextCounter = () => { state.counter += 1; writeFileSync(stateFile, JSON.stringify(state)); return state.counter; };

const providers = {};
const provider = (net) => (providers[net] ??= new ElectrumNetworkProvider(net));
const mac = (body) => createHmac("sha256", KEY ?? "").update(body).digest("hex").slice(0, 16);

// Open a USB serial board and call onLine for every line it prints.
function openBoard(path, onLine) {
  execFileSync("stty", ["-F", path, "115200", "raw", "-echo", "-hupcl"]);
  const fd = openSync(path, "r+");
  let buf = "";
  createReadStream(null, { fd, autoClose: false }).on("data", (b) => {
    buf += b.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    lines.filter(Boolean).forEach(onLine);
  });
  return fd;
}

let serialFd = null;
if (!DRY) serialFd = openBoard(PORT, (l) => console.log("  radio:", l));

// The operator key: send "SIGN <body>", wait for "KL SIG <frame>" or "KL DENY <reason>".
let keyFd = null, keyWaiter = null;
if (KEY_PORT) {
  keyFd = openBoard(KEY_PORT, (l) => {
    if (keyWaiter && (l.startsWith("KL SIG ") || l.startsWith("KL DENY"))) { keyWaiter(l); keyWaiter = null; }
    else if (l.startsWith("KL KEY hold")) console.log(`  key: operator ${l.endsWith("1") ? "HOLDS every pump locked" : "released the hold"}`);
  });
  await new Promise((r) => setTimeout(r, 2500)); // the board may reset when the port opens
}
function signWithKey(body) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { keyWaiter = null; reject(new Error("key did not answer")); }, 4000);
    keyWaiter = (l) => { clearTimeout(t); l.startsWith("KL SIG ") ? resolve(l.slice(7)) : reject(new Error(l)); };
    writeSync(keyFd, `SIGN ${body}\n`);
  });
}
const signFrame = async (body) => (KEY_PORT ? signWithKey(body) : `${body}|${mac(body)}`);
function sendFrame(frame) {
  if (DRY) { console.log("  LoRa (dry run):", frame); return; }
  writeSync(serialFd, `TX ${frame}\n`);
}

async function check(p) {
  const pkh = decodeCashAddress(p.providerAddress).payload;
  const c = new Contract(artifact, [pkh, hexToBin(p.payerPubkey), p.pledge, BigInt(p.period)], { provider: provider(p.net) });
  const [list, tip] = await Promise.all([provider(p.net).performRequest("blockchain.address.listunspent", c.address, "include_tokens"), provider(p.net).getBlockHeight()]);
  // Count every coin; pay from the oldest due coin (a top-up merges coins, a second plain funding can leave two).
  const perPeriod = p.pledge + MINER_FEE;
  const usable = list.filter((u) => BigInt(u.value) >= perPeriod).sort((a, b) => (a.height || Infinity) - (b.height || Infinity));
  const main = usable[0];
  const value = main ? BigInt(main.value) : 0n;
  const age = main && main.height > 0 ? tip - main.height + 1 : null;
  let on = usable.length > 0;
  let periods = usable.reduce((n, u) => n + Number(BigInt(u.value) / perPeriod), 0);
  if (on && age !== null && age >= p.period && !flag("--no-collect")) {
    try {
      const u = (await c.getUtxos()).find((x) => x.txid === main.tx_hash && x.vout === main.tx_pos);
      const change = u.satoshis - p.pledge - MINER_FEE;
      const tb = new TransactionBuilder({ provider: provider(p.net) }).addInput(u, c.unlock.collect(), { sequence: p.period });
      if (change <= p.pledge + MINER_FEE) tb.addOutput({ to: p.providerAddress, amount: u.satoshis - MINER_FEE });
      else tb.addOutput({ to: p.providerAddress, amount: p.pledge }).addOutput({ to: c.address, amount: change });
      const tx = await tb.send();
      console.log(`  collected one period for ${p.deviceId}: ${tx.txid}`);
      periods = Math.max(0, periods - 1);
      on = periods > 0;
    } catch (e) { console.log(`  collect skipped for ${p.deviceId}: ${String(e.message).split("\n")[0]}`); }
  }
  const body = `KL1|${p.deviceId}|${on ? 1 : 0}|${periods}|${tip}|${nextCounter()}`;
  console.log(`${new Date().toISOString()} ${p.deviceId} (${p.label}) vault ${c.address.slice(0, 24)}… ${on ? "ON" : "LOCKED"}, ${periods} period(s) left, block ${tip}`);
  try {
    const frame = await signFrame(body);
    if (on && frame.split("|")[2] === "0") console.log("  the operator key holds this pump LOCKED");
    sendFrame(frame);
  }
  catch (e) { console.log(`  not sent, the key refused: ${e.message}`); }
}

async function round() {
  for (const p of devices) {
    try { await check(p); } catch (e) { console.log(`  ${p.deviceId}: chain read failed (${e.message}); device keeps its last state`); }
    await new Promise((r) => setTimeout(r, 1500)); // LoRa airtime between frames
  }
}
await round();
// A blocking read on a serial port can keep Node from exiting, so end the process with a signal.
if (flag("--once")) process.kill(process.pid, "SIGTERM");
setInterval(round, Number(opt("--every", 30)) * 1000);
