import { NavLink, Outlet } from "react-router";
import { Icon } from "../components/Icon";
import { SyncBadge } from "../components/SyncBadge";

function toggleTheme() {
  const root = document.documentElement;
  const light = root.dataset.theme
    ? root.dataset.theme === "light"
    : window.matchMedia("(prefers-color-scheme: light)").matches;
  const next = light ? "dark" : "light";
  root.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    // this visit only
  }
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header__bar">
          <NavLink className="brand" to="/" aria-label="English, home">
            <img src="/img/emblem-96.webp" width="32" height="32" alt="" />
            <span className="brand__name">English</span>
          </NavLink>
          <nav className="nav" aria-label="Sections">
            <NavLink to="/" end>
              Review
            </NavLink>
            <NavLink to="/cards">Cards</NavLink>
            <NavLink to="/lessons">Lessons</NavLink>
            <span className="nav__sync">
              <SyncBadge />
            </span>
            <button
              className="icon-btn theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light and dark theme"
            >
              <span className="theme-toggle__sun">
                <Icon name="sun" size={20} />
              </span>
              <span className="theme-toggle__moon">
                <Icon name="moon" size={20} />
              </span>
            </button>
          </nav>
        </div>
        <div className="brand-line" />
      </header>
      <main id="content" className="container main">
        <Outlet />
      </main>
    </>
  );
}
