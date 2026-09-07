import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useState, useEffect } from 'react'
import './Navbar.css'
import logo from '../assets/logo.png'

function ThemeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  return (
    <label className="switch" aria-label="Toggle Theme">
      <input
        type="checkbox"
        checked={isDarkMode}
        onChange={(e) => setIsDarkMode(e.target.checked)}
      />
      <span className="slider" />
    </label>
  );
}

export default function Navbar() {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0()

  // State to track if navbar is visible
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false); 
      } else {
        setIsVisible(true);  
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <nav className={`navbar ${isVisible ? "" : "navbar-hidden"}`}>
      <div className="navbar-left">
        <Link to="/">
          <img src={logo} alt="Campus Marketplace Logo" className="navbar-logo" />
        </Link>
        <Link to="/" className="navbar-brand">
          Campus Marketplace
        </Link>
      </div>
      <div className="navbar-links">
        <ThemeToggle />
        <Link to="/">Home</Link>
        {isAuthenticated ? (
          <>
            <Link to="/profile">Profile</Link>
            <button
              className="navbar-logout"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <button className="navbar-link-btn" onClick={() => loginWithRedirect()}>
              Log in
            </button>
            <button
              className="button"
              onClick={() =>
                loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } })
              }
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
