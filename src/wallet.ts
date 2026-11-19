import { publicKeyToP2pkhCashAddress, stringify } from "@bitauth/libauth";
import { initiateDappRelay } from "@wizardconnect/core";
import { DappConnectionManager } from "@wizardconnect/dapp";

export type WalletStatus = "idle" | "waiting" | "connected" | "reconnecting" | "error";
export type WalletPath = "receive" | "change";

type Listener = () => void;
type ExistingCredentials = {
  privateKey: string;
  secret: string;
  walletPublicKey: string;
};

const SESSION_KEY = "powerpulse-wizardconnect-session";

class Wallet {
  status: WalletStatus = "idle";
  name: string | null = null;
  uri = "";
  qrUri = "";
  error: string | null = null;
  private manager: DappConnectionManager | null = null;
  private relay: ReturnType<typeof initiateDappRelay> | null = null;
  private readonly listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  get connected(): boolean {
    return this.status === "connected" && this.manager !== null;
  }

  async connect(): Promise<string> {
    await this.disconnect(false);
    this.error = null;
    this.start();
    return this.uri;
  }

  resume(): void {
    try {
      const probe = this.createManager();
      const stored = probe.loadStoredSession();
      if (!stored?.privateKey || !stored.secret || !stored.walletPublicKey) return;

      this.start({
        privateKey: stored.privateKey,
        secret: stored.secret,
        walletPublicKey: stored.walletPublicKey,
      });
    } catch (error) {
      this.setError(error);
    }
  }

  async disconnect(notifyWallet = true): Promise<void> {
    const manager = this.manager;
    const relay = this.relay;
    const wasConnected = this.connected;
    this.manager = null;
    this.relay = null;
    this.status = "idle";
    this.name = null;
    this.uri = "";
    this.qrUri = "";
    this.error = null;

    let notificationError: unknown;
    if (manager && notifyWallet && wasConnected) {
      try {
        await manager.sendDisconnect("PowerPulse disconnected");
      } catch (error) {
        notificationError = error;
      }
    }

    let cleanupError: unknown;
    if (manager) {
      manager.clearStoredSession();
      try {
        await manager.destroy();
      } catch (error) {
        cleanupError = error;
      }
    }
    relay?.cleanup();
    this.emit();

    if (notificationError) {
      throw new Error(`Wallet disconnected locally, but notification failed: ${String(notificationError)}`);
    }
    if (cleanupError) {
      throw new Error(`Wallet disconnected locally, but session cleanup failed: ${String(cleanupError)}`);
    }
  }

  pubkey(path: WalletPath, index: number): Uint8Array | undefined {
    if (!this.manager) return undefined;
    return this.manager.getPubkey(path === "receive" ? 0 : 1, BigInt(index));
  }

  receiveAddress(): string | undefined {
    const publicKey = this.pubkey("receive", 0);
    if (!publicKey) return undefined;
    return publicKeyToP2pkhCashAddress({ publicKey, prefix: "bchtest" }).address;
  }

  async sign(transaction: unknown, inputPaths: [number, string, number][]): Promise<string> {
    if (!this.connected || !this.manager) {
      throw new Error("Wallet is not connected");
    }

    const response = await this.manager.signTransaction({
      transaction: JSON.parse(stringify(transaction)),
      inputPaths,
    });

    if (response.error) throw new Error(response.error);
    if (!response.signedTransaction) throw new Error("The wallet returned no signed transaction.");
    return response.signedTransaction;
  }

  private createManager(): DappConnectionManager {
    return new DappConnectionManager("PowerPulse", undefined, {
      session: { key: SESSION_KEY },
    });
  }

  private start(existing?: ExistingCredentials): void {
    const manager = this.createManager();
    this.manager = manager;
    manager.on("walletready", (message) => {
      if (this.manager !== manager) return;
      this.status = "connected";
      this.name = message.wallet_name;
      this.error = null;
      this.emit();
    });
    manager.on("disconnect", (_reason, message) => {
      if (this.manager !== manager) return;
      const relay = this.relay;
      this.manager = null;
      this.relay = null;
      this.status = "idle";
      this.name = null;
      this.uri = "";
      this.qrUri = "";
      this.error = message ?? null;
      manager.clearStoredSession();
      void manager.destroy()
        .then(() => relay?.cleanup())
        .catch((error: unknown) => {
          relay?.cleanup();
          this.setError(error);
        });
      this.emit();
    });
    manager.on("reconnecting", () => {
      if (this.manager !== manager) return;
      this.status = "reconnecting";
      this.emit();
    });

    const relay = initiateDappRelay(
      ({ client, status }) => {
        manager.updateConnection(client, status);
        if (this.manager !== manager) return;

        if (status.status === "reconnecting") {
          this.status = "reconnecting";
          this.emit();
        } else if (status.status === "session_deleted") {
          this.status = "idle";
          this.name = null;
          this.error = "The saved wallet session expired. Connect again to continue.";
          manager.clearStoredSession();
          this.emit();
        } else if (status.status === "disconnected" && this.status !== "connected") {
          this.status = existing ? "reconnecting" : "waiting";
          this.emit();
        }
      },
      existing ? { existingCredentials: existing } : undefined,
    );

    this.relay = relay;
    manager.attachRelay(relay);
    this.uri = relay.uri;
    this.qrUri = relay.qrUri || relay.uri;
    this.status = existing ? "reconnecting" : "waiting";
    this.emit();
  }

  private setError(error: unknown): void {
    this.status = "error";
    this.error = error instanceof Error ? error.message : String(error);
    this.emit();
  }
}

export const wallet = new Wallet();
