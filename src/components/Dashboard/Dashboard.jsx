import "./Dashboard.css";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import { useContext, useEffect, useState } from "react";
import logo from "../../assets/estimate-nobackground-blue.png";
import { Link, Outlet } from "react-router-dom";
import dropdown from "../../assets/icons/drop-down.svg";
import { useNavigate } from "react-router-dom";
import hamburgerIcon from "../../assets/icons/hamburgermenu.svg";

export default function Dashboard({ handleLogOut }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 650) {
      setIsMobile(true);
    }
  }, []);

  const currentUser = useContext(CurrentUserContext);

  const navigator = useNavigate();

  function navigateToLandingPage() {
    navigator("/");
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__links">
          <Link to="projects">
            <img src={logo} alt="estimate logo" className="dashboard__logo" />
          </Link>
          <Link to="projects" className="dashboard__link">
            Projects
          </Link>
          <Link to="products" className="dashboard__link">
            Products
          </Link>
          <Link to="estimates" className="dashboard__link">
           Estimates
          </Link>
          <Link to="settings" className="dashboard__link">
            Settings
          </Link>
        </div>
        <div
          className="dashboard__account-link"
          onClick={() => {
            handleLogOut();
            navigateToLandingPage();
          }}
        >
          <p className="dashboard__account-email">{currentUser?.email}</p>
          <img
            src={dropdown}
            alt="drop-down"
            className="dashboard__drop-down-icon"
          />
        </div>
        {isMobile && (
          <div className="dashboard__hamburger-menu-icon-container">
            <img
              src={hamburgerIcon}
              alt="mobile menu"
              className="dashboard__hadmburger-menu-icon"
            />
          </div>
        )}
      </header>
      <Outlet />
    </div>
  );
}
