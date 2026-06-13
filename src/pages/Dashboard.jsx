import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import socket from "./socket";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "react-toastify";

export default function Dashboard() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const playAlertSound = () => {
    const audio = new Audio("/alert.mp3");
    audio.volume = 1;

    audio.play().catch((err) => {
      console.log("Sound blocked until user interaction:", err);
    });
  };
//loadIncidents
  useEffect(() => {
    const loadIncidents = async () => {
  try {
    const token = localStorage.getItem("token");

    const res = await axios.get("http://localhost:5000/incidents", {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("INCIDENTS RESPONSE:", res.data);

    const incidentData = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data.incidents)
      ? res.data.incidents
      : Array.isArray(res.data.data)
      ? res.data.data
      : [];

    setIncidents(incidentData);
  } catch {
    setError("Failed to load incidents");
  } finally {
    setLoading(false);
  }
};

    loadIncidents();
  }, []);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const onDelete = (id) => {
      setIncidents((prev) =>
        prev.filter((i) => (i.id || i.incident_id) !== id)
      );
    };

    const onCreate = (newIncident) => {
      setIncidents((prev) => {
        const newId = newIncident.id || newIncident.incident_id;

        const exists = prev.some(
          (i) => (i.id || i.incident_id) === newId
        );

        if (exists) return prev;

        const severity = (newIncident.severity || "low").toLowerCase();

        if (severity === "high" || severity === "critical") {
          toast.error(`🚨 ${newIncident.title} (${severity})`);
          playAlertSound();
        } else {
          toast.info(`ℹ️ ${newIncident.title}`);
        }

        return [newIncident, ...prev];
      });
    };

    const onUpdate = (updated) => {
      const updatedId = updated.id || updated.incident_id;

      setIncidents((prev) =>
        prev.map((i) =>
          (i.id || i.incident_id) === updatedId ? updated : i
        )
      );
    };

    socket.on("incident-deleted", onDelete);
    socket.on("incident-created", onCreate);
    socket.on("incident-updated", onUpdate);

    return () => {
      socket.off("incident-deleted", onDelete);
      socket.off("incident-created", onCreate);
      socket.off("incident-updated", onUpdate);
    };
  }, []);

  if (loading) {
    return (
      <div style={styles.center}>
        <p>Loading incidents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  const normalise = (value) => (value || "").toLowerCase();

  const ipCounts = incidents.reduce((acc, incident) => {
    if (!incident.source_ip) return acc;

    acc[incident.source_ip] = (acc[incident.source_ip] || 0) + 1;
    return acc;
  }, {});

  const topIPEntry = Object.entries(ipCounts).sort((a, b) => b[1] - a[1])[0];
  const topIP = topIPEntry?.[0] || "No source IP";
  const topIPCount = topIPEntry?.[1] || 0;

const stats = {
  total: incidents.length,
  open: incidents.filter((i) => normalise(i.status) === "open").length,
  inProgress: incidents.filter((i) => normalise(i.status) === "in-progress").length,
  closed: incidents.filter((i) => normalise(i.status) === "closed").length,
  critical: incidents.filter((i) => normalise(i.severity) === "critical").length,
  high: incidents.filter((i) => normalise(i.severity) === "high").length,
};


  const statusData = [
    { name: "Open", value: stats.open },
    { name: "In Progress", value: stats.inProgress },
    { name: "Closed", value: stats.closed },
  ];

  const severityData = [
    {
      name: "Critical",
      value: incidents.filter((i) => normalise(i.severity) === "critical").length,
    },
    {
      name: "High",
      value: incidents.filter((i) => normalise(i.severity) === "high").length,
    },
    {
      name: "Medium",
      value: incidents.filter((i) => normalise(i.severity) === "medium").length,
    },
    {
      name: "Low",
      value: incidents.filter((i) => normalise(i.severity) === "low").length,
    },
  ];

  const statusColors = ["#ef4444", "#f59e0b", "#22c55e"];
  const severityColors = ["#991b1b", "#ef4444", "#f59e0b", "#22c55e"];
const attackTypeCounts = incidents.reduce((acc, incident) => {
  const title = incident.title || "Unknown Attack";
  acc[title] = (acc[title] || 0) + 1;
  return acc;
}, {});

const topAttackTypes = Object.entries(attackTypeCounts)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);
  const filteredIncidents = incidents.filter((i) => {
  const matchesFilter =
    filter === "all" ||
    normalise(i.severity) === filter ||
    normalise(i.status) === filter;

  const matchesSearch =
    (i.title || "")
      .toLowerCase()
      .includes(search.toLowerCase()) ||
    (i.description || "")
      .toLowerCase()
      .includes(search.toLowerCase());

  return matchesFilter && matchesSearch;
});

  const getSeverityStyle = (severity) => {
    const s = normalise(severity);

    if (s === "critical") return { background: "#991b1b" };
    if (s === "high") return { background: "#ef4444" };
    if (s === "medium") return { background: "#f59e0b" };
    if (s === "low") return { background: "#22c55e" };

    return { background: "#6b7280" };
  };

  const formatDate = (date) => {
    if (!date) return "No timestamp";
    return new Date(date).toLocaleString();
  };

  return (
  <div style={styles.page}>
    <h2 style={styles.title}>
  Security Overview
</h2>

    <div style={styles.statsGrid}>
      <div style={styles.statCard}>Total: {stats.total}</div>
      <div style={styles.statCard}>Open: {stats.open}</div>
      <div style={styles.statCard}>In Progress: {stats.inProgress}</div>
      <div style={styles.statCard}>Closed: {stats.closed}</div>
      <div style={styles.criticalCard}>Critical: {stats.critical}</div>
      <div style={styles.highCard}>High: {stats.high}</div>


<div style={styles.statCard}>
  <div style={{ fontSize: "13px", color: "#94a3b8" }}>
    Top Source IP
  </div>

  <div style={styles.topSourceValue}>
    {topIP}
  </div>

  <div style={styles.topSourceMeta}>
    {topIPCount > 0 ? `${topIPCount} incidents` : "Add source_ip to incidents"}
  </div>
</div>
    </div>

    <div style={styles.chartGrid}>
      <div style={styles.chartBox}>
        <h3 style={styles.panelTitle}>Status Distribution</h3>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={statusData} dataKey="value" outerRadius={55} label>
              {statusData.map((_, i) => (
                <Cell key={i} fill={statusColors[i]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>


      <div style={styles.chartBox}>
        <h3 style={styles.panelTitle}>Severity Overview</h3>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={severityData}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value">
              {severityData.map((_, i) => (
                <Cell key={i} fill={severityColors[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

<div style={styles.chartGrid}>

  <div style={styles.chartBox}>
    <h3 style={styles.panelTitle}>Recent Critical Alerts</h3>

    {incidents
      .filter(
        (i) => (i.severity || "").toLowerCase() === "critical"
      )
      .slice(0, 5)
      .map((i) => (
        <div
          key={i.id || i.incident_id}
          style={{
            padding: "8px",
            borderBottom: "1px solid #334155",
          }}
        >
          <strong>{i.title}</strong>
          <br />
          <small>
            {formatDate(i.created_at || i.createdAt)}
          </small>
        </div>
      ))}
  </div>

  <div style={styles.chartBox}>
    <h3 style={styles.panelTitle}>Top Attack Types</h3>

    {topAttackTypes.map((attack) => (
      <div key={attack.name} style={styles.attackTypeRow}>
        <span>{attack.name}</span>
        <strong>{attack.count}</strong>
      </div>
    ))}
  </div>

</div>

<div style={{ marginBottom: "15px" }}>
  <input
    type="text"
    placeholder="Search incidents..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={{
      width: "100%",
      padding: "12px",
      borderRadius: "10px",
      border: "1px solid #334155",
      background: "#111827",
      color: "#fff",
      fontSize: "14px",
    }}
  />
</div>

    <div style={styles.filters}>
      {["all", "critical", "high", "open", "closed"].map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          style={{
            ...styles.filterBtn,
            background: filter === f ? "#4f46e5" : "#111827",
            color: "#f9fafb",
            border: filter === f ? "1px solid #818cf8" : "1px solid #334155",
          }}
        >
          {f.toUpperCase()}
        </button>
      ))}
    </div>

    

    <div style={styles.grid}>
      {filteredIncidents.map((i) => {
        const id = i.id || i.incident_id;

        return (
          <div
  key={id}
  style={{
  ...styles.card,
  cursor: "pointer",

  borderLeft:
    i.severity === "critical"
      ? "6px solid #dc2626"
      : i.severity === "high"
      ? "6px solid #f97316"
      : "6px solid #2563eb",
}}
  onClick={() => navigate(`/incidents/${id}`)}
>
            <div style={styles.incidentTitle}>{i.title}</div>

            <div style={styles.incidentDesc}>{i.description}</div>

            <span style={{ ...styles.badge, ...getSeverityStyle(i.severity) }}>
              {i.severity || "low"}
            </span>

            <strong style={styles.statusText}>{i.status || "open"}</strong>

            <div style={styles.dateText}>
              {formatDate(i.created_at || i.createdAt)}
            </div>

            
          </div>
        );
      })}
    </div>
  </div>
);
}
const styles = {
 page: {
  padding: "10px 12px",
  background: "#0f172a",
  minHeight: "100vh",
},

title: {
  marginBottom: "8px",
  color: "#f9fafb",
  fontSize: "22px",
  fontWeight: "600",
},

  center: {
    height: "70vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    color: "#fff",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginBottom: "18px",
  },

  statCard: {
    background: "#111827",
    color: "#f9fafb",
    padding: "10px",
    borderRadius: "12px",
    fontWeight: "bold",
    fontSize: "13px",
    border: "1px solid #1e293b",
    boxShadow: "0 0 12px rgba(59,130,246,0.15)",
  },

  criticalCard: {
  background: "#7f1d1d",
  color: "#fff",
  padding: "15px",
  borderRadius: "12px",
  fontWeight: "bold",
  fontSize: "18px",
  border: "1px solid #ef4444",
  boxShadow: "0 0 18px rgba(239,68,68,0.5)",
},

  highCard: {
  background: "#991b1b",
  color: "#fff",
  padding: "15px",
  borderRadius: "12px",
  fontWeight: "bold",
  fontSize: "18px",
  border: "1px solid #f87171",
  boxShadow: "0 0 16px rgba(248,113,113,0.4)",
},
 chartGrid: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "15px",
  marginBottom: "20px",
},

chartBox: {
  background: "#111827",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #1e293b",
  boxShadow: "0 0 10px rgba(0,0,0,0.35)",
  color: "#f9fafb",
  minHeight: "140px",
},
  filters: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },

  filterBtn: {
    background: "#111827",
    color: "#f9fafb",
    border: "1px solid #374151",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "0.2s",
  },

  grid: {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
},

card: {
  background: "#111827",
  color: "#f9fafb",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #1e293b",
  boxShadow: "0 0 10px rgba(0,0,0,0.35)",

  display: "grid",
  gridTemplateColumns: "2fr 3fr auto auto auto",
  gap: "12px",
  alignItems: "center",
},

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },

  badge: {
    padding: "6px 12px",
    borderRadius: "999px",
    color: "#fff",
    fontSize: "12px",
    textTransform: "capitalize",
    fontWeight: "bold",
    letterSpacing: "0.5px",
  },

  desc: {
    marginTop: "14px",
    marginBottom: "18px",
    color: "#d1d5db",
    lineHeight: "1.6",
    fontSize: "15px",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
    fontSize: "14px",
    color: "#cbd5e1",
  },

 


panelTitle: {
  fontSize: "16px",
  fontWeight: "600",
  marginBottom: "6px",
},

incidentTitle: {
  fontWeight: "600",
  fontSize: "14px",
  color: "#f8fafc",
},

incidentDesc: {
  color: "#cbd5e1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
},

statusText: {
  color: "#60a5fa",
},

dateText: {
  color: "#94a3b8",
  fontSize: "12px",
},
attackTypeRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  marginBottom: "8px",
  background: "#1e293b",
  borderRadius: "10px",
  border: "1px solid #334155",
  color: "#f8fafc",
},
statLabel: {
  fontSize: "13px",
  color: "#94a3b8",
},

statValue: {
  marginTop: "6px",
  fontSize: "18px",
  color: "#f8fafc",
  fontWeight: "700",
},

topSourceValue: {
  fontSize: "18px",
  fontWeight: "700",
  marginTop: "8px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
},

topSourceMeta: {
  marginTop: "6px",
  color: "#94a3b8",
  fontSize: "12px",
},


};

