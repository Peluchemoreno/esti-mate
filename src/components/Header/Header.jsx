import "./Header.css";
import logo from "../../assets/estimate-transparent-blue.png";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="header">
      <img className="header__logo" src={logo} alt="esti-mate logo" />

      <div>
        <Link to="/signup">
          <button className="header__button">Subscribe Now</button>
        </Link>
        <Link to="/signin">
          <button className="header__button header__button_signin">
            Sign in
          </button>
        </Link>
      </div>
    </header>
  );
}
