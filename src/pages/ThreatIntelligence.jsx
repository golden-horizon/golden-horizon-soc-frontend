import { useEffect, useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ThreatIntelligence() {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get("http://localhost:5000/incidents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.incidents)
        ? res.data.incidents
        : [];

      setIncidents(data);
      console.log("THREAT INTELLIGENCE INCIDENTS:", data);
    } catch (err) {
      console.error("Failed to load threat intelligence:", err);
    }
  };

  const normalise = (value) =>
    (value || "").toString().toLowerCase();

  const total = incidents.length;

  const critical = incidents.filter(
    (i) => normalise(i.severity) === "critical"
  ).length;

  const high = incidents.filter(
    (i) => normalise(i.severity) === "high"
  ).length;

  const medium = incidents.filter(
    (i) => normalise(i.severity) === "medium"
  ).length;

  const low = incidents.filter(
    (i) => normalise(i.severity) === "low"
  ).length;

  const ipCounts = incidents.reduce((acc, incident) => {
    const ip = incident.source_ip || "Unknown";
    acc[ip] = (acc[ip] || 0) + 1;
    return acc;
  }, {});

  const topIPs = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]);

  const mostActive = topIPs[0];

  const severityData = [
    { name: "Critical", value: critical },
    { name: "High", value: high },
    { name: "Medium", value: medium },
    { name: "Low", value: low },
  ];

  const severityColors = ["#991b1b", "#ef4444", "#f59e0b", "#22c55e"];

  const mitreStats = {};

  incidents.forEach((incident) => {
    const title = incident.title || "";

    if (title.includes("Brute Force")) {
      mitreStats["T1110"] = (mitreStats["T1110"] || 0) + 1;
    }

    if (
      title.includes("SQL") ||
      title.includes("API Abuse")
    ) {
      mitreStats["T1190"] = (mitreStats["T1190"] || 0) + 1;
    }

    if (title.includes("XSS")) {
      mitreStats["T1059"] = (mitreStats["T1059"] || 0) + 1;
    }

    if (title.includes("Session Hijacking")) {
      mitreStats["T1539"] = (mitreStats["T1539"] || 0) + 1;
    }
  });

  const threatTrends = incidents.reduce((acc, incident) => {
    const rawDate = incident.created_at || incident.createdAt;

    if (!rawDate) return acc;

    const date = new Date(rawDate).toLocaleDateString();

    acc[date] = (acc[date] || 0) + 1;

    return acc;
  }, {});

  return (
    <div style={styles.page}>
    
      <p style={styles.subtitle}>
        Overview of attacking sources, severity, and recent threat activity.
      </p>

      <div style={styles.statsGrid}>
        <div style={styles.card}>
          <h2>{total}</h2>
          <p>Total Threats</p>
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
<h2>{mostActive ? mostActive[0] : "N/A"}</h2>
<h3>Top Threat Source</h3>

{mostActive ? (
  <p>{mostActive[1]} incidents</p>
) : (
  <p>No active source available.</p>
)}

        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.panel}>
          <h3>Top Attacking IPs</h3>

          {topIPs.length > 0 ? (
            topIPs.map(([ip, count]) => (
              <div key={ip} style={styles.item}>
                <strong>{ip}</strong>
                <span>{count} incidents</span>
              </div>
            ))
          ) : (
            <p>No IP data available.</p>
          )}
        </div>

        <div style={styles.panel}>
          <h3>Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={140}>
  <PieChart>
    <Pie
  data={severityData}
  dataKey="value"
  outerRadius={50}
  label={false}
>
      {severityData.map((_, index) => (
        <Cell
          key={index}
          fill={severityColors[index]}
        />
      ))}
    </Pie>
    <Tooltip />
  </PieChart>
</ResponsiveContainer>

          <div style={styles.item}>
            <strong>Critical</strong>
            <span>{critical}</span>
          </div>

          <div style={styles.item}>
            <strong>High</strong>
            <span>{high}</span>
          </div>

          <div style={styles.item}>
            <strong>Medium</strong>
            <span>
              {incidents.filter((i) => i.severity === "medium").length}
            </span>
          </div>

          <div style={styles.item}>
            <strong>Low</strong>
            <span>
              {incidents.filter((i) => i.severity === "low").length}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.panel}>
  <h3>MITRE ATT&CK Overview</h3>

  {Object.entries(mitreStats).map(
    ([technique, count]) => (
      <div
        key={technique}
        style={styles.item}
      >
        <strong>{technique}</strong>
        <span>{count} incidents</span>
      </div>
    )
  )}
</div>

<div style={styles.panel}>
  <h3>Threat Trends</h3>

  {Object.entries(threatTrends).map(([date, count]) => (
    <div key={date} style={styles.item}>
      <strong>{date}</strong>
      <span>{count} threats</span>
    </div>
  ))}
</div>

      <div style={styles.panel}>
        <h3>Recent Threat Feed</h3>

        {incidents.slice(0, 8).map((incident) => (
          <div key={incident.id} style={styles.item}>
            <strong>{incident.title}</strong>
            <span>{incident.severity}</span>
            <small>{new Date(incident.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: "#0f172a",
    color: "#f8fafc",
    minHeight: "100vh",
    padding: "30px",
  },

  title: {
    fontSize: "34px",
    marginBottom: "8px",
  },

  subtitle: {
    color: "#94a3b8",
    marginBottom: "20px",
  },

  statsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "14px",
  marginBottom: "18px",
},

  grid: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px",
  marginBottom: "20px",
  alignItems: "start",
},

card: {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "12px",
  textAlign: "center",
  minHeight: "95px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
},
panel: {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "16px",
  alignSelf: "start",
},
  item: {
    marginTop: "10px",
    padding: "12px",
    background: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #475569",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
};