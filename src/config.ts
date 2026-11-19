// Fixed project settings. Links that change (slides, video, demo vault) live in public/config.json.
import type { Net } from "./chain";

export const PROJECT = {
  name: "KeepLit",
  tagline: "Keep the water flowing",
  repo: "https://github.com/aminmoradi18/PowerPulse",
  slides: "", // link to the Widget Factory presentation (Google Slides), added before submission
  video: "", // link to the hardware demo video
  // CashTokens address for EMBER2026 community-choice donations (required by BLAZE rules)
  donation: "bitcoincash:zzek3l5ux58rp0ptdkdzqeakptlahng0vuef5dpj4e",
};

// The demo energy provider ("Sunrise Solar Co-op"). Monthly payments from vaults land here.
export const DEFAULT_PROVIDER: Record<Net, string> = {
  mainnet: "bitcoincash:qzek3l5ux58rp0ptdkdzqeakptlahng0vu7r8n0522",
  chipnet: "bchtest:qrytwp6zkte8v8y6gcq7v7cv38nearpluqjundkdxv",
};

// Plans. Period is in blocks (one block is about 10 minutes).
export const PLANS = [
  { id: "demo", name: "Demo", detail: "every block (~10 min)", period: 1, pledgeSats: 2000n },
  { id: "daily", name: "Daily", detail: "every 144 blocks (~1 day)", period: 144, pledgeSats: 3000n },
  { id: "monthly", name: "Monthly", detail: "every 4320 blocks (~30 days)", period: 4320, pledgeSats: 90000n },
] as const;
