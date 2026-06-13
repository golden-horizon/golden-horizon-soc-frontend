import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ThreatHunting() {
  const [incidents, setIncidents] = useState([]);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const navigate = useNavigate();

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

      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load threat hunting data:", err);
    }
  };

  const filtered = incidents.filter((item) => {
    const text = `
      ${item.title || ""}
      ${item.description || ""}
      ${item.source_ip || ""}
      ${item.status || ""}
      ${item.severity || ""}
    `.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesSeverity =
      severity === "all" ||
      (item.severity || "").toLowerCase() === severity;

    return matchesSearch && matchesSeverity;
  });

  const timeline = [...filtered].sort(
  (a, b) => new Date(a.created_at) - new Date(b.created_at)
);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Threat Hunting</h1>

      <p style={styles.subtitle}>
        Search incidents by IP, attack type, severity, status, or description.
      </p>
      <div style={styles.statsGrid}>
  <div style={styles.statCard}>
    <h2>{incidents.length}</h2>
    <p>Total Incidents</p>
  </div>

  <div style={styles.statCard}>
    <h2>
      {incidents.filter(i => i.severity === "critical").length}
    </h2>
    <p>Critical</p>
  </div>

  <div style={styles.statCard}>
    <h2>
      {incidents.filter(i => i.severity === "high").length}
    </h2>
    <p>High</p>
  </div>

  <div style={styles.statCard}>
    <h2>
      {new Set(
        incidents
          .map(i => i.source_ip)
          .filter(Boolean)
      ).size}
    </h2>
    <p>Unique IPs</p>
  </div>
</div>

<div style={styles.timelineBox}>
  <h3>Threat Hunting Timeline</h3>

  {timeline.map((item) => (
    <div key={item.id} style={styles.timelineItem}>
      <strong>{item.title}</strong>
      <span>{item.severity}</span>
      <small>{new Date(item.created_at).toLocaleString()}</small>
    </div>
  ))}
</div>

      <div style={styles.filters}>
        <input
          style={styles.input}
          placeholder="Search IP, attack type, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={styles.select}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div style={styles.summary}>
        Results: <strong>{filtered.length}</strong>
      </div>

      <div style={styles.results}>
        {filtered.length > 0 ? (
          filtered.map((incident) => (
            <div key={incident.id} style={styles.card}>
              <h3>{incident.title}</h3>
              <p>{incident.description}</p>
              <p>
                <strong>Source IP:</strong> {incident.source_ip || "N/A"}
              </p>
              <p>
                <strong>Severity:</strong> {incident.severity}
              </p>
              <p>
                <strong>Status:</strong> {incident.status}
              </p>
              <small>
                {new Date(incident.created_at).toLocaleString()}
              </small>
              <button
  style={styles.investigateBtn}
  onClick={() =>
    navigate(`/incidents/${incident.id}`)
  }
>
  Investigate
</button>
            </div>
          ))
        ) : (
          <p>No matching incidents found.</p>
        )}
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

  filters: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "12px",
    marginBottom: "20px",
  },

  input: {
    background: "#020617",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "12px",
  },

  select: {
    background: "#020617",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "12px",
  },

  summary: {
    marginBottom: "18px",
    color: "#cbd5e1",
  },

  results: {
    display: "grid",
    gap: "14px",
  },

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "18px",
  },
  statsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "15px",
  marginBottom: "20px",
},

statCard: {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "20px",
  textAlign: "center",
},
timelineBox: {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "18px",
  marginBottom: "20px",
},

timelineItem: {
  marginTop: "10px",
  padding: "10px",
  background: "#1e293b",
  borderRadius: "8px",
  border: "1px solid #475569",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
},
investigateBtn: {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  marginTop: "10px",
},
};