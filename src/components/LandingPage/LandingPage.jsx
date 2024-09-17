import "./LandingPage.css";
import Header from "../Header/Header";
import Footer from "../Footer/Footer";

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
        <button className="hero__button">Subscribe Now</button>
        <img src="" alt="" className="hero__image" />
      </section>
      <Footer />
    </>
  );
}
