import { Outlet, useNavigate, useLocation } from "react-router-dom";
import socket from "../pages/socket";
import cveLogo from "../assets/cve.png";
import mitreLogo from "../assets/mitre.png";
import cisaLogo from "../assets/cisa.png";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    socket.disconnect();
    navigate("/login", { replace: true });
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const getTitle = () => {
  if (location.pathname.includes("create-incident")) return "Create Incident";
  if (location.pathname.includes("investigation")) return "Investigation";
  if (location.pathname.includes("security-events")) return "Security Events";
  if (location.pathname.includes("world-map")) return "World Map";
  if (location.pathname.includes("executive-dashboard")) return "Executive Dashboard";
  if (location.pathname.includes("dashboard")) return "Dashboard";
  if (location.pathname.includes("threat-hunting")) return "Threat Hunting";
  if (location.pathname.includes("threat-intelligence")) return "Threat Intelligence";
  if (location.pathname.includes("reports")) return "Reports";
  
  return "SOC Platform";
};

  return (
    <div style={styles.shell}>
      <div style={styles.sidebar}>
        <h2 style={styles.logo}>SOC Platform</h2>
       <div style={styles.userPanel}>
  <div style={styles.userRole}>SOC Analyst</div>

  <div style={styles.userEmail}>
    admin@test.com
  </div>

  <div style={styles.userStatus}>
    ● Online
  </div>
  <div style={styles.userStats}>
    <span>Incidents: 6</span>
    <span>Critical: 3</span>
  </div>
</div>

      <button
  onClick={() => navigate("/dashboard")}
  style={navStyle(isActive("/dashboard"))}
>
  Dashboard
</button>

<button
  onClick={() => navigate("/create-incident")}
  style={navStyle(isActive("/create-incident"))}
>
  Create Incident
</button>

<button
  onClick={() => navigate("/investigation")}
  style={navStyle(isActive("/investigation"))}
>
  Investigation
</button>

<button
  onClick={() => navigate("/security-events")}
  style={navStyle(isActive("/security-events"))}
>
  Security Events
</button>

<button
  onClick={() => navigate("/world-map")}
  style={navStyle(isActive("/world-map"))}
>
  World Map
</button>

<button
  onClick={() => navigate("/threat-hunting")}
  style={navStyle(isActive("/threat-hunting"))}
>
  Threat Hunting
</button>

<button
  onClick={() => navigate("/threat-intelligence")}
  style={navStyle(isActive("/threat-intelligence"))}
>
  Threat Intelligence
</button>

<button
  onClick={() => navigate("/executive-dashboard")}
  style={navStyle(isActive("/executive-dashboard"))}
>
  Executive Dashboard
</button>

<button
  onClick={() => navigate("/reports")}
  style={navStyle(isActive("/reports"))}
>
  Reports
</button>

<div style={styles.resources}>
  <div style={styles.resourceTitle}>
  THREAT INTEL
</div>

<div style={styles.resourceSubtitle}>
  Live Sources
</div>

<a
  href="https://www.cve.org"
  target="_blank"
  rel="noreferrer"
  title="Open CVE Database"
  style={styles.resourceLink}
>
    <img src={cveLogo} alt="CVE" style={styles.resourceLogo} />
  </a>

  <a
    href="https://attack.mitre.org"
    target="_blank"
    rel="noreferrer"
      title=" Open ATT&CK Framework"
    style={styles.resourceLink}
  >
    <img src={mitreLogo} alt="MITRE" style={styles.resourceLogo} />
  </a>

  <a
    href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
    target="_blank"
    rel="noreferrer"
    title="Open CISA KEV Catalog"
    style={styles.resourceLink}
  >
    <img src={cisaLogo} alt="CISA" style={styles.resourceLogo} />
  </a>
</div>

<button onClick={handleLogout} style={styles.logout}>
  Logout
</button>

      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
       <h2
  style={{
    margin: 0,
    fontSize: "36px",
    fontWeight: "700",
    color: "#f8fafc",
  }}
>
  {getTitle()}
</h2>
        </div>

        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const navStyle = (active) => ({
  ...styles.link,
  background: active ? "#4f46e5" : "transparent",
  color: active ? "#fff" : "#cbd5e1",
});

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#0f172a",
    width: "100%",
  },

 sidebar: {
  width: "260px",
  background: "#0b1220",
  color: "#fff",
  padding: "16px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  borderRight: "1px solid #1e293b",
},

  logo: {
    marginBottom: "18px",
    fontSize: "18px",
    fontWeight: "bold",
    textAlign: "center",
  },

 link: {
  padding: "8px 10px",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  textAlign: "left",
  fontWeight: "500",
  fontSize: "14px",
},
  logout: {
    marginTop: "auto",
    padding: "10px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

 topbar: {
  padding: "15px 20px",
  borderBottom: "1px solid #1e293b",
  background: "#0b1220",
},
  content: {
    padding: "12px",
    width: "100%",
    boxSizing: "border-box",
  },
resources: {
  marginTop: "18px",
  paddingTop: "14px",
  borderTop: "1px solid #1e293b",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
},

resourceTitle: {
  color: "#64748b",
  fontSize: "11px",
  letterSpacing: "2px",
},

resourceLink: {
  width: "120px",
  height: "44px",
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "0.2s",
},

resourceLogo: {
  maxWidth: "85px",
  maxHeight: "30px",
  objectFit: "contain",
},
resourceUpdate: {
  color: "#94a3b8",
  fontSize: "11px",
  textAlign: "center",
  marginBottom: "8px",
},
resourceSubtitle: {
  color: "#94a3b8",
  fontSize: "12px",
  textAlign: "center",
  marginBottom: "10px",
},
userPanel: {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "10px",
  padding: "10px",
  marginBottom: "14px",
},

userRole: {
  color: "#38bdf8",
  fontSize: "15px",
  fontWeight: "700",
  marginBottom: "6px",
},

userEmail: {
  color: "#cbd5e1",
  fontSize: "12px",
},
userStatus: {
  marginTop: "8px",
  color: "#16a34a",
  fontSize: "11px",
  fontWeight: "500",
  textAlign: "center",
},
userStats: {
  marginTop: "10px",
  paddingTop: "8px",
  borderTop: "1px solid #1e293b",
  display: "flex",
  justifyContent: "space-between",
  color: "#94a3b8",
  fontSize: "11px",
},
};
