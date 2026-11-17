// Local script tests of the PowerSubscription covenant using CashScript's MockNetworkProvider.
import { Contract, MockNetworkProvider, TransactionBuilder, SignatureTemplate, randomUtxo } from "cashscript";
import { secp256k1, encodeCashAddress, hash160 } from "@bitauth/libauth";
import { readFileSync } from "node:fs";
const artifact = JSON.parse(readFileSync(new URL("../src/power_subscription.json", import.meta.url)));
const key = (n) => { const k = new Uint8Array(32); k[31] = n; return k; };
const payerPriv = key(7), providerPriv = key(9), thiefPriv = key(11);
const pub = (k) => secp256k1.derivePublicKeyCompressed(k);
const addr = (k) => encodeCashAddress({ prefix: "bchtest", type: "p2pkh", payload: hash160(pub(k)) }).address;
const provider = new MockNetworkProvider();
const PLEDGE = 5000n, PERIOD = 6n;
const c = new Contract(artifact, [hash160(pub(providerPriv)), pub(payerPriv), PLEDGE, PERIOD], { provider });
let pass = 0, fail = 0;
async function expectOk(name, fn) { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { fail++; console.log("FAIL", name, e.message.split("\n")[0]); } }
async function expectFail(name, fn) { try { await fn(); fail++; console.log("FAIL (should be rejected)", name); } catch (e) { const m = e.message.split("\n")[0]; if (/lockingBytecode/.test(m)) { fail++; console.log("FAIL (setup)", name, m); } else { pass++; console.log("ok  ", name, "(rejected:", m.slice(0, 70) + ")"); } } }
const fresh = async (sats) => { const u = randomUtxo({ satoshis: sats }); provider.addUtxo(c.address, u); return (await c.getUtxos()).find((x) => x.txid === u.txid); };

await expectOk("collect after period pays provider and keeps change in vault", async () => {
  const u = await fresh(100000n);
  await new TransactionBuilder({ provider }).addInput(u, c.unlock.collect(), { sequence: 6 })
    .addOutput({ to: addr(providerPriv), amount: PLEDGE })
    .addOutput({ to: c.address, amount: 100000n - PLEDGE - 1000n }).send();
});
await expectFail("collect before period (sequence 5)", async () => {
  const u = await fresh(100000n);
  await new TransactionBuilder({ provider }).addInput(u, c.unlock.collect(), { sequence: 5 })
    .addOutput({ to: addr(providerPriv), amount: PLEDGE })
    .addOutput({ to: c.address, amount: 100000n - PLEDGE - 1000n }).send();
});
await expectFail("collect paying a thief", async () => {
  const u = await fresh(100000n);
  await new TransactionBuilder({ provider }).addInput(u, c.unlock.collect(), { sequence: 6 })
    .addOutput({ to: addr(thiefPriv), amount: PLEDGE })
    .addOutput({ to: c.address, amount: 100000n - PLEDGE - 1000n }).send();
});
await expectFail("collect taking double pledge", async () => {
  const u = await fresh(100000n);
  await new TransactionBuilder({ provider }).addInput(u, c.unlock.collect(), { sequence: 6 })
    .addOutput({ to: addr(providerPriv), amount: PLEDGE * 2n })
    .addOutput({ to: c.address, amount: 100000n - PLEDGE * 2n - 1000n }).send();
});
await expectOk("last collect sweeps the remainder to provider", async () => {
  const u = await fresh(9000n);
  await new TransactionBuilder({ provider }).addInput(u, c.unlock.collect(), { sequence: 6 })
    .addOutput({ to: addr(providerPriv), amount: 8000n }).send();
});
await expectOk("payer cancels and gets everything back", async () => {
  const u = await fresh(50000n);
  await new TransactionBuilder({ provider }).addInput(u, c.unlock.cancel(new SignatureTemplate(payerPriv)))
    .addOutput({ to: addr(payerPriv), amount: 49500n }).send();
});
await expectFail("provider cannot cancel", async () => {
  const u = await fresh(50000n);
  await new TransactionBuilder({ provider }).addInput(u, c.unlock.cancel(new SignatureTemplate(providerPriv)))
    .addOutput({ to: addr(providerPriv), amount: 49500n }).send();
});
await expectOk("payer tops up: old vault coin + new coin merge into one vault coin", async () => {
  const u = await fresh(20000n);
  const extra = randomUtxo({ satoshis: 30000n });
  provider.addUtxo(addr(payerPriv), extra);
  const w = (await provider.getUtxos(addr(payerPriv))).find((x) => x.txid === extra.txid);
  await new TransactionBuilder({ provider })
    .addInput(u, c.unlock.cancel(new SignatureTemplate(payerPriv)))
    .addInput(w, new SignatureTemplate(payerPriv).unlockP2PKH())
    .addOutput({ to: c.address, amount: 49000n }).send();
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
