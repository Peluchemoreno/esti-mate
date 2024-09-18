import "./LandingPage.css";
import Header from "../Header/Header";
import Footer from "../Footer/Footer";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <>
      <Header />
      <section className="hero">
        <h1 className="hero__title">
          <span className="accent">Simplify</span> Your Quote Process
        </h1>
        <p className="hero__description">
          Seamlessly transform drawings into accurate gutter estimates,
          improving estimate creation speed and transforming your quote process.
        </p>
        <Link to="/signup">
          <button className="hero__button">Subscribe Now</button>
        </Link>
        <img src="" alt="" className="hero__image" />
      </section>
      {/* <Footer /> */}
    </>
  );
}
