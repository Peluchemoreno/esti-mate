import "./Dashboard.css";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import { useContext, useEffect, useRef, useState } from "react";
import logo from "../../assets/estimate-nobackground-blue.png";
import { Link, Outlet, useNavigate } from "react-router-dom";
import dropdown from "../../assets/icons/drop-down.svg";
import hamburgerIcon from "../../assets/icons/hamburgermenu.svg";

export default function Dashboard({ handleLogOut }) {
  const currentUser = useContext(CurrentUserContext);
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 650px)").matches
      : false
  );
  const [isOpen, setIsOpen] = useState(false);
  const firstLinkRef = useRef(null);

  // keep isMobile in sync as the window resizes
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 650px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // close the menu when jumping back to desktop
  useEffect(() => {
    if (!isMobile) setIsOpen(false);
  }, [isMobile]);

  // a11y + body scroll lock
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (isOpen && firstLinkRef.current) firstLinkRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const onLogout = () => {
    handleLogOut?.();
    navigate("/");
  };

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__links">
          <Link to="projects" className="dashboard__brand">
            <img src={logo} alt="Esti-Mate" className="dashboard__logo" />
          </Link>

          {/* desktop links */}
          <Link to="projects" className="dashboard__link">
            Projects
          </Link>
          <Link to="products" className="dashboard__link">
            Products
          </Link>
          <Link to="settings" className="dashboard__link">
            Settings
          </Link>
        </div>

        {/* desktop account */}
        <div className="dashboard__account-link" onClick={onLogout}>
          <p className="dashboard__account-email">{currentUser?.email}</p>
          <img
            src={dropdown}
            alt="drop-down"
            className="dashboard__drop-down-icon"
          />
        </div>

        {/* mobile hamburger */}
        {isMobile && (
          <button
            className="dashboard__hamburger-btn"
            aria-label="Toggle navigation"
            aria-controls="dashboard-mobile-nav"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
          >
            <img
              src={hamburgerIcon}
              alt=""
              className="dashboard__hamburger-icon"
            />
          </button>
        )}
      </header>

      {/* mobile overlay + sheet */}
      {isMobile && isOpen && (
        <div className="dashboard__overlay" onClick={() => setIsOpen(false)} />
      )}

      {isMobile && (
        <nav
          id="dashboard-mobile-nav"
          className={`dashboard__mobile ${isOpen ? "is-open" : ""}`}
          aria-hidden={!isOpen}
        >
          <ul className="dashboard__navlist">
            <li>
              <Link
                ref={firstLinkRef}
                to="projects"
                className="dashboard__navlink"
                onClick={() => setIsOpen(false)}
              >
                Projects
              </Link>
            </li>
            <li>
              <Link
                to="products"
                className="dashboard__navlink"
                onClick={() => setIsOpen(false)}
              >
                Products
              </Link>
            </li>
            <li>
              <Link
                to="settings"
                className="dashboard__navlink"
                onClick={() => setIsOpen(false)}
              >
                Settings
              </Link>
            </li>
          </ul>

          <button
            className="dashboard__logout"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            Log out ({currentUser?.email})
          </button>
        </nav>
      )}

      <Outlet />
    </div>
  );
}
