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

const getSeverityColor = (severity) => {
  const value = String(severity || "").toLowerCase();

  if (value === "critical") return "#dc2626";
  if (value === "high") return "#f97316";
  if (value === "medium") return "#eab308";
  return "#22c55e";
};

export default function ExecutiveDashboard() {
  const [incidents, setIncidents] = useState([]);

  const loadIncidents = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get("http://localhost:5000/incidents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load executive dashboard:", err);
    }
  }, []);

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

  const riskScore = Math.max(
    0,
    Math.min(100, critical * 18 + high * 10 + medium * 4 + open * 2)
  );

  const posture =
    riskScore >= 70
      ? "High Risk"
      : riskScore >= 40
      ? "Medium Risk"
      : "Healthy";

  const postureColor =
    riskScore >= 70
      ? "#dc2626"
      : riskScore >= 40
      ? "#f97316"
      : "#22c55e";

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

  const recommendedAction =
    criticalOpenCases > 0
      ? "Investigate critical incidents and review external attack sources."
      : high > 0
      ? "Prioritize high-severity incidents and validate containment actions."
      : "Continue monitoring and maintain routine incident review.";

  return (
    <div style={styles.page}>
      <p style={styles.subtitle}>
        High-level security posture, business risk, and active threat overview.
      </p>

      <div style={{ ...styles.scoreCard, borderColor: postureColor }}>
        <div>
          <p style={styles.sectionLabel}>Risk Score</p>
          <h1 style={{ ...styles.scoreValue, color: postureColor }}>
            {riskScore}/100
          </h1>
        </div>

        <div style={{ ...styles.postureBadge, background: postureColor }}>
          {posture}
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.card}>
          <h2>{total}</h2>
          <p>Total Incidents</p>
        </div>

        <div style={styles.card}>
          <h2>{open}</h2>
          <p>Open</p>
        </div>

        <div style={styles.card}>
          <h2>{inProgress}</h2>
          <p>In Progress</p>
        </div>

        <div style={styles.card}>
          <h2>{closed}</h2>
          <p>Closed</p>
        </div>

        <div style={styles.card}>
          <h2>{critical}</h2>
          <p>Critical Threats</p>
        </div>

        <div style={styles.card}>
          <h2>{high}</h2>
          <p>High Threats</p>
        </div>

        <div style={styles.card}>
          <h2>{uniqueIPs}</h2>
          <p>Attack Sources</p>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Top Business Risks</h3>

          {topRisks.length > 0 ? (
            topRisks.map((risk) => (
              <div key={risk.id || risk.incident_id} style={styles.riskItem}>
                <div>
                  <strong>{risk.title}</strong>
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
                <strong style={styles.mitreTechnique}>
                  {technique.id} - {technique.name}
                </strong>

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
          <h3>Immediate priority</h3>
          <p>
            {criticalOpenCases > 0
              ? "Investigate critical incidents and review external attack sources."
              : recommendedAction}
          </p>
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
    marginBottom: "16px",
  },

  scoreCard: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "16px",
  },

  sectionLabel: {
    color: "#94a3b8",
    margin: 0,
    fontSize: "13px",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  scoreValue: {
    margin: "6px 0 0",
    fontSize: "38px",
    lineHeight: 1,
  },

  postureBadge: {
    color: "#fff",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "16px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "12px",
    textAlign: "center",
    minHeight: "76px",
  },

  panel: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "16px",
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
    padding: "11px",
    background: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #475569",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    textAlign: "left",
  },

  mitreTechnique: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  mitreCount: {
    flexShrink: 0,
    color: "#cbd5e1",
    fontSize: "13px",
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

  emptyText: {
    color: "#94a3b8",
    margin: 0,
  },
};
