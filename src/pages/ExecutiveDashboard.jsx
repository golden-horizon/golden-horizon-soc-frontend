import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  getGeoIPLookupIP,
  getPresentationIP,
  isExternalCountry,
  isGeoIPVisualizationIP,
} from "../utils/geoPresentation";

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

const getSeverityColor = (severity) => {
  const value = String(severity || "").toLowerCase();

  if (value === "critical") return "#dc2626";
  if (value === "high") return "#f97316";
  if (value === "medium") return "#eab308";
  return "#22c55e";
};

export default function ExecutiveDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [loginActivity, setLoginActivity] = useState([]);
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
      const [incidentRes, eventRes, loginRes] = await Promise.allSettled([
        axios.get("http://localhost:5000/incidents", {
          headers: getAuthHeaders(),
        }),
        axios.get("http://localhost:5000/security-events", {
          headers: getAuthHeaders(),
        }),
        axios.get("http://localhost:5000/login-activity", {
          headers: getAuthHeaders(),
        }),
      ]);

      setIncidents(
        incidentRes.status === "fulfilled" && Array.isArray(incidentRes.value.data)
          ? incidentRes.value.data
          : []
      );
      setSecurityEvents(
        eventRes.status === "fulfilled" && Array.isArray(eventRes.value.data)
          ? eventRes.value.data
          : []
      );
      setLoginActivity(
        loginRes.status === "fulfilled" && Array.isArray(loginRes.value.data)
          ? loginRes.value.data
          : []
      );
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
  const medium = incidents.filter((i) => i.severity === "medium").length;
  const uniqueIPs = new Set(
    incidents
      .map((i) => i.source_ip)
      .filter(isGeoIPVisualizationIP)
      .map(getPresentationIP)
  ).size;

  const externalSources = new Set(
    incidents
      .map((i) => i.source_ip)
      .filter(isGeoIPVisualizationIP)
      .map(getPresentationIP)
  ).size;

  const affectedUsers =
    new Set(
      [
        ...incidents.map((i) => i.user_id),
        ...securityEvents.map((event) => event.username),
        ...loginActivity.map((activity) => activity.username),
      ].filter(Boolean)
    ).size || (total > 0 ? 1 : 0);

  const criticalOpenCases = incidents.filter(
    (i) => i.severity === "critical" && i.status !== "closed"
  ).length;

  const attackSources = uniqueIPs;
  // Weighted health score: compare current risk load against expected maximum
  // portfolio risk, so busy demo data stays dynamic without collapsing to 0.
  const totalRiskWeight =
    critical * 4 + high * 2 + medium * 1 + open * 0.5 + attackSources * 2;
  const maxExpectedRisk = Math.max(total * 4, 100);
  const rawScore = Math.round(
    Math.max(
      0,
      100 - (totalRiskWeight / maxExpectedRisk) * 100
    )
  );
  const isCriticalRiskEnvironment =
    criticalOpenCases >= 10 ||
    (critical >= Math.max(total * 0.5, 1) && open > closed);
  const securityScore = isCriticalRiskEnvironment
    ? Math.max(rawScore, 10)
    : Math.max(rawScore, 15);

  const posture =
    isCriticalRiskEnvironment
      ? "Critical Risk"
      : securityScore >= 75
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

  const topRisks = Object.values(
    incidents
      .filter((i) => i.severity === "critical" || i.severity === "high")
      .reduce((acc, incident) => {
        const key = incident.title || "Untitled Risk";
        const order = { critical: 0, high: 1 };

        if (!acc[key]) {
          acc[key] = {
            title: key,
            count: 0,
            severity: incident.severity,
            status: incident.status || "open",
          };
        }

        acc[key].count += 1;

        if (order[incident.severity] < order[acc[key].severity]) {
          acc[key].severity = incident.severity;
        }

        return acc;
      }, {})
  )
    .sort((a, b) => {
      const order = { critical: 0, high: 1 };
      return order[a.severity] - order[b.severity] || b.count - a.count;
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

  const focusRisks = topRisks
    .slice(0, 2)
    .map((risk) => risk.title)
    .join(" and ");

  const recommendation =
    critical > 5
      ? {
          title: "Immediate Priority",
          action: `Critical threat activity detected. Focus on ${
            focusRisks || "critical incident clusters"
          }. Review exposed internet-facing assets and implement containment actions.`,
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

  const topCountryEntry = Object.entries(countryStats).sort((a, b) => b[1] - a[1])[0];
  const topThreatSourceCountry = topCountryEntry
    ? `${topCountryEntry[0]} (${topCountryEntry[1]} ${
        topCountryEntry[1] === 1 ? "incident" : "incidents"
      })`
    : "No GeoIP data";

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
        ...new Set(
          incidents
            .map((i) => i.source_ip)
            .filter(isGeoIPVisualizationIP)
            .map(getGeoIPLookupIP)
        ),
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
            acc[getPresentationIP(ip)] = geo.country;
          }
          return acc;
        }, {});

        const nextCountryStats = incidents.reduce((acc, incident) => {
          const country = ipToCountry[getPresentationIP(incident.source_ip)];
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
          <p style={styles.cardLabel}>Top Threat Source Country</p>
          <h2 style={styles.cardTextValue}>{topThreatSourceCountry}</h2>
        </div>

      </div>

      <div style={styles.grid}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Top Business Risks</h3>

          {topRisks.length > 0 ? (
            topRisks.map((risk) => (
              <div
                key={risk.title}
                style={{
                  ...styles.riskItem,
                  borderLeft: `5px solid ${getSeverityColor(risk.severity)}`,
                }}
              >
                <div style={styles.riskText}>
                  <strong style={styles.riskTitle} title={risk.title}>
                    {risk.title}
                  </strong>
                  <p>
                    {risk.count} {risk.count === 1 ? "incident" : "incidents"}
                  </p>
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
            <strong>Unique Affected Accounts</strong>
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
