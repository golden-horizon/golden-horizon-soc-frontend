import { Link, useNavigate, useLocation } from "react-router-dom";
import socket from "../pages/socket";


export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");

    // Disconnect realtime socket
    socket.disconnect();

    navigate("/login", { replace: true });
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
  <nav style={styles.nav}>
    <h3 style={styles.logo}>SOC Platform</h3>

    <div style={styles.links}>
      <Link
        to="/dashboard"
        style={{
          ...styles.link,
          color: isActive("/dashboard") ? "#60a5fa" : "#fff",
        }}
      >
        Dashboard
      </Link>

      <Link
        to="/create-incident"
        style={{
          ...styles.link,
          color: isActive("/create-incident") ? "#60a5fa" : "#fff",
        }}
      >
        Create Incident
      </Link>

      <Link
        to="/investigation"
        style={{
          ...styles.link,
          color: isActive("/investigation") ? "#60a5fa" : "#fff",
        }}
      >
        Investigation
      </Link>

      <Link
        to="/security-events"
        style={{
          ...styles.link,
          color: isActive("/security-events") ? "#60a5fa" : "#fff",
        }}
      >
        Security Events
      </Link>

      <Link
        to="/world-map"
        style={{
          ...styles.link,
          color: isActive("/world-map") ? "#60a5fa" : "#fff",
        }}
      >
        World Map
      </Link>

      <Link
        to="/threat-hunting"
        style={{
          ...styles.link,
          color: isActive("/threat-hunting") ? "#60a5fa" : "#fff",
        }}
      >
        Threat Hunting
      </Link>

      <button onClick={handleLogout} style={styles.logout}>
        Logout
      </button>
    </div>
  </nav>
);

/* ================= STYLES ================= */

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    background: "#111827",
    color: "#fff",
    borderBottom: "1px solid #1f2937",
  },

  logo: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "bold",
    color: "#f9fafb",
  },

  links: {
    display: "flex",
    gap: "18px",
    alignItems: "center",
  },

  link: {
    color: "#fff",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: "500",
    transition: "0.2s",
  },

  logout: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
};