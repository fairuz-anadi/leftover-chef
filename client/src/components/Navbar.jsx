import logo from "../assets/logo.png";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Login from "./Login";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Recipes", href: "/recipes" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar({
  isLoggedIn,
  onLoginSuccess,
  onLogout,
  showLogin,
  setShowLogin,
  onSwitchToSignup,
  onSwitchToForgot,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    onLogout();
    setMenuOpen(false);
  };

  const handleMenuLinkClick = () => {
    setMenuOpen(false);
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? "scrolled" : "top"}`}>
        <div className="nav-inner">

          {/* Logo */}
          <Link to="/" className="logo">
            <img
              src={logo}
              alt="Leftover Chef Logo"
              style={{ height: "102px", width: "auto" }}
            />
            <div className="logo-text">
              <span className="logo-title">Leftover Chef</span>
              <span className="logo-sub">World Kitchen</span>
            </div>
          </Link>

          {/* Nav Links */}
          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className={`nav-link ${
                    location.pathname === link.href ? "active" : ""
                  }`}
                  onClick={handleMenuLinkClick}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Search */}
          <div className="nav-search">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8a7060"
              strokeWidth="2.5"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search recipes, cuisines…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Right Side */}
          <div className="nav-right">
            <div className="nav-divider" />

            {isLoggedIn ? (
              <>
                <Link to="/profile" className="profile-btn">
                  <div className="profile-avatar">A</div>
                  <span className="profile-label">User Profile</span>
                </Link>

                <Link to="/recipes/new" className="cta-btn">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Share Recipe
                </Link>

                <button className="logout-btn" onClick={handleLogout}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
                </button>
              </>
            ) : (
              <button
                className="login-btn"
                onClick={() => setShowLogin(true)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Login
              </button>
            )}

            {/* Hamburger */}
            <button
              className={`hamburger ${menuOpen ? "open" : ""}`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        <div className="mobile-search">
          <input placeholder="Search recipes..." />
        </div>

        <ul className="mobile-nav-links">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className={`mobile-nav-link ${
                  location.pathname === link.href ? "active" : ""
                }`}
                onClick={handleMenuLinkClick}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mobile-footer">
          {isLoggedIn ? (
            <button className="mobile-logout" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button
              className="mobile-cta"
              onClick={() => {
                setMenuOpen(false);
                setShowLogin(true);
              }}
            >
              Login
            </button>
          )}
        </div>
      </div>

      {/* Login Modal */}
      {showLogin && (
        <Login
          onClose={() => setShowLogin(false)}
          onLoginSuccess={() => {
            onLoginSuccess();
            setShowLogin(false);
          }}
          onSwitchToSignup={() => {
            setShowLogin(false);
            onSwitchToSignup();
          }}
          onSwitchToForgot={() => {
            setShowLogin(false);
            onSwitchToForgot();
          }}
        />
      )}
    </>
  );
}
