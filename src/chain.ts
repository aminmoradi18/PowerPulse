// Chain logic for PowerPulse subscription vaults on Bitcoin Cash.
import { Contract, ElectrumNetworkProvider, TransactionBuilder, placeholderP2PKHUnlocker, placeholderSignature, utils } from "cashscript";
import { cashAddressToLockingBytecode, decodeCashAddress, encodeCashAddress, hexToBin, binToHex } from "@bitauth/libauth";
import artifact from "./power_subscription.json";

export type Net = "mainnet" | "chipnet";

export const MINER_FEE = 1000n; // fixed in the contract for `collect`
export const DUST = 546n;
export const BLOCKS_PER_DAY = 144;

export interface VaultParams {
  net: Net;
  deviceId: string;       // e.g. "ZA-014"
  label: string;          // e.g. "Baba's solar water pump"
  providerAddress: string; // cashaddr (p2pkh) of the energy provider
  payerPubkey: string;     // hex, compressed
  pledge: bigint;          // sats per period
  period: number;          // blocks
}

export interface VaultState {
  address: string;
  balance: bigint;
  utxoCount: number;
  ageBlocks: number | null;   // blocks since the vault UTXO was created; null = unconfirmed
  tipHeight: number;
  periodsLeft: number;
  canCollect: boolean;
  nextPayment: bigint | null;
  blocksToNextCollect: number;
  active: boolean;            // device should be ON
}

const providers = new Map<Net, ElectrumNetworkProvider>();
export function provider(net: Net): ElectrumNetworkProvider {
  let p = providers.get(net);
  if (!p) { p = new ElectrumNetworkProvider(net); providers.set(net, p); }
  return p;
}

export const prefixOf = (net: Net) => (net === "mainnet" ? "bitcoincash" : "bchtest");

export function pkhOfAddress(address: string): Uint8Array {
  const d = decodeCashAddress(address);
  if (typeof d === "string") throw new Error("Bad address: " + d);
  if (d.type !== "p2pkh" && d.type !== "p2pkhWithTokens") throw new Error("Provider address must be a normal (p2pkh) address");
  return d.payload;
}

export function addressOfPubkey(pubkey: Uint8Array, net: Net): string {
  return encodeCashAddress({ prefix: prefixOf(net) as any, type: "p2pkh", payload: utils.hash160(pubkey) }).address;
}

export function normalizeAddress(address: string, net: Net): string {
  const a = address.includes(":") ? address : `${prefixOf(net)}:${address}`;
  const d = decodeCashAddress(a);
  if (typeof d === "string") throw new Error("Bad address: " + d);
  if (d.prefix !== prefixOf(net)) throw new Error(`Address is for ${d.prefix}, but the app is on ${net}`);
  return a;
}

export function vaultContract(p: VaultParams): Contract {
  return new Contract(artifact as any, [pkhOfAddress(p.providerAddress), hexToBin(p.payerPubkey), p.pledge, BigInt(p.period)], { provider: provider(p.net) });
}

interface ElectrumUtxo { tx_hash: string; tx_pos: number; height: number; value: number }

function lockingHex(address: string): string {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === "string") throw new Error(r);
  return binToHex(r.bytecode);
}

export async function listUnspent(net: Net, address: string): Promise<ElectrumUtxo[]> {
  return (await provider(net).performRequest("blockchain.address.listunspent", address, "include_tokens")) as any;
}

export async function vaultState(p: VaultParams): Promise<VaultState> {
  const c = vaultContract(p);
  const [utxos, tip] = await Promise.all([listUnspent(p.net, c.address), provider(p.net).getBlockHeight()]);
  const balance = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
  // The covenant spends one coin at a time. A vault normally has one coin (top-ups merge coins), but a second plain
  // funding can leave two: count the periods of every coin and pay from the oldest coin that is due.
  const perPeriod = p.pledge + MINER_FEE;
  const usable = utxos.filter((u) => BigInt(u.value) >= perPeriod);
  const age = (u: ElectrumUtxo) => (u.height > 0 ? tip - u.height + 1 : null);
  const periodsLeft = usable.reduce((n, u) => n + Number(BigInt(u.value) / perPeriod), 0);
  const due = usable.filter((u) => (age(u) ?? -1) >= p.period);
  const nextDue = [...due].sort((a, b) => a.height - b.height)[0];
  const nextValue = nextDue ? BigInt(nextDue.value) : null;
  const nextPayment = nextValue === null
    ? null
    : nextValue - p.pledge - MINER_FEE <= perPeriod
      ? nextValue - MINER_FEE
      : p.pledge;
  const ages = usable.map((u) => age(u));
  const ageBlocks = !usable.length ? null : ages.some((a) => a === null) && ages.every((a) => a === null) ? null : Math.max(...ages.map((a) => a ?? 0));
  const canCollect = due.length > 0;
  const blocksToNextCollect = !usable.length ? 0 : canCollect ? 0 : Math.min(...usable.map((u) => { const a = age(u); return a === null ? p.period : Math.max(0, p.period - a); }));
  return {
    address: c.address,
    balance,
    utxoCount: utxos.length,
    ageBlocks,
    tipHeight: tip,
    periodsLeft,
    canCollect,
    nextPayment,
    blocksToNextCollect,
    active: usable.length > 0,
  };
}

/** Anyone can trigger the monthly payment: no signature needed, the contract enforces where the money goes. */
export async function collect(p: VaultParams): Promise<string> {
  const c = vaultContract(p);
  const utxos = await c.getUtxos();
  if (!utxos.length) throw new Error("Vault is empty");
  // Pay from the oldest confirmed coin that holds at least one period (it is the one most likely to be due).
  const perPeriod = p.pledge + MINER_FEE;
  const heights = new Map((await listUnspent(p.net, c.address)).map((x) => [`${x.tx_hash}:${x.tx_pos}`, x.height]));
  const ranked = utxos.filter((x) => x.satoshis >= perPeriod)
    .sort((a, b) => (heights.get(`${a.txid}:${a.vout}`) || Infinity) - (heights.get(`${b.txid}:${b.vout}`) || Infinity));
  const u = ranked[0];
  if (!u) throw new Error("Vault is empty");
  const change = u.satoshis - p.pledge - MINER_FEE;
  const tb = new TransactionBuilder({ provider: provider(p.net) });
  tb.addInput(u, c.unlock.collect(), { sequence: p.period });
  if (change <= p.pledge + MINER_FEE) {
    tb.addOutput({ to: p.providerAddress, amount: u.satoshis - MINER_FEE });
  } else {
    tb.addOutput({ to: p.providerAddress, amount: p.pledge });
    tb.addOutput({ to: c.address, amount: change });
  }
  const tx = await tb.send();
  return tx.txid;
}

export interface WalletUtxo { txid: string; vout: number; satoshis: bigint; path: "receive" | "change"; index: number; address: string }

export async function walletUtxos(net: Net, keys: { path: "receive" | "change"; index: number; pubkey: Uint8Array }[]): Promise<WalletUtxo[]> {
  const out: WalletUtxo[] = [];
  await Promise.all(keys.map(async (k) => {
    const address = addressOfPubkey(k.pubkey, net);
    const list = await listUnspent(net, address);
    for (const u of list) {
      if ((u as any).token_data) continue; // never spend token UTXOs by accident
      out.push({ txid: u.tx_hash, vout: u.tx_pos, satoshis: BigInt(u.value), path: k.path, index: k.index, address });
    }
  }));
  return out.sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
}

/** Build the funding transaction: wallet coins -> vault, change -> wallet, plus an OP_RETURN tag. */
export function buildFunding(p: VaultParams, coins: WalletUtxo[], amount: bigint, changeAddress: string) {
  const c = vaultContract(p);
  const picked: WalletUtxo[] = [];
  let sum = 0n;
  for (const u of coins) { picked.push(u); sum += u.satoshis; if (sum >= amount + 2000n) break; }
  const feeEstimate = BigInt(200 + picked.length * 150);
  if (sum < amount + feeEstimate) throw new Error(`Not enough BCH in wallet: need ${amount + feeEstimate} sats, have ${sum}`);
  const tb = new TransactionBuilder({ provider: provider(p.net) });
  picked.forEach((u) => tb.addInput({ txid: u.txid, vout: u.vout, satoshis: u.satoshis, lockingBytecode: lockingHex(u.address) } as any, placeholderP2PKHUnlocker(u.address)));
  tb.addOutput({ to: c.address, amount });
  tb.addOpReturnOutput(["KEEPLIT", p.deviceId]);
  const change = sum - amount - feeEstimate;
  if (change >= DUST) tb.addOutput({ to: changeAddress, amount: change });
  const wc = tb.generateWcTransactionObject({ broadcast: false, userPrompt: `Fund ${p.label} (${p.deviceId})` });
  const inputPaths = picked.map((u, i) => [i, u.path, u.index]) as [number, string, number][];
  return { wc, inputPaths, vaultAddress: c.address };
}

/**
 * Top up a vault with more periods. The payer's cancel signature lets the old vault coin(s) be spent together with
 * new wallet coins into ONE new vault coin, so the provider still gets only one payment per period.
 * The period clock restarts at the top-up.
 */
export async function buildTopUp(p: VaultParams, coins: WalletUtxo[], amount: bigint, changeAddress: string, payerIndex = 0) {
  const c = vaultContract(p);
  const vaultUtxos = await c.getUtxos();
  const inVault = vaultUtxos.reduce((s, u) => s + u.satoshis, 0n);
  const picked: WalletUtxo[] = [];
  let sum = 0n;
  for (const u of coins) { picked.push(u); sum += u.satoshis; if (sum >= amount + 3000n) break; }
  const fee = BigInt(250 + vaultUtxos.length * 180 + picked.length * 150);
  if (sum < amount + fee) throw new Error(`Not enough BCH in wallet: need ${amount + fee} sats, have ${sum}`);
  const tb = new TransactionBuilder({ provider: provider(p.net) });
  vaultUtxos.forEach((u) => tb.addInput(u, c.unlock.cancel(placeholderSignature())));
  picked.forEach((u) => tb.addInput({ txid: u.txid, vout: u.vout, satoshis: u.satoshis, lockingBytecode: lockingHex(u.address) } as any, placeholderP2PKHUnlocker(u.address)));
  tb.addOutput({ to: c.address, amount: inVault + amount });
  tb.addOpReturnOutput(["KEEPLIT", p.deviceId]);
  const change = sum - amount - fee;
  if (change >= DUST) tb.addOutput({ to: changeAddress, amount: change });
  const wc = tb.generateWcTransactionObject({ broadcast: false, userPrompt: `Add ${amount} sats to ${p.label} (${p.deviceId})` });
  const inputPaths = [
    ...vaultUtxos.map((_, i) => [i, "receive", payerIndex]),
    ...picked.map((u, i) => [vaultUtxos.length + i, u.path, u.index]),
  ] as [number, string, number][];
  return { wc, inputPaths, newTotal: inVault + amount };
}

/** Build the cancel transaction: payer signs, everything left returns to the payer. */
export async function buildCancel(p: VaultParams, payerIndex: number) {
  const c = vaultContract(p);
  const utxos = await c.getUtxos();
  if (!utxos.length) throw new Error("Vault is already empty");
  const total = utxos.reduce((s, u) => s + u.satoshis, 0n);
  const fee = BigInt(250 + utxos.length * 180);
  const to = addressOfPubkey(hexToBin(p.payerPubkey), p.net);
  const tb = new TransactionBuilder({ provider: provider(p.net) });
  utxos.forEach((u) => tb.addInput(u, c.unlock.cancel(placeholderSignature())));
  tb.addOutput({ to, amount: total - fee });
  const wc = tb.generateWcTransactionObject({ broadcast: false, userPrompt: `Cancel ${p.label} and refund ${total - fee} sats` });
  const inputPaths = utxos.map((_, i) => [i, "receive", payerIndex]) as [number, string, number][];
  return { wc, inputPaths, refund: total - fee };
}

export async function broadcast(net: Net, rawHex: string): Promise<string> {
  return provider(net).sendRawTransaction(rawHex);
}

export function explorerTx(net: Net, txid: string): string {
  return net === "mainnet" ? `https://explorer.salemkode.com/tx/${txid}` : `https://chipnet.imaginary.cash/tx/${txid}`;
}

export const satsToBch = (s: bigint) => (Number(s) / 1e8).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
export { binToHex, hexToBin };
