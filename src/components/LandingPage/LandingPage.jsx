import "./LandingPage.css";
import Header from "../Header/Header";
import Footer from "../Footer/Footer";
import { Link } from "react-router-dom";

// local assets already in your repo
import itemsIcon from "../../assets/icons/items.svg";
import checkIcon from "../../assets/icons/check.svg";
import heroGraphic from "../../assets/estimate-nobackground-blue.png";

export default function LandingPage() {
  return (
    <>
      <Header />

      {/* HERO */}
      <section className="hero">
        <div className="hero__copy">
          <h1 className="hero__title">
            <span className="accent">Simplify</span> Your Quote Process
          </h1>
          <p className="hero__description">
            Draw roof lines, drop downspouts, and automatically calculate
            footage, end caps, miters, elbows, and offsets—all in one place.
          </p>
          <div className="hero__cta-row">
            <Link to="/signup">
              <button className="hero__button">Subscribe Now</button>
            </Link>
            <Link to="/diagram" className="hero__secondary">
              Try the Diagram &rarr;
            </Link>
          </div>
        </div>

        <div className="hero__visual">
          {/* Prefer your PNG if it loads; otherwise fall back to a small inline diagram */}
          <img
            src={heroGraphic}
            alt="Estimate preview"
            className="hero__image"
          />
          <svg
            className="hero__svg-fallback"
            viewBox="0 0 420 250"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="grid10"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="#e6e6e6"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid10)" />
            {/* sample gutters */}
            <line
              x1="40"
              y1="60"
              x2="380"
              y2="60"
              stroke="#0062ff"
              strokeWidth="3"
            />
            <line
              x1="40"
              y1="180"
              x2="380"
              y2="180"
              stroke="#0062ff"
              strokeWidth="3"
            />
            {/* downspouts */}
            <g stroke="#333" strokeWidth="2">
              <line x1="380" y1="60" x2="380" y2="100" />
              <line x1="380" y1="180" x2="380" y2="140" />
            </g>
            {/* annotations */}
            <text x="210" y="50" textAnchor="middle" fontSize="12" fill="#222">
              28'
            </text>
            <text x="210" y="200" textAnchor="middle" fontSize="12" fill="#222">
              28'
            </text>
          </svg>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="steps">
        <h2>How it works</h2>
        <div className="steps__grid">
          <div className="steps__card">
            <div className="steps__num">1</div>
            <h3>Draw</h3>
            <p>Snap-to-grid gutters with automatic measurements.</p>
          </div>
          <div className="steps__card">
            <div className="steps__num">2</div>
            <h3>Annotate</h3>
            <p>Add downspouts, notes, splash guards, and free-line markup.</p>
          </div>
          <div className="steps__card">
            <div className="steps__num">3</div>
            <h3>Price</h3>
            <p>
              Live pricing from your catalog, including end caps, miters,
              elbows, and offsets.
            </p>
          </div>
          <div className="steps__card">
            <div className="steps__num">4</div>
            <h3>Export</h3>
            <p>Generate a branded PDF with totals and a diagram snapshot.</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <h2>Why contractors use this</h2>
        <div className="features__grid">
          <div className="features__item">
            <img src={itemsIcon} alt="" />
            <div>
              <h3>Catalog-driven</h3>
              <p>
                Update product <b>price/color</b> once—changes propagate
                instantly to estimates and diagrams.
              </p>
            </div>
          </div>

          <div className="features__item">
            <img src={checkIcon} alt="" />
            <div>
              <h3>Accurate accessories</h3>
              <p>
                End caps, miters (inside/outside/bay), elbows (A/B/C), and
                offsets are auto-counted and priced.
              </p>
            </div>
          </div>

          <div className="features__item">
            <img src={checkIcon} alt="" />
            <div>
              <h3>Fast edits</h3>
              <p>
                Move lines, change products, or switch colors without breaking
                totals or the PDF.
              </p>
            </div>
          </div>

          <div className="features__item">
            <img src={checkIcon} alt="" />
            <div>
              <h3>Clean exports</h3>
              <p>
                Two-page PDF: items + totals on page one, big diagram + notes on
                page two.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <h2>Ready to speed up your quoting?</h2>
        <p>Start your first project in minutes.</p>
        <div className="cta__row">
          <Link to="/signup">
            <button className="hero__button">Create an Account</button>
          </Link>
          <Link to="/diagram" className="hero__secondary">
            Open the Diagram &rarr;
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
