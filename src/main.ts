import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root element was not found");
}

app.innerHTML = `
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="#" aria-label="PowerPulse home">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M17.5 5 8 17h7l-1 10 10-13h-7l.5-9Z" fill="currentColor"/>
          </svg>
        </span>
        <span>PowerPulse</span>
      </a>
      <nav class="main-nav" aria-label="Main navigation">
        <a href="#how">How it works</a>
        <a href="#impact">Why PowerPulse</a>
        <a href="#hardware">The hardware</a>
      </nav>
      <a class="button button-small button-outline" href="#get-started">Start a plan <span aria-hidden="true">↗</span></a>
    </div>
  </header>

  <main>
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-icon" aria-hidden="true">✳</span> SOLAR ENERGY, ON YOUR TERMS</p>
        <h1 id="hero-title">Keep the water<br /><span class="highlight">flowing.</span></h1>
        <p class="hero-lead">
          Help power a family home or a farm's water pump from anywhere. PowerPulse is designed
          around flexible payments and dependable energy for communities beyond the grid.
        </p>
        <div class="hero-actions">
          <a class="button button-sun" href="#get-started">Explore a power plan <span aria-hidden="true">→</span></a>
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
          <div class="sky-glow"></div>
          <div class="sun"></div>
          <div class="cloud cloud-one"></div>
          <div class="cloud cloud-two"></div>
          <div class="distant-hill"></div>
          <div class="near-hill"></div>
          <div class="field-ground"></div>
          <div class="solar-array">
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="home">
            <div class="roof"></div>
            <div class="walls"><i></i><b></b></div>
          </div>
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
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 11 12 4l9 7v9H3v-9Z"/><path d="M9 20v-6h6v6M4 9l8-6 8 6"/></svg>
          </div>
          <h3>Choose what needs power</h3>
          <p>A family solar kit, a farm's water pump, or another essential community service.</p>
        </article>
        <article class="step-card">
          <span class="step-number">02</span>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
          </div>
          <h3>Support one period at a time</h3>
          <p>Make energy access more manageable with payments organized around clear periods.</p>
        </article>
        <article class="step-card">
          <span class="step-number">03</span>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 10a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0m-5 4h.01"/><path d="M12 17v4m-3 0h6"/></svg>
          </div>
          <h3>Keep energy within reach</h3>
          <p>Radio connectivity can carry device updates to remote places with limited mobile coverage.</p>
        </article>
      </div>
    </section>

    <section class="hardware-section" id="hardware">
      <div class="wrap hardware-inner">
        <div>
          <p class="eyebrow">BUILT FOR THE LAST MILE</p>
          <h2>Power, even beyond the signal.</h2>
          <p class="hardware-copy">PowerPulse is designed to pair a connected village gateway with a low-power radio device in the field—bringing essential energy to places where cellular coverage can be unreliable.</p>
          <a class="inline-link" href="#get-started">Discover the PowerPulse approach <span aria-hidden="true">→</span></a>
        </div>
        <div class="radio-visual" aria-hidden="true">
          <div class="radio-sun"></div>
          <div class="signal signal-one"></div>
          <div class="signal signal-two"></div>
          <div class="signal signal-three"></div>
          <div class="radio-node node-home"><span class="node-icon">⌂</span><small>HOME</small></div>
          <div class="radio-node node-gateway"><span class="node-icon">⌁</span><small>GATEWAY</small></div>
          <div class="radio-node node-pump"><span class="node-icon">◉</span><small>WATER</small></div>
          <div class="signal-line"></div>
          <span class="signal-label">LONG-RANGE RADIO</span>
        </div>
      </div>
    </section>

    <section class="closing-cta wrap" id="get-started">
      <div class="cta-mark" aria-hidden="true">✳</div>
      <div>
        <p class="eyebrow">POWER FOR WHAT MATTERS</p>
        <h2>Make room for more possibility.</h2>
        <p>Explore how flexible solar energy could support your home or community.</p>
      </div>
      <a class="button button-sun" href="#hero-title">Explore PowerPulse <span aria-hidden="true">↗</span></a>
    </section>
  </main>

  <footer class="footer">
    <div class="wrap footer-inner">
      <a class="brand" href="#" aria-label="PowerPulse home">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none"><path d="M17.5 5 8 17h7l-1 10 10-13h-7l.5-9Z" fill="currentColor"/></svg>
        </span>
        <span>PowerPulse</span>
      </a>
      <p>Solar energy, designed around people.</p>
      <a href="#hero-title">Back to top ↑</a>
    </div>
  </footer>
`;
