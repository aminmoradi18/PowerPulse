import "./style.css";
import QRCode from "qrcode";
import { hexToBin } from "@bitauth/libauth";
import {
  type Net, type VaultParams, type VaultState, BLOCKS_PER_DAY, MINER_FEE, addressOfPubkey, broadcast, buildCancel,
  buildFunding, buildTopUp, collect, explorerTx, normalizeAddress, satsToBch, vaultState, walletUtxos, binToHex,
} from "./chain";
import { wallet } from "./wallet";
import { DEFAULT_PROVIDER, PLANS, PROJECT } from "./config";
import { icon } from "./icons";

// ---------- small helpers ----------
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function toast(msg: string, kind: "ok" | "err" | "info" = "info", ms = 6000) {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.innerHTML = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), ms);
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast("Copied", "ok", 1800); } catch { toast("Copy failed: " + esc(text), "err"); }
}
(window as any).__copy = copy;

let net: Net = "chipnet";
function setNet(n: Net) {
  if (n === "mainnet" && !window.confirm("Mainnet uses real BCH. Continue only if you intend to use real funds.")) return;
  net = n;
  render();
}

let bchUsd: number | null = null;
fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd")
  .then((r) => r.json()).then((j) => { bchUsd = j?.["bitcoin-cash"]?.usd ?? null; }).catch(() => {});
const usd = (sats: bigint) => (bchUsd ? `≈ $${((Number(sats) / 1e8) * bchUsd).toFixed(2)}` : "");

// ---------- runtime settings (public/config.json, editable without touching code) ----------
interface RuntimeConfig { repo?: string; slides: string; video: string; preBlazeRepo: string; preBlazeDemo: string; newDuringBlaze: string; demoVault: Partial<Record<Net, string>> }
let cfg: RuntimeConfig = { slides: PROJECT.slides, video: PROJECT.video, preBlazeRepo: "", preBlazeDemo: "", newDuringBlaze: "", demoVault: {} };
function demoVault(): VaultParams | undefined {
  const link = cfg.demoVault?.[net];
  if (!link) return undefined;
  try { const v = decodeVault(link.includes("#/v/") ? link.split("#/v/")[1] : link); return v.net === net ? v : undefined; } catch { return undefined; }
}

// ---------- vault links ----------
// A vault is fully described by its parameters, so the link itself is the vault's ID: anyone with it can watch.
function encodeVault(p: VaultParams): string {
  const o = { n: p.net, d: p.deviceId, l: p.label, a: p.providerAddress, k: p.payerPubkey, s: p.pledge.toString(), t: p.period };
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeVault(s: string): VaultParams {
  const o = JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));
  return { net: o.n, deviceId: o.d, label: o.l, providerAddress: o.a, payerPubkey: o.k, pledge: BigInt(o.s), period: o.t };
}
function savedVaults(): string[] { try { return JSON.parse(localStorage.getItem("powerpulse-vaults") || "[]"); } catch { return []; } }
function saveVault(code: string) { try { const v = savedVaults().filter((x) => x !== code); v.unshift(code); localStorage.setItem("powerpulse-vaults", JSON.stringify(v.slice(0, 20))); } catch {} }

// ---------- shell ----------
const app = $("#app");
function shell(active: string, body: string) {
  const chip = wallet.connected
    ? `<span class="wallet-chip">${icon("wallet")} ${esc(wallet.name || "Wallet")}</span>`
    : wallet.status === "reconnecting" ? `<span class="pill">Reconnecting wallet…</span>` : "";
  app.innerHTML = `
  <div class="banner" role="region" aria-label="BCH BLAZE 2026 entry">
    <div class="wrap">
      <strong>BCH BLAZE 2026 entry</strong>
      ${cfg.slides ? `<a href="${esc(cfg.slides)}" target="_blank" rel="noopener">Presentation</a>` : `<span>Presentation: coming soon</span>`}
      <a href="${esc(cfg.repo || PROJECT.repo)}" target="_blank" rel="noopener">Source code</a>
      <span>Support with EMBER2026: <button class="copy-inline" onclick="__copy('${PROJECT.donation}')">copy address</button>
      <span class="addr">${PROJECT.donation}</span></span>
      ${cfg.preBlazeRepo || cfg.preBlazeDemo ? `<span>Built before BLAZE: ${cfg.preBlazeRepo ? `<a href="${esc(cfg.preBlazeRepo)}" target="_blank" rel="noopener">v1 code</a>` : ""} ${cfg.preBlazeDemo ? `· <a href="${esc(cfg.preBlazeDemo)}" target="_blank" rel="noopener">v1 demo</a>` : ""}${cfg.newDuringBlaze ? ` · ${/^https?:/.test(cfg.newDuringBlaze) ? `<a href="${esc(cfg.newDuringBlaze)}" target="_blank" rel="noopener">what is new during BLAZE</a>` : `New during BLAZE: ${esc(cfg.newDuringBlaze)}`}` : ""}</span>` : ""}
    </div>
  </div>
  <header class="top"><div class="wrap">
    <a class="brand" href="#/">${icon("logo")}<span>${PROJECT.name}</span></a>
    <nav class="links">
      <a href="#/" class="${active === "home" ? "active" : ""}">How it works</a>
      <a href="#/new" class="${active === "new" ? "active" : ""}">Start a plan</a>
      <a href="#/mine" class="${active === "mine" ? "active" : ""}">My plans</a>
      <a href="#/simulator" class="${active === "simulator" ? "active" : ""}">Pump simulator</a>
      <a href="#/gateway" class="${active === "gateway" ? "active" : ""}">Village gateway</a>
    </nav>
    <div class="spacer"></div>
    ${chip}
    <div class="net" role="group" aria-label="Network">
      <button data-net="mainnet" class="${net === "mainnet" ? "sel" : ""}">Mainnet</button>
      <button data-net="chipnet" class="${net === "chipnet" ? "sel" : ""}">Chipnet</button>
    </div>
  </div></header>
  <div class="network-notice ${net === "chipnet" ? "test-network" : "real-network"}">
    ${net === "chipnet"
      ? "Chipnet test network · tBCH is for testing only and has no real-world value."
      : "Mainnet · transactions use real BCH and cannot be reversed."}
  </div>
  <main>${body}</main>
  <footer><div class="wrap">
    <span>${PROJECT.name}: pay-as-you-go solar on Bitcoin Cash, unlocked over LoRa radio.</span>
    <span>Contract based on the CashScript "Mecenas" example. Wallet link: WizardConnect.</span>
  </div></footer>`;
  app.querySelectorAll<HTMLButtonElement>(".net button").forEach((b) => (b.onclick = () => setNet(b.dataset.net as Net)));
}

// ---------- device panel (shared by landing and vault page) ----------
function deviceCard(id: string, title: string, subtitle: string, simulated: boolean) {
  return `
  <div class="card device" id="${id}">
    ${simulated ? `<span class="sim-tag">Simulation</span>` : ""}
    <div class="device-head">
      <div><h3>${esc(title)}</h3><p class="sub">${esc(subtitle)}</p></div>
      <span class="pill" data-k="pill">Checking…</span>
    </div>
    <div class="scene" data-k="scene" role="img" aria-label="Solar home and water pump">
      <div class="sun"></div><div class="panel"></div>
      <div class="house"><div class="roof"></div><div class="wall"></div><div class="win l"></div><div class="win r"></div></div>
      <div class="radio"></div><div class="wave"></div>
      <div class="pump"><div class="body"></div><div class="pipe"></div></div><div class="drops"></div>
      <div class="ground"></div>
    </div>
    <div class="kv">
      <div><b data-k="bal">–</b><span>In the vault</span></div>
      <div><b data-k="left">–</b><span>Periods paid ahead</span></div>
      <div><b data-k="next">–</b><span>Next payment</span></div>
    </div>
    <div class="frame" data-k="frame">LoRa frame: waiting for chain data…</div>
    ${simulated ? `<div class="sim-controls" data-k="sim-controls">
      <button class="btn btn-danger btn-sm" data-k="sim-off">Turn pump off</button>
      <button class="btn btn-ghost btn-sm" data-k="sim-on">Turn pump on</button>
    </div><p class="note">Simulation only: these buttons do not control a real pump or send transactions.</p>` : ""}
  </div>`;
}

let frameCounter = Math.floor(Date.now() / 1000);
function paintDevice(root: HTMLElement, p: VaultParams, s: VaultState) {
  const on = s.active;
  const pill = $("[data-k=pill]", root);
  pill.className = `pill live ${on ? "on" : "off"}`;
  pill.textContent = on ? "Power ON" : "Locked";
  const scene = $("[data-k=scene]", root);
  scene.classList.toggle("on", on);
  scene.classList.remove("ping"); void scene.offsetWidth; scene.classList.add("ping");
  $("[data-k=bal]", root).innerHTML = `${satsToBch(s.balance)} <small style="font-size:12px;color:var(--muted)">BCH</small>`;
  $("[data-k=left]", root).textContent = String(s.periodsLeft);
  $("[data-k=next]", root).textContent = !on ? "–" : s.canCollect ? "Due now" : s.ageBlocks === null ? "after 1st block" : `in ${s.blocksToNextCollect} block${s.blocksToNextCollect === 1 ? "" : "s"}`;
  const body = `KL1|${p.deviceId}|${on ? 1 : 0}|${s.periodsLeft}|${s.tipHeight}|${++frameCounter}`;
  $("[data-k=frame]", root).innerHTML = `LoRa frame the gateway sends: <b>${esc(body)}</b>|&lt;HMAC&gt; <br>Block ${s.tipHeight} · vault <a href="${explorerAddr(p.net, s.address)}" target="_blank" rel="noopener">${s.address.slice(0, 22)}…</a>`;
}
function explorerAddr(n: Net, a: string) { return n === "mainnet" ? `https://explorer.salemkode.com/address/${a}` : `https://chipnet.imaginary.cash/address/${a}`; }

function simulateDevice(root: HTMLElement) {
  let on = true;
  const render = () => {
    const fake: VaultState = { address: "simulation", balance: 18000n, utxoCount: 1, ageBlocks: 1, tipHeight: 930000, periodsLeft: 6, canCollect: true, nextPayment: 2000n, blocksToNextCollect: 0, active: on };
    paintDevice(root, { net, deviceId: "ZA-014", label: "", providerAddress: "", payerPubkey: "", pledge: 2000n, period: 1 }, fake);
    $("[data-k=frame]", root).innerHTML = $("[data-k=frame]", root).innerHTML.replace(/<br>.*/, "<br>Simulation: use the buttons below to preview the pump state.");
    $<HTMLButtonElement>("[data-k=sim-off]", root).hidden = !on;
    $<HTMLButtonElement>("[data-k=sim-on]", root).hidden = on;
  };
  $("[data-k=sim-off]", root).onclick = () => { on = false; render(); };
  $("[data-k=sim-on]", root).onclick = () => { on = true; render(); };
  render();
}

// ---------- pages ----------
let timers: number[] = [];
function clearTimers() { timers.forEach((t) => clearInterval(t)); timers = []; }

function pageHome() {
  const demo = demoVault();
  shell("home", `
  <div class="wrap">
    <section class="hero">
      <div>
        <span class="eyebrow">${icon("bolt")} Pay-as-you-go solar on Bitcoin Cash</span>
        <h1>Keep the water <span class="hl">flowing.</span></h1>
        <p class="lead">Pay a farm's solar water pump, or a family's solar power, from anywhere. The money waits in a vault that <b>you</b> control, the provider can take only one period at a time, and you can cancel and get the rest back. Farms sit far from town, often in valleys with weak or no mobile signal: a radio carries the unlock.</p>
        <div class="cta">
          <a class="btn btn-sun" href="#/new">${icon("plus")} Start a plan</a>
          <a class="btn btn-ghost" href="#/simulator">${icon("play")} Try pump simulator</a>
          <a class="btn btn-ghost" href="#how">${icon("play")} See how it works</a>
        </div>
        <div class="trust">
          <span>${icon("check")} Money stays on chain, not in a company account</span>
          <span>${icon("check")} Cancel any time, refund in one tap</span>
          <span>${icon("check")} Works in valleys with no mobile signal</span>
        </div>
      </div>
      <div>
        ${deviceCard("demo-device", demo ? demo.label : "Baba's solar water pump · ZA-014", demo ? `Live ${net} vault · device ${demo.deviceId}` : "How a device reacts to its vault", !demo)}
        ${demo ? `<div class="actions">
          <button class="btn btn-ghost btn-sm" id="demo-collect">${icon("coins")} Run this period's payment (anyone can)</button>
          <a class="btn btn-ghost btn-sm" href="#/v/${encodeVault(demo)}">${icon("eye")} Open vault</a></div>
          <p class="note">The payment needs no wallet and no key: the contract itself checks the amount, the receiver and the date. The fee comes out of the vault.</p>` : ""}
      </div>
    </section>

    <section class="section" id="how">
      <h2>How it works</h2>
      <p class="intro">Three parties, one rule enforced by Bitcoin Cash script: the provider gets paid one period at a time, and only the payer can stop it.</p>
      <div class="grid3">
        <div class="card"><div class="step-n">1</div><h3>The payer funds a vault</h3><p class="sub">A son working in Dubai connects his wallet and locks, say, six months of his father's solar pump plan into a vault contract on Bitcoin Cash. A farmer can fund it himself the same way.</p></div>
        <div class="card"><div class="step-n">2</div><h3>One collection per period</h3><p class="sub">After each period, anyone can trigger a collection. The provider receives one period's price while enough remains; the final collection also sweeps the remaining vault balance after its fee.</p></div>
        <div class="card"><div class="step-n">3</div><h3>Radio unlocks the device</h3><p class="sub">A gateway in town reads the vault and sends a signed message over LoRa radio, several kilometres, to the pump on the farm or the kit in the village. Paid ahead: power on. Cancelled or empty: locked.</p></div>
      </div>
    </section>

    <section class="section">
      <h2>Why this matters</h2>
      <p class="intro">Pay-as-you-go solar already powers millions of homes. But the money and the switch sit with the company, and the unlock code needs a phone signal.</p>
      <div class="grid3">
        <div class="card"><div class="icon-tile">${icon("people")}</div><div class="stat">666M <small>people</small></div><p class="sub">still had no electricity in 2023, about 85% of them in sub-Saharan Africa.</p><p class="src">World Bank, <a href="https://www.worldbank.org/en/topic/energy/publication/tracking-sdg-7-the-energy-progress-report-2025" target="_blank" rel="noopener">Tracking SDG7 2025</a></p></div>
        <div class="card"><div class="icon-tile">${icon("send")}</div><div class="stat">8.78% <small>fee</small></div><p class="sub">average cost to send $200 to sub-Saharan Africa. Families abroad already pay their relatives' bills this way.</p><p class="src">World Bank, <a href="https://remittanceprices.worldbank.org/" target="_blank" rel="noopener">Remittance Prices Q1 2025</a></p></div>
        <div class="card"><div class="icon-tile">${icon("alert")}</div><div class="stat">2025 <small>failures</small></div><p class="sub">A major PAYG solar company went into administration and another was liquidated. Customers' prepaid money sits with the company.</p><p class="src"><a href="https://www.pkf-l.com/insights/pkf-appointed-administrators-of-bboxx-limited/" target="_blank" rel="noopener">PKF on Bboxx</a> · <a href="https://launchbaseafrica.com/2025/05/27/shell-and-usaid-backed-solarnow-forced-into-liquidation-after-20m-funding/" target="_blank" rel="noopener">SolarNow</a></p></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="table-wrap"><table class="compare">
          <thead><tr><th></th><th>Typical PAYG today</th><th>${PROJECT.name}</th></tr></thead>
          <tbody>
            <tr><td>Where prepaid money waits</td><td>Company account</td><td>Vault on Bitcoin Cash, refundable by the payer</td></tr>
            <tr><td>How much the provider can take</td><td>Whatever the company bills</td><td>One period's price per collection; the final collection sweeps the remainder</td></tr>
            <tr><td>Paying from abroad</td><td>Remittance + mobile money fees</td><td>A Bitcoin Cash transaction, under one cent</td></tr>
            <tr><td>Unlock</td><td>SMS code or GSM modem</td><td>Signed LoRa radio frame, no SIM, no internet in the village</td></tr>
            <tr><td>Anyone can check</td><td>No</td><td>Yes, the vault and every payment are public</td></tr>
          </tbody></table></div>
      </div>
    </section>

    <section class="section">
      <h2>Real hardware, not a mock-up</h2>
      <p class="intro">Two ESP32-S3 boards with 433 MHz LoRa radios: one is the gateway next to the internet, one is the device in the "village". Frames carry an HMAC and a counter, so a recorded frame cannot be replayed and a fake one is rejected.</p>
      <div class="grid2">
        <div class="card"><div class="icon-tile">${icon("radio")}</div><h3>Village gateway</h3><p class="sub">Reads every vault from the chain, triggers due payments for the provider, and broadcasts the state over LoRa. <a href="#/gateway">How to run it</a></p></div>
        <div class="card"><div class="icon-tile">${icon("chip")}</div><h3>Device controller</h3><p class="sub">Checks the HMAC and the counter, then switches the lamp or pump. If the radio is silent it keeps its last state: a radio gap never cuts the power.</p>${cfg.video ? `<p><a href="${esc(cfg.video)}" target="_blank" rel="noopener">Watch the hardware demo</a></p>` : ""}</div>
      </div>
    </section>

    <section class="section">
      <div class="card" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px">
        <div><h3 style="font-size:22px">Try it in two minutes</h3><p class="sub">Use Cashonize (desktop, web or Android). Switch to Chipnet above for free test coins.</p></div>
        <a class="btn btn-sun" href="#/new">${icon("plus")} Start a plan</a>
      </div>
    </section>
  </div>`);
  const root = $("#demo-device");
  if (demo) {
    const refresh = () => vaultState(demo).then((s) => paintDevice(root, demo, s)).catch((e) => toast("Chain read failed: " + esc(e.message), "err"));
    refresh(); timers.push(setInterval(refresh, 20000) as unknown as number);
    $("#demo-collect").onclick = () => runCollect(demo, refresh);
  } else {
    simulateDevice(root);
  }
}

async function runCollect(p: VaultParams, after: () => void) {
  try {
    const s = await vaultState(p);
    if (!s.active) return toast("This vault is empty or cancelled: nothing to pay.", "info");
    if (!s.canCollect) return toast(s.ageBlocks === null ? "Wait for the vault's last transaction to be mined (about 10 minutes)." : `Not due yet: ${s.blocksToNextCollect} more block(s). The contract would reject it.`, "info");
    const payment = s.nextPayment ?? p.pledge;
    const finalPayment = payment > p.pledge;
    const confirmed = window.confirm(
      `Send the due payment on ${p.net}?\n\nProvider: ${p.providerAddress}\nPayment: ${satsToBch(payment)} BCH\nNetwork fee: ${satsToBch(MINER_FEE)} BCH${finalPayment ? "\nThis is the final payout from this vault output." : ""}${p.net === "mainnet" ? "\n\nThis uses real BCH." : "\n\nThis uses test BCH only."}`,
    );
    if (!confirmed) return;
    toast("Sending this period's payment…");
    const txid = await collect(p);
    toast(`Paid ${satsToBch(payment)} BCH to the provider. <a href="${explorerTx(p.net, txid)}" target="_blank" rel="noopener">View transaction</a>`, "ok", 12000);
    setTimeout(after, 1500);
  } catch (e: any) { toast("Payment failed: " + esc(e.message || String(e)), "err", 10000); }
}

function connectBlock() {
  if (wallet.connected) {
    const pk = wallet.pubkey("receive", 0);
    return `<div class="card"><h3>${icon("wallet")} Wallet connected</h3><p class="sub">${esc(wallet.name || "")} · payer address <span class="mono">${pk ? esc(addressOfPubkey(pk, net)) : "?"}</span></p>
      <div class="actions"><button class="btn btn-ghost btn-sm" id="w-disc">Disconnect</button></div></div>`;
  }
  return `<div class="card"><h3>1. Connect your wallet</h3>
    <p class="sub">Open <b>Cashonize</b> (HD wallet) → <b>Connect</b>, then scan the code or paste the link. Make sure the wallet is on <b>${net}</b>.</p>
    <div id="w-pair" style="margin-top:14px">${wallet.status === "waiting" ? "" : `<button class="btn btn-sun" id="w-start">${icon("link")} Connect with WizardConnect</button>`}</div></div>`;
}
async function paintPairing() {
  const box = $("#w-pair"); if (!box || wallet.status !== "waiting") return;
  const svg = await QRCode.toString(wallet.qrUri, { type: "svg", margin: 0 });
  // The page may have re-rendered while the QR code was being drawn.
  if (!box.isConnected || wallet.status !== "waiting") return;
  box.innerHTML = `<div class="connect"><div class="qr">${svg}</div><div>
    <p class="sub" style="margin-bottom:8px">Waiting for the wallet…</p>
    <div class="uri">${esc(wallet.uri)}</div>
    <div class="actions"><button class="btn btn-ghost btn-sm" id="w-copy">${icon("copy")} Copy link</button><button class="btn btn-ghost btn-sm" id="w-cancel">Cancel</button></div></div></div>`;
  $("#w-copy").onclick = () => copy(wallet.uri);
  $("#w-cancel").onclick = async () => {
    try { await wallet.disconnect(); render(); }
    catch (e) { toast("Wallet disconnect failed: " + esc(e instanceof Error ? e.message : String(e)), "err", 10000); }
  };
}
function bindConnect() {
  const s = $("#w-start");
  if (s) s.onclick = async () => {
    try { await wallet.connect(); }
    catch (e) { toast("Wallet connection failed: " + esc(e instanceof Error ? e.message : String(e)), "err", 10000); }
  };
  const d = $("#w-disc");
  if (d) d.onclick = async () => {
    try { await wallet.disconnect(); render(); }
    catch (e) { toast("Wallet disconnect failed: " + esc(e instanceof Error ? e.message : String(e)), "err", 10000); }
  };
  paintPairing();
}

let planId: string = "demo";
function pageNew() {
  const plan = PLANS.find((x) => x.id === planId)!;
  shell("new", `<div class="wrap section"><h2>Start a plan</h2><p class="intro">Lock a few periods of a solar plan into a vault. You can cancel any time and get back everything not yet paid.</p>
  <div class="grid2" style="align-items:start">
    <div class="form">${connectBlock()}
      <div class="card form"><h3>2. Choose the device and plan</h3>
        <label class="f">Device ID <span class="hint">Printed on the solar kit or pump controller</span><input id="f-dev" value="ZA-014" maxlength="16"></label>
        <label class="f">Name <span class="hint">So you recognise it later</span><input id="f-label" value="Baba's solar water pump" maxlength="40"></label>
        <div class="f"><span style="font-weight:600;font-size:14px">Plan</span><div class="plans">
          ${PLANS.map((x) => `<button class="plan ${x.id === planId ? "sel" : ""}" data-plan="${x.id}"><b>${x.name}</b><span>${x.detail}</span></button>`).join("")}
        </div></div>
        <label class="f">Price per period (sats) <input id="f-price" type="number" min="1000" step="500" value="${plan.pledgeSats}"></label>
        <label class="f">Periods to pay ahead <input id="f-n" type="number" min="1" max="60" value="1"></label>
        <label class="f">Provider's address <span class="hint">Where each period's payment goes (demo: Sunrise Solar Co-op)</span><input id="f-prov" value="${DEFAULT_PROVIDER[net]}"></label>
      </div>
    </div>
    <div class="card form" style="position:sticky;top:84px"><h3>3. Fund the vault</h3>
      <div class="summary" id="f-sum"></div>
      <button class="btn btn-sun" id="f-go" ${wallet.connected ? "" : "disabled"}>${icon("lock")} Fund vault with my wallet</button>
      <p class="note">Your wallet shows the transaction before you sign. The final collection may pay the remaining vault balance to the provider after the fee. The vault address is computed from the plan, so anyone can check it.</p>
    </div>
  </div></div>`);
  bindConnect();
  const sum = () => {
    const price = BigInt(Math.max(1000, Number(($("#f-price") as HTMLInputElement).value) || 0));
    const n = BigInt(Math.max(1, Math.min(60, Number(($("#f-n") as HTMLInputElement).value) || 1)));
    const total = (price + MINER_FEE) * n + 1000n;
    const days = (plan.period * Number(n)) / BLOCKS_PER_DAY;
    $("#f-sum").innerHTML = `<div><span>Plan</span><span>${plan.name}, ${plan.detail}</span></div>
      <div><span>Per period</span><span>${satsToBch(price)} BCH ${usd(price)}</span></div>
      <div><span>Network</span><span>${net === "chipnet" ? "Chipnet · test BCH only" : "Mainnet · real BCH"}</span></div>
      <div><span>Provider</span><span class="mono">${esc(($("#f-prov") as HTMLInputElement).value.trim())}</span></div>
      <div><span>Network fee per payment</span><span>${satsToBch(MINER_FEE)} BCH (from the vault)</span></div>
      <div><span>Covers</span><span>${n} periods ≈ ${days < 1 ? Math.round(days * 24 * 60) + " min" : days.toFixed(1) + " days"}</span></div>
      <div style="font-weight:700"><span style="color:var(--text)">Total locked</span><span>${satsToBch(total)} BCH ${usd(total)}</span></div>`;
    return { price, n, total };
  };
  sum();
  app.querySelectorAll<HTMLInputElement>("#f-price,#f-n").forEach((i) => (i.oninput = sum));
  app.querySelectorAll<HTMLButtonElement>(".plan").forEach((b) => (b.onclick = () => { planId = b.dataset.plan!; pageNew(); }));
  $("#f-go").onclick = async () => {
    const btn = $<HTMLButtonElement>("#f-go");
    try {
      const pk = wallet.pubkey("receive", 0);
      if (!pk) throw new Error("Wallet is not connected");
      const { price, total } = sum();
      const deviceId = ($("#f-dev") as HTMLInputElement).value.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16);
      if (!deviceId) throw new Error("Enter a device ID");
      const providerAddress = normalizeAddress(($("#f-prov") as HTMLInputElement).value.trim(), net);
      const payerAddress = addressOfPubkey(pk, net);
      if (providerAddress.toLowerCase() === payerAddress.toLowerCase()
        && !window.confirm(`The provider address is your own wallet address:\n${providerAddress}\n\nPayments will return to you, but each on-chain payment still costs a network fee. Continue with this self-test?`)) return;
      const p: VaultParams = { net, deviceId, label: ($("#f-label") as HTMLInputElement).value.trim() || deviceId,
        providerAddress, payerPubkey: binToHex(pk), pledge: price, period: plan.period };
      btn.disabled = true; btn.textContent = "Finding coins in your wallet…";
      // Same settings = same vault address. Do not add a second coin to it: send the payer to "Add more periods".
      const existing = await vaultState(p);
      if (existing.balance > 0n) {
        location.hash = `#/v/${encodeVault(p)}`;
        toast("A vault with these settings already exists. Use “Add more periods” to top it up.", "info", 10000);
        return;
      }
      const keys: { path: "receive" | "change"; index: number; pubkey: Uint8Array }[] = [];
      for (const path of ["receive", "change"] as const) for (let i = 0; i < 10; i++) { const k = wallet.pubkey(path, i); if (k) keys.push({ path, index: i, pubkey: k }); }
      const coins = await walletUtxos(net, keys);
      const changeAddr = addressOfPubkey(wallet.pubkey("change", 0) || pk, net);
      const { wc, inputPaths } = buildFunding(p, coins, total, changeAddr);
      btn.textContent = "Confirm in your wallet…";
      const raw = await wallet.sign(wc, inputPaths);
      btn.textContent = "Broadcasting…";
      const txid = await broadcast(net, raw);
      const code = encodeVault(p); saveVault(code);
      toast(`Vault funded. <a href="${explorerTx(net, txid)}" target="_blank" rel="noopener">View transaction</a>`, "ok", 12000);
      location.hash = `#/v/${code}`;
    } catch (e: any) {
      toast("Could not fund: " + esc(e.message || String(e)), "err", 10000);
      btn.disabled = !wallet.connected; btn.innerHTML = `${icon("lock")} Fund vault with my wallet`;
    }
  };
}

function pageVault(code: string) {
  let p: VaultParams;
  try { p = decodeVault(code); } catch { shell("", `<div class="wrap section"><div class="empty">This vault link is broken.</div></div>`); return; }
  if (p.net !== net) { net = p.net; }
  saveVault(code);
  const plan = PLANS.find((x) => x.period === p.period);
  shell("mine", `<div class="wrap section"><h2>${esc(p.label)}</h2><p class="intro">Device <b>${esc(p.deviceId)}</b> · ${p.net} · ${satsToBch(p.pledge)} BCH ${plan ? plan.detail : `every ${p.period} blocks`}</p>
  <div class="grid2" style="align-items:start">
    ${deviceCard("vault-device", "Device status", "Read live from the chain every 20 s", false)}
    <div class="form">
      <div class="card"><h3>Pay this period</h3><p class="sub">Anyone can send the due payment (normally the village gateway does it). The contract checks the amount, the receiver and the timing.</p>
        <div class="actions"><button class="btn btn-ghost" id="v-collect">${icon("coins")} Run due payment</button></div></div>
      <div class="card"><h3>Add more periods</h3><p class="sub">The payer can top up the same vault: no new link, the device stays on. Old and new money become one vault coin, so one collection is allowed per period; the final collection sweeps the remainder.</p>
        <div id="v-topup-box" style="margin-top:12px"></div></div>
      <div class="card"><h3>Cancel and refund</h3><p class="sub">Only the payer's wallet can do this. Everything left in the vault comes back, and the device locks at the next radio update.</p>
        <div id="v-cancel-box" style="margin-top:12px"></div></div>
      <div class="card"><h3>Share</h3><p class="sub">The link describes the vault fully. Send it to the family or the provider so they can watch it.</p>
        <div class="actions"><button class="btn btn-ghost btn-sm" id="v-share">${icon("copy")} Copy vault link</button></div></div>
    </div>
  </div></div>`);
  const root = $("#vault-device");
  const refresh = () => vaultState(p).then((s) => paintDevice(root, p, s)).catch((e) => toast("Chain read failed: " + esc(e.message), "err"));
  refresh(); timers.push(setInterval(refresh, 20000) as unknown as number);
  $("#v-collect").onclick = () => runCollect(p, refresh);
  $("#v-share").onclick = () => copy(location.href);
  const topBox = $("#v-topup-box");
  const box = $("#v-cancel-box");
  const isPayer = wallet.connected && binToHex(wallet.pubkey("receive", 0) || new Uint8Array()) === p.payerPubkey;
  if (!wallet.connected) {
    box.innerHTML = `<a class="btn btn-ghost" href="#/new">${icon("link")} Connect the payer's wallet first</a>`;
    topBox.innerHTML = box.innerHTML;
  } else if (!isPayer) {
    box.innerHTML = `<p class="note">The connected wallet is not the payer of this vault.</p>`;
    topBox.innerHTML = box.innerHTML;
  } else {
    topBox.innerHTML = `<label class="f">Periods to add <input id="v-topup-n" type="number" min="1" max="60" value="3"></label>
      <div class="actions"><button class="btn btn-sun" id="v-topup">${icon("plus")} Add with my wallet</button></div>`;
    $("#v-topup").onclick = async () => {
      const b = $<HTMLButtonElement>("#v-topup");
      try {
        const n = Math.max(1, Math.min(60, Number(($("#v-topup-n") as HTMLInputElement).value) || 1));
        const amount = BigInt(n) * (p.pledge + MINER_FEE);
        b.disabled = true; b.textContent = "Finding coins in your wallet…";
        const keys: { path: "receive" | "change"; index: number; pubkey: Uint8Array }[] = [];
        for (const path of ["receive", "change"] as const) for (let i = 0; i < 10; i++) { const k = wallet.pubkey(path, i); if (k) keys.push({ path, index: i, pubkey: k }); }
        const coins = await walletUtxos(p.net, keys);
        const changeAddr = addressOfPubkey(wallet.pubkey("change", 0) || wallet.pubkey("receive", 0)!, p.net);
        const { wc, inputPaths, newTotal } = await buildTopUp(p, coins, amount, changeAddr, 0);
        b.textContent = "Confirm in your wallet…";
        const raw = await wallet.sign(wc, inputPaths);
        const txid = await broadcast(p.net, raw);
        toast(`Added ${n} period(s). The vault now holds ${satsToBch(newTotal)} BCH. <a href="${explorerTx(p.net, txid)}" target="_blank" rel="noopener">View transaction</a>`, "ok", 12000);
        setTimeout(refresh, 1500);
      } catch (e: any) { toast("Top-up failed: " + esc(e.message || String(e)), "err", 10000); }
      b.disabled = false; b.innerHTML = `${icon("plus")} Add with my wallet`;
    };
    box.innerHTML = `<button class="btn btn-danger" id="v-cancel">${icon("x")} Cancel plan and refund me</button>`;
    $("#v-cancel").onclick = async () => {
      const b = $<HTMLButtonElement>("#v-cancel");
      try {
        b.disabled = true; b.textContent = "Confirm in your wallet…";
        const { wc, inputPaths, refund } = await buildCancel(p, 0);
        const raw = await wallet.sign(wc, inputPaths);
        const txid = await broadcast(p.net, raw);
        toast(`Cancelled. ${satsToBch(refund)} BCH is back in your wallet. <a href="${explorerTx(p.net, txid)}" target="_blank" rel="noopener">View transaction</a>`, "ok", 12000);
        setTimeout(refresh, 1500);
      } catch (e: any) {
        const m = e.message || String(e);
        if (/already empty/.test(m)) { toast("This vault is already cancelled or empty. Your refund went to your wallet.", "info", 10000); refresh(); }
        else toast("Cancel failed: " + esc(m), "err", 10000);
      }
      b.disabled = false; b.innerHTML = `${icon("x")} Cancel plan and refund me`;
    };
  }
}

function pageMine() {
  const list = savedVaults().map((c) => { try { return { c, p: decodeVault(c) }; } catch { return null; } }).filter(Boolean) as { c: string; p: VaultParams }[];
  shell("mine", `<div class="wrap section"><h2>My plans</h2><p class="intro">Vaults opened in this browser. The links work anywhere.</p>
    <div class="list">${list.length ? list.map(({ c, p }) => `<a class="row" href="#/v/${c}"><span><b>${esc(p.label)}</b><br><span class="note">${esc(p.deviceId)} · ${p.net} · ${satsToBch(p.pledge)} BCH per ${p.period} block(s)</span></span>${icon("chev")}</a>`).join("") : `<div class="empty">No plans yet. <a href="#/new">Start one</a>.</div>`}</div></div>`);
}

function pageSimulator() {
  shell("simulator", `<div class="wrap section">
    <h2>Hardware simulator</h2>
    <p class="intro">Try the pump controls without connecting a wallet or hardware. Use the buttons to switch the simulated pump on and off.</p>
    <div class="grid2" style="align-items:start">
      ${deviceCard("sim-device", "Solar water pump · ZA-014", "Interactive hardware preview", true)}
      <div class="card">
        <h3>What this demo shows</h3>
        <p class="sub">The pump illustration and status change when you press the buttons. This is only a browser simulation: it does not send a radio command, change a real vault, or control a physical pump.</p>
        <p class="note">For a real device, the gateway and LoRa hardware must be installed and connected.</p>
      </div>
    </div>
  </div>`);
  simulateDevice($("#sim-device"));
}

function pageGateway() {
  shell("gateway", `<div class="wrap section"><h2>Village gateway</h2>
  <p class="intro">The gateway is a small program next to an internet connection, with a LoRa board on USB. It never holds anyone's money or keys.</p>
  <div class="grid3">
    <div class="card"><div class="icon-tile">${icon("eye")}</div><h3>Reads</h3><p class="sub">Every 30 s it reads each registered vault from a public Bitcoin Cash server.</p></div>
    <div class="card"><div class="icon-tile">${icon("coins")}</div><h3>Collects</h3><p class="sub">When a period is due it triggers the payment. No key needed: the contract pays the provider and keeps the rest.</p></div>
    <div class="card"><div class="icon-tile">${icon("radio")}</div><h3>Broadcasts</h3><p class="sub">It sends <span class="mono">KL1|device|on|periods|height|counter|hmac</span> over 433 MHz LoRa. Devices verify it before switching.</p></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Run it</h3><pre class="frame" style="white-space:pre-wrap">cd gateway
cp devices.example.json devices.json   # add your vault links
KEEPLIT_KEY=... node gateway.mjs --port /dev/ttyACM0</pre>
  <p class="note">Without a board, <span class="mono">--dry-run</span> prints the frames instead of sending them.</p></div></div>`);
}

// ---------- router ----------
function render() {
  clearTimers();
  const h = location.hash || "#/";
  if (h.startsWith("#/v/")) pageVault(h.slice(4));
  else if (h === "#/new") pageNew();
  else if (h === "#/mine") pageMine();
  else if (h === "#/simulator") pageSimulator();
  else if (h === "#/gateway") pageGateway();
  else if (h === "#how") { pageHome(); $("#how")?.scrollIntoView({ behavior: "smooth" }); }
  else pageHome();
}
window.addEventListener("hashchange", () => { if (location.hash !== "#how") window.scrollTo(0, 0); render(); });
wallet.on(() => { const h = location.hash; if (h === "#/new" || h.startsWith("#/v/")) render(); else { const chip = document.querySelector(".top .spacer"); if (chip) render(); } });
wallet.resume();
fetch("config.json", { cache: "no-store" }).then((r) => r.json()).then((j) => { cfg = { ...cfg, ...j }; }).catch(() => {}).finally(render);
void hexToBin;
