// src/components/Footer/Footer.jsx
import "./Footer.css";
import CompanyLogo from "../CompanyLogo/CompanyLogo";
import logo from "../../assets/estimate-transparent-blue.png";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer__inner">
        <img src={logo} alt="Esti-Mate logo" className="footer__logo" />
        <span>© {year}</span>
      </div>
    </footer>
  );
}
