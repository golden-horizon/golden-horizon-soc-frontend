import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const MITRE_TECHNIQUES = [
  {
    id: "T1110",
    name: "Brute Force",
    matches: ["brute force"],
  },
  {
    id: "T1190",
    name: "Exploit Public-Facing Application",
    matches: ["api abuse", "sql", "injection"],
  },
  {
    id: "T1059",
    name: "Command and Scripting Interpreter",
    matches: ["xss", "script", "command"],
  },
  {
    id: "T1539",
    name: "Steal Web Session Cookie",
    matches: ["session hijacking", "session"],
  },
];

const isExternalIP = (ip) => {
  if (!ip) return false;

  return !(
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
};

const isExternalCountry = (country) =>
  country && country !== "Localhost" && country !== "Unknown";

const getSeverityColor = (severity) => {
  const value = String(severity || "").toLowerCase();

  if (value === "critical") return "#dc2626";
  if (value === "high") return "#f97316";
  if (value === "medium") return "#eab308";
  return "#22c55e";
};

export default function ExecutiveDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [countryStats, setCountryStats] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");

    return {
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/incidents", {
        headers: getAuthHeaders(),
      });

      setIncidents(Array.isArray(res.data) ? res.data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load executive dashboard:", err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadIncidents();
  }, [loadIncidents]);

  const total = incidents.length;
  const open = incidents.filter((i) => i.status === "open").length;
  const inProgress = incidents.filter((i) => i.status === "in-progress").length;
  const closed = incidents.filter((i) => i.status === "closed").length;
  const critical = incidents.filter((i) => i.severity === "critical").length;
  const high = incidents.filter((i) => i.severity === "high").length;
  const uniqueIPs = new Set(
    incidents.map((i) => i.source_ip).filter(Boolean)
  ).size;

  const externalSources = new Set(
    incidents.map((i) => i.source_ip).filter(isExternalIP)
  ).size;

  const affectedUsers =
    new Set(incidents.map((i) => i.user_id).filter(Boolean)).size ||
    (total > 0 ? 1 : 0);

  const criticalOpenCases = incidents.filter(
    (i) => i.severity === "critical" && i.status !== "closed"
  ).length;

  const attackSources = uniqueIPs;
  const securityScore = Math.round(
    Math.max(
      0,
      100 - critical * 4 - high * 2 - open * 0.5 - attackSources * 2
    )
  );

  const posture =
    securityScore >= 75
      ? "Low Risk"
      : securityScore >= 50
      ? "Medium Risk"
      : "High Risk";

  const postureColor =
    securityScore >= 75
      ? "#22c55e"
      : securityScore >= 50
      ? "#f97316"
      : "#dc2626";

  const topRisks = incidents
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .sort((a, b) => {
      const order = { critical: 0, high: 1 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 3);

  const mitreCoverage = useMemo(
    () =>
      MITRE_TECHNIQUES.map((technique) => {
        const count = incidents.filter((incident) => {
          const text = `${incident.title || ""} ${incident.description || ""}`.toLowerCase();

          return technique.matches.some((match) => text.includes(match));
        }).length;

        return {
          ...technique,
          count,
        };
      }).filter((technique) => technique.count > 0),
    [incidents]
  );

  const recommendation =
    critical > 5
      ? {
          title: "Immediate priority",
          action: "Investigate critical incidents and review external attack sources.",
        }
      : critical === 0 && closed > open
      ? {
          title: "Security posture improving",
          action: "Closed cases exceed open cases. Continue monitoring and validate controls.",
        }
      : critical === 0
      ? {
          title: "Monitor environment",
          action: "No critical incidents detected. Maintain routine monitoring and response readiness.",
        }
      : high > 0
      ? {
          title: "Prioritize high severity",
          action: "Prioritize high-severity incidents and validate containment actions.",
        }
      : {
          title: "Monitor environment",
          action: "Continue monitoring and maintain routine incident review.",
        };

  const topAttackCountry =
    Object.entries(countryStats).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "No GeoIP data";

  const threatTrend =
    criticalOpenCases > 0 || critical + high > closed
      ? "Threat Activity: Increasing"
      : open > closed
      ? "Open Cases: Increasing"
      : "Threat Activity: Stable";

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not updated";

  useEffect(() => {
    const loadCountryStats = async () => {
      const sourceIPs = [
        ...new Set(incidents.map((i) => i.source_ip).filter(isExternalIP)),
      ];

      if (sourceIPs.length === 0) {
        setCountryStats({});
        return;
      }

      try {
        const geoResults = await Promise.all(
          sourceIPs.map(async (ip) => {
            const res = await axios.get(`http://localhost:5000/geoip/${ip}`, {
              headers: getAuthHeaders(),
            });

            return res.data;
          })
        );

        const ipToCountry = geoResults.reduce((acc, geo) => {
          const ip = geo.ip || geo.query;
          if (ip && isExternalCountry(geo.country)) {
            acc[ip] = geo.country;
          }
          return acc;
        }, {});

        const nextCountryStats = incidents.reduce((acc, incident) => {
          const country = ipToCountry[incident.source_ip];
          if (!country) return acc;

          acc[country] = (acc[country] || 0) + 1;
          return acc;
        }, {});

        setCountryStats(nextCountryStats);
      } catch (err) {
        console.error("Failed to load executive country stats:", err);
      }
    };

    loadCountryStats();
  }, [getAuthHeaders, incidents]);

  return (
    <div style={styles.page}>
      <p style={styles.subtitle}>
        High-level security posture, business risk, and active threat overview.
      </p>

      <p style={styles.lastUpdated}>Last Updated: {lastUpdatedLabel}</p>

      <div style={{ ...styles.scoreCard, borderColor: postureColor }}>
        <div style={styles.scoreContent}>
          <p style={styles.sectionLabel}>Security Posture</p>
          <div style={styles.scoreSummary}>
            <h1 style={{ ...styles.scoreValue, color: postureColor }}>
              {securityScore}%
            </h1>
            <span style={{ ...styles.scoreTextBadge, color: postureColor }}>
              {posture}
            </span>
          </div>

          <div style={styles.scoreBar}>
            <div
              style={{
                ...styles.scoreBarFill,
                width: `${securityScore}%`,
                background: postureColor,
              }}
            />
          </div>
        </div>

        <div style={styles.scoreMeta}>
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Incidents</p>
          <h2 style={styles.cardValue}>{total}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Open</p>
          <h2 style={styles.cardValue}>{open}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>In Progress</p>
          <h2 style={styles.cardValue}>{inProgress}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Closed</p>
          <h2 style={styles.cardValue}>{closed}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Critical Threats</p>
          <h2 style={styles.cardValue}>{critical}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>High Threats</p>
          <h2 style={styles.cardValue}>{high}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Attack Sources</p>
          <h2 style={styles.cardValue}>{uniqueIPs}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Top Attack Country</p>
          <h2 style={styles.cardTextValue}>{topAttackCountry}</h2>
        </div>

      </div>

      <div style={styles.grid}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Top Business Risks</h3>

          {topRisks.length > 0 ? (
            topRisks.map((risk) => (
              <div
                key={risk.id || risk.incident_id}
                style={{
                  ...styles.riskItem,
                  borderLeft: `5px solid ${getSeverityColor(risk.severity)}`,
                }}
              >
                <div style={styles.riskText}>
                  <strong style={styles.riskTitle} title={risk.title}>
                    {risk.title}
                  </strong>
                  <p>{risk.status || "open"}</p>
                </div>

                <span
                  style={{
                    ...styles.severityBadge,
                    background: getSeverityColor(risk.severity),
                  }}
                >
                  {risk.severity}
                </span>
              </div>
            ))
          ) : (
            <p style={styles.emptyText}>No high-risk incidents.</p>
          )}
        </div>

        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>MITRE Coverage</h3>

          {mitreCoverage.length > 0 ? (
            mitreCoverage.map((technique) => (
              <div key={technique.id} style={styles.mitreItem}>
                <span style={styles.mitreTechnique}>
                  {technique.id} - {technique.name}
                </span>

                <span style={styles.mitreCount}>
                  {technique.count} incidents
                </span>
              </div>
            ))
          ) : (
            <p style={styles.emptyText}>No MITRE techniques detected.</p>
          )}
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Business Impact Summary</h3>

          <div style={styles.item}>
            <strong>Affected Users</strong>
            <span>{affectedUsers}</span>
          </div>

          <div style={styles.item}>
            <strong>External Attack Sources</strong>
            <span>{externalSources}</span>
          </div>

          <div style={styles.item}>
            <strong>Critical Open Cases</strong>
            <span>{criticalOpenCases}</span>
          </div>

        </div>

        <div style={styles.recommendationBox}>
          <p style={styles.sectionLabel}>Executive Recommendation</p>
          <h3>{recommendation.title}</h3>
          <div style={styles.trendBadge}>{threatTrend}</div>
          <p>{recommendation.action}</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: "#0f172a",
    color: "#f8fafc",
    minHeight: "100vh",
    padding: "18px",
  },

  subtitle: {
    color: "#94a3b8",
    marginBottom: "6px",
  },

  lastUpdated: {
    color: "#cbd5e1",
    fontSize: "13px",
    margin: "0 0 16px",
  },

  scoreCard: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "16px",
    marginBottom: "16px",
  },

  scoreContent: {
    flex: 1,
    minWidth: 0,
  },

  scoreSummary: {
    display: "flex",
    alignItems: "baseline",
    gap: "12px",
    marginTop: "6px",
  },

  sectionLabel: {
    color: "#94a3b8",
    margin: 0,
    fontSize: "13px",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  scoreValue: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1,
  },

  scoreTextBadge: {
    fontSize: "14px",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  scoreBar: {
    height: "12px",
    marginTop: "14px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "999px",
    overflow: "hidden",
  },

  scoreBarFill: {
    height: "100%",
    borderRadius: "999px",
  },

  scoreMeta: {
    width: "72px",
    display: "flex",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "700",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "16px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "16px",
    marginBottom: "16px",
  },

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "18px",
    textAlign: "center",
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  cardLabel: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "14px",
    fontWeight: "700",
  },

  cardValue: {
    margin: "10px 0 0",
    fontSize: "34px",
    lineHeight: 1,
  },

  cardTextValue: {
    margin: "10px 0 0",
    fontSize: "17px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },

  panel: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "16px",
    minWidth: 0,
    overflow: "hidden",
  },

  panelTitle: {
    margin: "0 0 12px",
  },

  item: {
    marginTop: "10px",
    padding: "11px",
    background: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #475569",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },

  mitreItem: {
    marginTop: "10px",
    padding: "9px 10px",
    background: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #475569",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    textAlign: "left",
    minWidth: 0,
  },

  mitreTechnique: {
    minWidth: 0,
    overflow: "hidden",
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    fontSize: "14px",
    fontWeight: "500",
    color: "#f8fafc",
  },

  mitreCount: {
    flexShrink: 0,
    color: "#cbd5e1",
    fontSize: "12px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  riskItem: {
    marginTop: "10px",
    padding: "11px",
    background: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #475569",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    textAlign: "left",
  },

  riskText: {
    minWidth: 0,
    flex: 1,
  },

  riskTitle: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  severityBadge: {
    color: "#fff",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    flexShrink: 0,
  },

  recommendationBox: {
    background: "#111827",
    border: "1px solid #38bdf8",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 0 14px rgba(56, 189, 248, 0.16)",
  },

  trendBadge: {
    display: "inline-flex",
    margin: "4px 0 12px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(248, 113, 113, 0.14)",
    border: "1px solid rgba(248, 113, 113, 0.35)",
    color: "#fecaca",
    fontSize: "12px",
    fontWeight: "800",
  },

  emptyText: {
    color: "#94a3b8",
    margin: 0,
  },
};
