import "./style.css";
import { icon } from "./icons";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root element was not found");
}

interface DemoPlan {
  id: number;
  name: string;
  service: string;
  cadence: string;
  amount: number;
}

const demoPlans: DemoPlan[] = [];

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

function header(activeRoute: string): string {
  const links = [
    ["/", "Home"],
    ["/new", "Start a plan"],
    ["/mine", "My plans"],
    ["/gateway", "Village gateway"],
  ];

  return `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#/" aria-label="PowerPulse home">
          <span class="brand-mark" aria-hidden="true">${icon("bolt")}</span>
          <span>PowerPulse</span>
        </a>
        <nav class="main-nav" aria-label="Main navigation">
          ${links.map(([href, label]) => `
            <a href="#${href}"${activeRoute === href ? ' aria-current="page"' : ""}>${label}</a>
          `).join("")}
        </nav>
        <a class="button button-small button-outline header-cta" href="#/new">Start a plan <span aria-hidden="true">↗</span></a>
      </div>
    </header>`;
}

function footer(): string {
  return `
    <footer class="footer">
      <div class="wrap footer-inner">
        <a class="brand" href="#/" aria-label="PowerPulse home">
          <span class="brand-mark" aria-hidden="true">${icon("bolt")}</span>
          <span>PowerPulse</span>
        </a>
        <p>Solar energy, designed around people.</p>
        <span class="prototype-note">Early product preview</span>
      </div>
    </footer>`;
}

function homePage(): string {
  return `
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-icon" aria-hidden="true">✳</span> SOLAR ENERGY, ON YOUR TERMS</p>
        <h1 id="hero-title">Keep the water<br /><span class="highlight">flowing.</span></h1>
        <p class="hero-lead">
          Help power a family home or a farm's water pump from anywhere. PowerPulse is designed
          around flexible payments and dependable energy for communities beyond the grid.
        </p>
        <div class="hero-actions">
          <a class="button button-sun" href="#/new">Start a power plan <span aria-hidden="true">→</span></a>
          <a class="button button-quiet" href="#how"><span class="play-icon" aria-hidden="true">▷</span> See how it works</a>
        </div>
        <div class="trust-list" aria-label="PowerPulse principles">
          <span><i aria-hidden="true">✓</i> Flexible, period-by-period support</span>
          <span><i aria-hidden="true">✓</i> Designed for remote communities</span>
          <span><i aria-hidden="true">✓</i> People stay in control</span>
        </div>
      </div>

      <div class="device-card" aria-label="Illustration preview of a solar-powered water pump">
        <div class="device-card-header">
          <div>
            <p class="card-overline">POWERPULSE · FIELD PREVIEW</p>
            <h2>Sunrise Solar Co-op</h2>
          </div>
          <span class="status-pill"><i></i> SIMULATION</span>
        </div>
        <div class="landscape" role="img" aria-label="Solar panels, a home and a water pump in a sunny landscape">
          <div class="sky-glow"></div><div class="sun"></div>
          <div class="cloud cloud-one"></div><div class="cloud cloud-two"></div>
          <div class="distant-hill"></div><div class="near-hill"></div><div class="field-ground"></div>
          <div class="solar-array"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          <div class="home"><div class="roof"></div><div class="walls"><i></i><b></b></div></div>
          <div class="radio-tower"><i></i><span class="radio-wave wave-a"></span><span class="radio-wave wave-b"></span></div>
          <div class="water-pump"><i></i><b></b><span></span></div>
          <div class="water-drops"><i></i><i></i><i></i></div>
        </div>
        <div class="device-stats">
          <div><span>Device</span><strong>Village water pump</strong></div>
          <div><span>Energy</span><strong><i class="live-dot"></i> Solar powered</strong></div>
          <div><span>Connectivity</span><strong>LoRa radio</strong></div>
        </div>
        <p class="demo-caption">Illustrative interface · Device controls are not connected</p>
      </div>
    </section>

    <section class="principle-strip" id="impact">
      <div class="wrap principle-inner">
        <p class="strip-label">ENERGY SHOULD WORK FOR PEOPLE</p>
        <p class="strip-copy">A family's power or a village pump should not depend on a strong mobile signal—or a company holding all the keys.</p>
        <span class="strip-symbol" aria-hidden="true">✳</span>
      </div>
    </section>

    <section class="section wrap" id="how" aria-labelledby="how-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">A CLEARER WAY TO POWER ESSENTIALS</p>
          <h2 id="how-title">How PowerPulse works</h2>
        </div>
        <p class="section-intro">A simple idea connecting people who need energy, the providers who deliver it, and devices in places the grid doesn't reach.</p>
      </div>
      <div class="steps-grid">
        <article class="step-card">
          <span class="step-number">01</span>
          <div class="step-icon" aria-hidden="true">${icon("home")}</div>
          <h3>Choose what needs power</h3>
          <p>A family solar kit, a farm's water pump, or another essential community service.</p>
        </article>
        <article class="step-card">
          <span class="step-number">02</span>
          <div class="step-icon" aria-hidden="true">${icon("card")}</div>
          <h3>Support one period at a time</h3>
          <p>Make energy access more manageable with payments organized around clear periods.</p>
        </article>
        <article class="step-card">
          <span class="step-number">03</span>
          <div class="step-icon" aria-hidden="true">${icon("radio")}</div>
          <h3>Keep energy within reach</h3>
          <p>Radio connectivity can carry device updates to remote places with limited mobile coverage.</p>
        </article>
      </div>
      <div class="home-next-step">
        <span>Ready to explore a plan?</span>
        <a class="inline-link" href="#/new">Start with a device <span aria-hidden="true">→</span></a>
      </div>
    </section>

    <section class="hardware-section" id="hardware">
      <div class="wrap hardware-inner">
        <div>
          <p class="eyebrow">BUILT FOR THE LAST MILE</p>
          <h2>Power, even beyond the signal.</h2>
          <p class="hardware-copy">PowerPulse is designed to pair a connected village gateway with a low-power radio device in the field—bringing essential energy to places where cellular coverage can be unreliable.</p>
          <a class="inline-link" href="#/gateway">Explore the village gateway <span aria-hidden="true">→</span></a>
        </div>
        <div class="radio-visual" aria-hidden="true">
          <div class="radio-sun"></div><div class="signal signal-one"></div>
          <div class="signal signal-two"></div><div class="signal signal-three"></div>
          <div class="radio-node node-home"><span class="node-icon">⌂</span><small>HOME</small></div>
          <div class="radio-node node-gateway"><span class="node-icon">⌁</span><small>GATEWAY</small></div>
          <div class="radio-node node-pump"><span class="node-icon">◉</span><small>WATER</small></div>
          <div class="signal-line"></div><span class="signal-label">LONG-RANGE RADIO</span>
        </div>
      </div>
    </section>

    <section class="closing-cta wrap">
      <div class="cta-mark" aria-hidden="true">✳</div>
      <div>
        <p class="eyebrow">POWER FOR WHAT MATTERS</p>
        <h2>Make room for more possibility.</h2>
        <p>Explore how flexible solar energy could support your home or community.</p>
      </div>
      <a class="button button-sun" href="#/new">Explore a plan <span aria-hidden="true">↗</span></a>
    </section>`;
}

function startPlanPage(): string {
  return `
    <section class="page-section wrap" aria-labelledby="page-title">
      <div class="page-heading">
        <a class="back-link" href="#/">← Back to home</a>
        <p class="eyebrow">A FEW DETAILS TO GET STARTED</p>
        <h1 id="page-title">Set up a power plan</h1>
        <p class="page-lead">Choose the device and support schedule you want to explore. This preview does not connect a wallet or make a payment.</p>
      </div>
      <div class="form-layout">
        <form class="plan-form card-panel" id="plan-form">
          <label class="field-label" for="plan-name">Plan name <span>Give this plan a name you recognize</span></label>
          <input id="plan-name" name="name" maxlength="60" placeholder="e.g. North field water pump" required />

          <label class="field-label" for="plan-service">What needs power?</label>
          <select id="plan-service" name="service">
            <option>Village water pump</option>
            <option>Family solar home kit</option>
            <option>Community service</option>
          </select>

          <fieldset class="field-group">
            <legend class="field-label">Support schedule <span>Choose a preview schedule</span></legend>
            <div class="schedule-options">
              <label class="schedule-option">
                <input type="radio" name="cadence" value="Daily" checked />
                <span><strong>Daily</strong><small>One period per day</small></span>
              </label>
              <label class="schedule-option">
                <input type="radio" name="cadence" value="Monthly" />
                <span><strong>Monthly</strong><small>One period per month</small></span>
              </label>
            </div>
          </fieldset>

          <label class="field-label" for="plan-amount">Indicative amount <span>Preview only · no funds are sent</span></label>
          <div class="amount-field">
            <input id="plan-amount" name="amount" type="number" min="1" max="1000000" step="1" value="3000" required />
            <span>sat / period</span>
          </div>

          <div class="prototype-disclaimer">${icon("info")} Wallet connection and on-chain payment will be added later.</div>
          <button class="button button-sun submit-button" type="submit">Create preview plan <span aria-hidden="true">→</span></button>
        </form>

        <aside class="plan-aside">
          <div class="aside-icon">${icon("sun")}</div>
          <h2>Your energy plan</h2>
          <p>PowerPulse plans are designed to support essential solar energy one period at a time.</p>
          <ul>
            <li>${icon("check")} You choose the device</li>
            <li>${icon("check")} You choose the schedule</li>
            <li>${icon("check")} This step is only a local preview</li>
          </ul>
          <div class="aside-footnote">No wallet is connected. Nothing is signed, broadcast, or charged.</div>
        </aside>
      </div>
    </section>`;
}

function myPlansPage(): string {
  const plans = demoPlans.length
    ? `<div class="plan-list">${demoPlans.map((plan) => `
        <article class="saved-plan card-panel">
          <div class="saved-plan-icon">${icon("bolt")}</div>
          <div class="saved-plan-copy">
            <span class="status-pill preview-status">LOCAL PREVIEW</span>
            <h2>${escapeHtml(plan.name)}</h2>
            <p>${escapeHtml(plan.service)} · ${escapeHtml(plan.cadence)} schedule</p>
          </div>
          <div class="saved-plan-amount"><strong>${plan.amount.toLocaleString("en-US")}</strong><span>sat / period</span></div>
        </article>
      `).join("")}</div>`
    : `<div class="empty-state card-panel">
        <div class="empty-icon">${icon("sun")}</div>
        <h2>No plans in this preview yet</h2>
        <p>Create a sample plan to see how it will appear here. It will only stay in this browser session.</p>
        <a class="button button-sun" href="#/new">Create a preview plan <span aria-hidden="true">→</span></a>
      </div>`;

  return `
    <section class="page-section wrap" aria-labelledby="page-title">
      <div class="page-heading">
        <p class="eyebrow">YOUR POWERPULSE DASHBOARD</p>
        <h1 id="page-title">My plans</h1>
        <p class="page-lead">Review plans created during this preview session.</p>
      </div>
      <div class="preview-banner">${icon("info")} Preview only. Plans here are temporary and are not linked to a wallet or blockchain.</div>
      ${plans}
      <a class="button button-outline add-plan-button" href="#/new">Add another plan <span aria-hidden="true">+</span></a>
    </section>`;
}

function gatewayPage(): string {
  return `
    <section class="page-section wrap" aria-labelledby="page-title">
      <div class="page-heading">
        <p class="eyebrow">REMOTE ENERGY, CONNECTED</p>
        <h1 id="page-title">Village gateway</h1>
        <p class="page-lead">A gateway can connect on-chain plan status to devices in places where mobile coverage is limited.</p>
      </div>
      <div class="gateway-layout">
        <div class="gateway-card card-panel">
          <div class="gateway-card-heading">
            <div class="aside-icon">${icon("radio")}</div>
            <span class="status-pill preview-status">CONCEPT</span>
          </div>
          <h2>How the gateway fits in</h2>
          <p>The gateway is the bridge between an internet-connected location and remote solar devices.</p>
          <div class="gateway-flow">
            <div><span>${icon("chain")}</span><strong>Plan status</strong><small>Read from network</small></div>
            <i aria-hidden="true">→</i>
            <div><span>${icon("radio")}</span><strong>Gateway</strong><small>Relays a radio message</small></div>
            <i aria-hidden="true">→</i>
            <div><span>${icon("pump")}</span><strong>Field device</strong><small>Receives an update</small></div>
          </div>
        </div>
        <aside class="gateway-note card-panel">
          <div class="aside-icon">${icon("info")}</div>
          <h2>Not connected yet</h2>
          <p>This screen is a product preview. It does not read the blockchain, send radio messages, or control hardware.</p>
          <a class="inline-link" href="#/new">Explore a sample plan <span aria-hidden="true">→</span></a>
        </aside>
      </div>
    </section>`;
}

function render(): void {
  const route = location.hash.startsWith("#/")
    ? location.hash.slice(1).split("?")[0]
    : "/";

  const page = route === "/new"
    ? startPlanPage()
    : route === "/mine"
      ? myPlansPage()
      : route === "/gateway"
        ? gatewayPage()
        : homePage();

  app.innerHTML = `${header(route)}<main>${page}</main>${footer()}`;

  const form = document.querySelector<HTMLFormElement>("#plan-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    demoPlans.unshift({
      id: Date.now(),
      name: String(formData.get("name") ?? "").trim(),
      service: String(formData.get("service") ?? ""),
      cadence: String(formData.get("cadence") ?? "Daily"),
      amount: Number(formData.get("amount")),
    });
    location.hash = "/mine";
  });
}

window.addEventListener("hashchange", render);
render();
