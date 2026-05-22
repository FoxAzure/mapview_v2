// ================================= DOCUMENTATION ------------------------------------------
// Script: Sidebar.jsx
// Purpose: Renders the inner content of the navigation menu.
// ================================= EXECUTOR -----------------------------------------------
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  return (
    <>
      <div className="sidebar-header">
        <h2>AgroMap GPS</h2>
      </div>
      <nav className="sidebar-nav">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          📍 MapView
        </Link>
        <Link to="/campos" className={location.pathname === '/campos' ? 'active' : ''}>
          📋 Lista Campos
        </Link>
      </nav>
    </>
  );
}