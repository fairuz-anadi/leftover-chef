import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../assets/logo.png";

export default function TopNav({ user, onOpenAuth, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand-mark" onClick={closeMenu}>
          <img src={logo} alt="Leftover Chef" className="brand-mark__logo" />
          <strong>Leftover Chef</strong>
        </Link>

        <button
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="nav-toggle"
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`site-menu ${menuOpen ? "site-menu--open" : ""}`}>
          <nav aria-label="Primary navigation" className="site-nav" id="primary-navigation">
            <NavLink end onClick={closeMenu} to="/">Home</NavLink>
            <NavLink onClick={closeMenu} to="/fridge">My Fridge</NavLink>
            <NavLink onClick={closeMenu} to="/recipes">Recipes</NavLink>
            <NavLink onClick={closeMenu} to="/cuisines">Cuisine Map</NavLink>
            {user && <NavLink onClick={closeMenu} to="/meal-plan">Meal Plan</NavLink>}
            {user && <NavLink onClick={closeMenu} to="/shopping-list">Shopping</NavLink>}
            <NavLink onClick={closeMenu} to="/about">About</NavLink>
            <NavLink onClick={closeMenu} to="/contact">Contact</NavLink>
            {user && <NavLink onClick={closeMenu} to="/profile">Dashboard</NavLink>}
            {user?.is_admin && <NavLink onClick={closeMenu} to="/admin">Admin</NavLink>}
          </nav>

          <div className="site-actions">
          {user ? (
            <>
              <Link className="user-pill" onClick={closeMenu} to="/preferences" title="Cooking preferences">
                <span>{user.name}</span>
                <small>{user.points} pts</small>
              </Link>
              <Link className="button button--secondary" onClick={closeMenu} to="/recipes/new">
                Share Recipe
              </Link>
              <button className="button button--ghost" onClick={() => { closeMenu(); onLogout(); }} type="button">
                Log Out
              </button>
            </>
          ) : (
            <>
              <button className="button button--ghost" onClick={() => { closeMenu(); onOpenAuth("login"); }} type="button">
                Log In
              </button>
              <button className="button" onClick={() => { closeMenu(); onOpenAuth("signup"); }} type="button">
                Sign Up
              </button>
            </>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
