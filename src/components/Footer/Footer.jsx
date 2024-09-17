import "./Footer.css";
import logo from "../../assets/estimate-transparent-blue.png";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__header">
        <img className="footer__logo" src={logo} alt="footer logo" />
        <p className="footer__logo-text">Esti-Mate</p>
      </div>
    </footer>
  );
}
