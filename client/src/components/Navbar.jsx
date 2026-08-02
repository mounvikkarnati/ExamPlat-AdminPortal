import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import logo from "../assets/logo.png";

const icons = {
  grid: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  exam: <path d="M5 4h14v16H5V4Zm3 4h8M8 12h8M8 16h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  people: <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-1a2.5 2.5 0 1 0 0-5M21 20v-1.5a4 4 0 0 0-2.5-3.7" />,
  lock: <path d="M6 10h12v10H6V10Zm3-1V7a3 3 0 0 1 6 0v2M12 14v2" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  logout: <path d="M10 17l5-5-5-5M15 12H3M13 4h5v16h-5" />,
};

export function Icon({ name, className = "" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
}

export default function Navbar() {
  const { admin, isSuperAdmin, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = [
    ["/", "Overview", "grid"],
    ["/tests", "Examinations", "exam"],
    ["/tests/new", "Create exam", "plus"],
    ["/mock-tests", "Mock tests", "exam"],
    ...(isAdmin ? [["/mock-tests/new", "Create mock test", "plus"]] : []),
    ["/students", "Students", "people"],
    ...(isSuperAdmin ? [["/admins", "Team access", "people"]] : []),
  ];
  const linkClass = ({ isActive }) => `side-link ${isActive ? "side-link-active" : ""}`;
  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <>
      <header className="mobile-header">
        <button className="icon-button" aria-label="Open navigation" onClick={() => setOpen(true)}><Icon name="menu" className="h-5 w-5" /></button>
        <span className="font-semibold text-slate-900">ExamPlat</span>
        <span className="w-9" />
      </header>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <aside className={`app-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <img src={logo} alt="ExamPlat logo" className="h-9 w-9 rounded-lg object-contain" />
          <div><p>ExamPlat</p><span>CONTROL CENTER</span></div>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setOpen(false)}><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === "/"} className={linkClass} onClick={() => setOpen(false)}>
              <Icon name={icon} className="h-[18px] w-[18px]" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/change-password" className={linkClass} onClick={() => setOpen(false)}><Icon name="lock" className="h-[18px] w-[18px]" />Security</NavLink>
          <div className="account-card">
            <div className="avatar">{admin?.name?.[0] || admin?.email?.[0] || "A"}</div>
            <div className="min-w-0"><p>{admin?.name || "Administrator"}</p><span>{admin?.role === "superadmin" ? "Super administrator" : "Administrator"}</span></div>
            <button onClick={handleLogout} className="icon-button text-slate-400 hover:text-rose-600" title="Log out"><Icon name="logout" className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
