const footerStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400&display=swap');

  .chef-footer {
    --cream: #fbfbfa;
    --warm-brown: #3b2a1a;
    --amber: #c8883a;
    --muted: #9a8472;
    --smoke: #f0e8dc;

    background-color: var(--warm-brown);
    color: var(--cream);
    padding: 60px 40px 32px;
    font-family: 'Lato', sans-serif;
    font-weight: 300;
    position: relative;
    overflow: hidden;
  }

  .chef-footer::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--amber), transparent);
  }

  .chef-footer__bg-text {
    position: absolute;
    bottom: -10px;
    right: -10px;
    font-family: 'Playfair Display', serif;
    font-size: 160px;
    font-style: italic;
    color: rgba(200, 136, 58, 0.07);
    line-height: 1;
    user-select: none;
    pointer-events: none;
    letter-spacing: -4px;
  }

  .chef-footer__inner {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 36px;
    position: relative;
    z-index: 1;
  }

  .chef-footer__logo {
    text-align: center;
  }

  .chef-footer__logo-name {
    font-family: 'Playfair Display', serif;
    font-size: 2.4rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--cream);
    margin: 0 0 6px;
    line-height: 1;
  }

  .chef-footer__logo-name span {
    color: var(--amber);
    font-style: italic;
  }

  .chef-footer__tagline {
    font-size: 0.82rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0;
  }

  .chef-footer__divider {
    width: 48px;
    height: 1px;
    background: var(--amber);
    opacity: 0.6;
  }

  .chef-footer__quote {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: 1.05rem;
    color: var(--smoke);
    text-align: center;
    max-width: 420px;
    line-height: 1.7;
    opacity: 0.85;
    margin: 0;
  }


  .chef-footer__bottom {
    width: 100%;
    border-top: 1px solid rgba(154, 132, 114, 0.2);
    padding-top: 20px;
    text-align: center;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    color: var(--muted);
    text-transform: uppercase;
  }
`;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <>
      <style>{footerStyles}</style>
      <footer className="chef-footer">
        <div className="chef-footer__bg-text">Fork</div>

        <div className="chef-footer__inner">
          {/* Logo */}
          <div className="chef-footer__logo">
            <h2 className="chef-footer__logo-name">
              Fridge<span>ToFork</span>
            </h2>
            <p className="chef-footer__tagline">From your fridge to your fork</p>
          </div>

          <div className="chef-footer__divider" />

          {/* Quote */}
          <p className="chef-footer__quote">
            "Cooking is one of the strongest ceremonies for life."
          </p>

          {/* Bottom */}
          <div className="chef-footer__bottom">
            © {year} Leftover Chef — All rights reserved
          </div>
        </div>
      </footer>
    </>
  );
}
