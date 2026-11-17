import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root element was not found");
}

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#" aria-label="PowerPulse home">
      <span class="brand-mark" aria-hidden="true">P</span>
      <span>PowerPulse</span>
    </a>
    <nav class="main-nav" aria-label="Main navigation">
      <a href="#how-it-works">How it works</a>
      <a href="#for-communities">For communities</a>
    </nav>
    <a class="header-action" href="#get-started">Get started <span aria-hidden="true">↗</span></a>
  </header>

  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="status-dot"></span> SOLAR POWER, MADE MORE ACCESSIBLE</p>
        <h1 id="hero-title">A little power.<br /><span>A lot more possibility.</span></h1>
        <p class="hero-description">
          Keep essential energy within reach with solar power you can pay for one period at a time.
          Built for homes and communities beyond the grid.
        </p>
        <div class="hero-actions" id="get-started">
          <a class="button button-primary" href="#how-it-works">Explore the idea <span aria-hidden="true">→</span></a>
          <a class="text-link" href="#for-communities">See who it’s for <span aria-hidden="true">↓</span></a>
        </div>
        <p class="preview-note">Product preview · Wallet and payment features are not connected yet</p>
      </div>

      <div class="hero-art" aria-label="Illustration of a solar-powered home">
        <div class="art-sun"></div>
        <div class="art-orbit orbit-one"></div>
        <div class="art-orbit orbit-two"></div>
        <div class="energy-card">
          <div class="energy-card-top">
            <span class="energy-icon" aria-hidden="true">✳</span>
            <span class="demo-label">CONCEPT</span>
          </div>
          <p class="energy-label">Power for everyday</p>
          <div class="energy-visual" aria-hidden="true">
            <div class="visual-hill hill-back"></div>
            <div class="visual-hill hill-front"></div>
            <div class="visual-house">
              <div class="house-roof"></div>
              <div class="house-body"><span></span><i></i></div>
            </div>
            <div class="solar-panel"><b></b><b></b><b></b><b></b><b></b><b></b></div>
          </div>
          <div class="energy-card-bottom">
            <span>Sunlight in</span>
            <span class="energy-arrow" aria-hidden="true">↗</span>
            <span>Power on</span>
          </div>
        </div>
        <span class="art-caption caption-top">CLEAN ENERGY <b>01</b></span>
        <span class="art-caption caption-bottom">BUILT AROUND PEOPLE</span>
      </div>
    </section>

    <section class="intro-strip" id="for-communities">
      <p class="strip-label">POWER THAT MEETS YOU WHERE YOU ARE</p>
      <p class="strip-copy">From a family home to a village water pump, reliable energy can open up more of everyday life.</p>
      <span class="strip-spark" aria-hidden="true">✳</span>
    </section>

    <section class="steps-section" id="how-it-works" aria-labelledby="steps-title">
      <div class="section-heading">
        <p class="eyebrow">A SIMPLE IDEA</p>
        <h2 id="steps-title">Energy, in a few clear steps.</h2>
      </div>
      <div class="steps-grid">
        <article class="step-card">
          <span class="step-number">01</span>
          <h3>Choose what needs power</h3>
          <p>A home system, a water pump, or another essential community service.</p>
        </article>
        <article class="step-card">
          <span class="step-number">02</span>
          <h3>Pay one period at a time</h3>
          <p>Support a plan in manageable periods, instead of paying for everything up front.</p>
        </article>
        <article class="step-card">
          <span class="step-number">03</span>
          <h3>Keep essential energy flowing</h3>
          <p>Connected equipment can receive its power status, even in places with limited connectivity.</p>
        </article>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <a class="brand footer-brand" href="#" aria-label="PowerPulse home">
      <span class="brand-mark" aria-hidden="true">P</span>
      <span>PowerPulse</span>
    </a>
    <p>Clean power, on your terms.</p>
    <span class="footer-note">Early product concept</span>
  </footer>
`;
