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
    <div className="landing">
      <Header />

      {/* HERO */}
      <section className="hero container">
        <div className="hero__copy">
          <h1 className="hero__title">
            <span className="accent">Simplify</span> Your Quote Process
          </h1>
          <p className="hero__description">
            Draw roof lines, drop downspouts, and automatically calculate
            footage and accessories—all in one place.
          </p>
          <div className="hero__cta-row">
            <Link to="/signup">
              <button className="button button--primary centered">
                Create an Account
              </button>
            </Link>
            <Link to="/signup" className="button button--ghost">
              Subscribe Now
            </Link>
          </div>
        </div>

        <div className="hero__visual">
          <img
            src={heroGraphic}
            alt="Estimate preview"
            className="hero__image"
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="steps container">
        <h2 className="section__title">How it works</h2>
        <div className="grid grid--4">
          <div className="card">
            <div className="card__num">1</div>
            <h3>Draw</h3>
            <p>Snap-to-grid gutters with automatic measurements.</p>
          </div>
          <div className="card">
            <div className="card__num">2</div>
            <h3>Annotate</h3>
            <p>Add downspouts, notes, splash guards, and free-line markup.</p>
          </div>
          <div className="card">
            <div className="card__num">3</div>
            <h3>Price</h3>
            <p>Live pricing from your catalog, including all accessories.</p>
          </div>
          <div className="card">
            <div className="card__num">4</div>
            <h3>Export</h3>
            <p>Generate a branded PDF with totals and a diagram snapshot.</p>
          </div>
        </div>
      </section>

      {/* FEATURES (kept minimal) */}
      <section className="features container">
        <h2 className="section__title">Why contractors use this</h2>
        <div className="grid grid--3">
          <div className="feature">
            <img src={itemsIcon} alt="" />
            <div>
              <h3>Catalog-driven</h3>
              <p>Update price/color once—changes propagate instantly.</p>
            </div>
          </div>

          <div className="feature">
            <img src={checkIcon} alt="" />
            <div>
              <h3>Accurate accessories</h3>
              <p>End caps, miters, elbows, and offsets auto-counted.</p>
            </div>
          </div>

          <div className="feature">
            <img src={checkIcon} alt="" />
            <div>
              <h3>Fast edits</h3>
              <p>Move lines or swap products without breaking totals.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta container">
        <h2 className="section__title">Ready to speed up your quoting?</h2>
        <p>Start your first project in minutes.</p>
        <div className="hero__cta-row">
          <Link to="/signup">
            <button className="button button--primary">Get Started</button>
          </Link>
        </div>
      </section>

      {/* Minimal footer (logo/name + ©) */}
      <Footer />
    </div>
  );
}
