import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import socket from "../pages/socket";
import cveLogo from "../assets/cve.png";
import mitreLogo from "../assets/mitre.png";
import cisaLogo from "../assets/cisa.png";
import goldenHorizonIcon from "../assets/golden-horizon-icon.png";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarStats, setSidebarStats] = useState({
    incidents: 0,
    critical: 0,
  });
  const [latestCve, setLatestCve] = useState(null);
  const [latestCveStatus, setLatestCveStatus] = useState("Loading latest CVE...");

  const loadSidebarStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) return;

      const res = await axios.get("https://golden-horizon-soc-backend.onrender.com/incidents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const incidents = Array.isArray(res.data) ? res.data : [];

      setSidebarStats({
        incidents: incidents.length,
        critical: incidents.filter((incident) => incident.severity === "critical")
          .length,
      });
    } catch (err) {
      console.error("Failed to load sidebar stats:", err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSidebarStats();

    socket.on("incident-created", loadSidebarStats);
    socket.on("incident-updated", loadSidebarStats);
    socket.on("incident-deleted", loadSidebarStats);

    return () => {
      socket.off("incident-created", loadSidebarStats);
      socket.off("incident-updated", loadSidebarStats);
      socket.off("incident-deleted", loadSidebarStats);
    };
  }, [loadSidebarStats]);

  useEffect(() => {
    const loadLatestCriticalCve = async () => {
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 7);

        const params = new URLSearchParams({
          cvssV3Severity: "CRITICAL",
          pubStartDate: start.toISOString(),
          pubEndDate: now.toISOString(),
          resultsPerPage: "20",
        });

        const res = await axios.get(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?${params.toString()}`
        );

        const vulnerabilities = Array.isArray(res.data?.vulnerabilities)
          ? res.data.vulnerabilities
          : [];

        if (vulnerabilities.length === 0) {
          setLatestCveStatus("No recent Critical CVEs");
          return;
        }

        const latest = [...vulnerabilities].sort(
          (a, b) => new Date(b.cve.published) - new Date(a.cve.published)
        )[0].cve;

        const cvssMetric =
          latest.metrics?.cvssMetricV31?.[0] || latest.metrics?.cvssMetricV30?.[0];

        setLatestCve({
          id: latest.id,
          score: cvssMetric?.cvssData?.baseScore || "N/A",
          published: latest.published,
        });
        setLatestCveStatus("Live from NVD");
      } catch (err) {
        console.error("Failed to load latest NVD CVE:", err);
        setLatestCveStatus("NVD unavailable");
      }
    };

    loadLatestCriticalCve();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    socket.disconnect();
    navigate("/login", { replace: true });
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const getTitle = () => {
    if (location.pathname === "/dashboard") return null;
    if (location.pathname.includes("create-incident")) return "Create Incident";
    if (location.pathname.includes("investigation")) return "Investigation";
    if (location.pathname.includes("security-events")) return "Security Events";
    if (location.pathname.includes("world-map")) return "World Map";
    if (location.pathname.includes("executive-dashboard")) return "Executive Dashboard";
    if (location.pathname.includes("incidents/")) return "Incident Response";
    if (location.pathname.includes("threat-hunting")) return "Threat Hunting";
    if (location.pathname.includes("threat-intelligence")) return "Threat Intelligence";
    if (location.pathname.includes("reports")) return "Reports";

    return "SOC Platform";
  };

  const pageTitle = getTitle();

  const formatCvePublished = (published) => {
    if (!published) return "Published date unavailable";

    const date = new Date(published);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return "Published Today";
    }

    return `Published ${date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  };

  return (
    <div style={styles.shell}>
      <div style={styles.sidebar}>
        <div style={styles.brand}>
          <img
            src={goldenHorizonIcon}
            alt="Golden Horizon"
            style={styles.brandIcon}
          />
          <div style={styles.brandCopy}>
            <span style={styles.brandProduct}>Agentic AI</span>
          </div>
        </div>
       <div style={styles.userPanel}>
  <div style={styles.userRole}>SOC Analyst</div>

  <div style={styles.userEmail}>
    admin@test.com
  </div>

  <div style={styles.userStatus}>
    ● Online
  </div>
  <div style={styles.userStats}>
    <span>Incidents: {sidebarStats.incidents}</span>
    <span>Critical: {sidebarStats.critical}</span>
  </div>
</div>

      <button
  className="soc-nav-link"
  onClick={() => navigate("/dashboard")}
  style={navStyle(isActive("/dashboard"))}
>
  Dashboard
</button>

<button
  className="soc-nav-link"
  onClick={() => navigate("/create-incident")}
  style={navStyle(isActive("/create-incident"))}
>
  Create Incident
</button>

<button
  className="soc-nav-link"
  onClick={() => navigate("/investigation")}
  style={navStyle(isActive("/investigation"))}
>
  Investigation
</button>

<button
  className="soc-nav-link"
  onClick={() => navigate("/security-events")}
  style={navStyle(isActive("/security-events"))}
>
  Security Events
</button>

<button
  className="soc-nav-link"
  onClick={() => navigate("/world-map")}
  style={navStyle(isActive("/world-map"))}
>
  World Map
</button>

<button
  className="soc-nav-link"
  onClick={() => navigate("/threat-hunting")}
  style={navStyle(isActive("/threat-hunting"))}
>
  Threat Hunting
</button>

<button
  className="soc-nav-link"
  onClick={() => navigate("/threat-intelligence")}
  style={navStyle(isActive("/threat-intelligence"))}
>
  Threat Intelligence
</button>

<button
  className="soc-nav-link"
  onClick={() => navigate("/executive-dashboard")}
  style={navStyle(isActive("/executive-dashboard"))}
>
  Executive Dashboard
</button>

<button
  className="soc-nav-link"
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
  className="soc-resource-link"
  href="https://www.cve.org"
  target="_blank"
  rel="noreferrer"
  title="Open CVE Database"
  style={styles.resourceLink}
>
    <img src={cveLogo} alt="CVE" style={styles.resourceLogo} />
  </a>

  <a
    className="soc-resource-link"
    href="https://attack.mitre.org"
    target="_blank"
    rel="noreferrer"
      title=" Open ATT&CK Framework"
    style={styles.resourceLink}
  >
    <img src={mitreLogo} alt="MITRE" style={styles.resourceLogo} />
  </a>

  <a
    className="soc-resource-link"
    href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
    target="_blank"
    rel="noreferrer"
    title="Open CISA KEV Catalog"
    style={styles.resourceLink}
  >
    <img src={cisaLogo} alt="CISA" style={styles.resourceLogo} />
  </a>

  <div style={styles.latestIntelPanel}>
    <div style={styles.latestIntelHeader}>Latest Threat Intel</div>
    <div style={styles.latestIntelSync}>{latestCveStatus}</div>

    <a
      href={
        latestCve
          ? `https://nvd.nist.gov/vuln/detail/${latestCve.id}`
          : "https://nvd.nist.gov/vuln/search"
      }
      target="_blank"
      rel="noreferrer"
      style={styles.latestIntelItem}
    >
      <span style={styles.intelType}>CVE</span>
      <div style={styles.intelContent}>
        <strong style={styles.intelValue}>
          {latestCve ? `${latestCve.id} (open)` : "Latest Critical CVE"}
        </strong>
        {latestCve ? (
          <>
            <span style={styles.intelMetaCritical}>
              <span style={styles.criticalDot} />
              CVSS {latestCve.score}
            </span>
            <span style={styles.intelMeta}>
              {formatCvePublished(latestCve.published)}
            </span>
          </>
        ) : (
          <span style={styles.intelMeta}>Waiting for NVD response</span>
        )}
      </div>
    </a>

    <a
      href="https://attack.mitre.org/techniques/T1190/"
      target="_blank"
      rel="noreferrer"
      style={styles.latestIntelItem}
    >
      <span style={styles.intelType}>MITRE</span>
      <div style={styles.intelContent}>
        <strong style={styles.intelValue}>T1190 (open)</strong>
        <span style={styles.intelMeta}>Exploit Public-Facing Application</span>
      </div>
    </a>

    <a
      href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
      target="_blank"
      rel="noreferrer"
      style={styles.latestIntelItem}
    >
      <span style={styles.intelType}>CISA</span>
      <div style={styles.intelContent}>
        <strong style={styles.intelValue}>KEV Added (open)</strong>
        <span style={styles.intelMeta}>Fortinet SSL-VPN</span>
      </div>
    </a>
  </div>
</div>

<button onClick={handleLogout} style={styles.logout}>
  Logout
</button>

      </div>

      <div style={styles.main}>
        {pageTitle && (
          <div style={styles.topbar}>
            <h2 style={styles.topbarTitle}>{pageTitle}</h2>
          </div>
        )}

        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const navStyle = (active) => ({
  ...styles.link,
  background: active ? "rgba(96, 165, 250, 0.18)" : "transparent",
  color: active ? "#f8fafc" : "#cbd5e1",
  borderLeft: active ? "3px solid #60a5fa" : "3px solid transparent",
});

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#08111f",
    width: "100%",
  },

 sidebar: {
  width: "240px",
  background: "#08111f",
  color: "#fff",
  padding: "16px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  borderRight: "1px solid #334155",
  overflowY: "auto",
},

  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    marginBottom: "16px",
    padding: "2px 0 4px",
  },

  brandIcon: {
    width: "52px",
    height: "34px",
    objectFit: "contain",
    borderRadius: "6px",
    flexShrink: 0,
  },

  brandCopy: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.05,
    minWidth: 0,
  },

  brandProduct: {
    color: "#f8fafc",
    fontSize: "17px",
    fontWeight: "800",
    letterSpacing: "0.2px",
    whiteSpace: "nowrap",
  },

 link: {
  padding: "8px 10px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  textAlign: "left",
  fontWeight: "600",
  fontSize: "13px",
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
  padding: "14px 22px",
  borderBottom: "1px solid #334155",
  background: "#08111f",
},
topbarTitle: {
  margin: 0,
  fontSize: "24px",
  fontWeight: "700",
  color: "#f8fafc",
},
  content: {
    padding: "0",
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
latestIntelPanel: {
  width: "100%",
  marginTop: "4px",
  padding: "10px",
  boxSizing: "border-box",
  background: "#0f172a",
  border: "1px solid #263244",
  borderRadius: "8px",
},
latestIntelHeader: {
  color: "#94a3b8",
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.4px",
  textTransform: "uppercase",
  marginBottom: "4px",
},
latestIntelSync: {
  color: "#64748b",
  fontSize: "10px",
  marginBottom: "6px",
},
latestIntelItem: {
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  gap: "8px",
  padding: "8px 0",
  borderTop: "1px solid #1e293b",
  color: "inherit",
  textDecoration: "none",
},
intelType: {
  alignSelf: "start",
  color: "#38bdf8",
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "0.6px",
},
intelContent: {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
},
intelValue: {
  color: "#f8fafc",
  fontSize: "12px",
  lineHeight: 1.2,
  overflowWrap: "anywhere",
},
intelMeta: {
  color: "#94a3b8",
  fontSize: "11px",
  lineHeight: 1.25,
  overflowWrap: "anywhere",
},
intelMetaCritical: {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  color: "#fecaca",
  fontSize: "11px",
  fontWeight: "700",
  lineHeight: 1.25,
},
criticalDot: {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "#ef4444",
  flexShrink: 0,
},
userPanel: {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "10px",
  marginBottom: "14px",
},

userRole: {
  color: "#60a5fa",
  fontSize: "13px",
  fontWeight: "700",
  marginBottom: "6px",
},

userEmail: {
  color: "#cbd5e1",
  fontSize: "12px",
},
userStatus: {
  marginTop: "8px",
  color: "#10b981",
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
