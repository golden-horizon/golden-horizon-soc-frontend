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
import {
  getPresentationIP,
  isGeoIPVisualizationIP,
} from "../utils/geoPresentation";

export default function Dashboard() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [socStats, setSocStats] = useState(null);
  const [highPriorityCases, setHighPriorityCases] = useState([]);
  const [aiCases, setAiCases] = useState([]);

  const playAlertSound = () => {
    const audio = new Audio("/alert.mp3");
    audio.volume = 1;

    audio.play().catch((err) => {
      console.log("Sound blocked until user interaction:", err);
    });
  };
// load AI SOC stats
  useEffect(() => {
    const loadSocStats = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/statistics");
        const data = await res.json();
        console.log("AI SOC STATS:", data);
        setSocStats(data);
      } catch (err) {
        console.log("Failed to load AI SOC stats:", err);
      }
    };

    loadSocStats();
  }, []);


  useEffect(() => {
  const loadAiCases = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/cases");
      const data = await res.json();

      console.log("AI SOC CASES:", data);

      setAiCases(data.cases || []);
    } catch (err) {
      console.log("Failed to load AI SOC cases:", err);
    }
  };

  loadAiCases();
  }, []);


  useEffect(() => {
  const loadHighPriority = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/high-priority");
      const data = await res.json();

      console.log("HIGH PRIORITY CASES:", data);

      setHighPriorityCases(data.cases || []);
    } catch (err) {
      console.log("Failed to load high priority cases:", err);
    }
  };

  loadHighPriority();
  }, []);

// load incidents
  useEffect(() => {
    const loadIncidents = async () => {
  try {
    const token = localStorage.getItem("token");

    const res = await axios.get("https://golden-horizon-soc-backend.onrender.com/incidents", {
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
    if (!isGeoIPVisualizationIP(incident.source_ip)) return acc;

    const ip = getPresentationIP(incident.source_ip);
    acc[ip] = (acc[ip] || 0) + 1;
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
  const displayCases = aiCases.length > 0 ? aiCases : incidents;
  const filteredIncidents = displayCases.filter((i) => {
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

    if (s === "critical") return { borderColor: "#ef4444", color: "#fecaca" };
    if (s === "high") return { borderColor: "#f97316", color: "#fed7aa" };
    if (s === "medium") return { borderColor: "#eab308", color: "#fef08a" };
    if (s === "low") return { borderColor: "#22c55e", color: "#bbf7d0" };

    return { borderColor: "#64748b", color: "#cbd5e1" };
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
      <div className="soc-kpi-card" style={styles.statCard}>
        <span style={styles.statLabel}>Total Incidents</span>
        <strong style={styles.statValue}>{socStats?.total_cases ?? stats.total}</strong>
      </div>

      <div className="soc-kpi-card" style={styles.statCard}>
        <span style={styles.statLabel}>Open</span>
        <strong style={styles.statValue}>{socStats?.by_status?.Open ?? stats.open}</strong>
      </div>

      <div className="soc-kpi-card" style={styles.statCard}>
        <span style={styles.statLabel}>In Progress</span>
        <strong style={styles.statValue}>{socStats?.by_status?.["In Progress"] ?? stats.inProgress}</strong>
      </div>

      <div className="soc-kpi-card" style={styles.statCard}>
        <span style={styles.statLabel}>Closed</span>
        <strong style={styles.statValue}>{stats.closed}</strong>
      </div>

      <div className="soc-kpi-card" style={{ ...styles.statCard, borderLeft: "3px solid #ef4444" }}>
        <span style={styles.statLabel}>Critical</span>
        <strong style={styles.statValue}>{socStats?.by_severity?.Critical ?? stats.critical}</strong>
      </div>

      <div className="soc-kpi-card" style={{ ...styles.statCard, borderLeft: "3px solid #f97316" }}>
        <span style={styles.statLabel}>High</span>
        <strong style={styles.statValue}>{socStats?.by_severity?.High ?? stats.high}</strong>
      </div>


<div className="soc-kpi-card soc-top-source-card" style={styles.statCard}>
  <span style={styles.statLabel}>Top Source IP</span>

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
        <div style={styles.donutWrap}>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                innerRadius={70}
                outerRadius={105}
                label={false}
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={statusColors[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div style={styles.donutCenter}>
            <strong>{stats.open}</strong>
            <span>Open</span>
          </div>
        </div>

        <div style={styles.statusLegend}>
          {statusData.map((item, index) => (
            <div key={item.name} style={styles.statusLegendItem}>
              <span
                style={{
                  ...styles.statusLegendDot,
                  borderColor: statusColors[index],
                }}
              />
              <span>{item.name} ({item.value})</span>
            </div>
          ))}
        </div>
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
    <h3 style={styles.panelTitle}>Escalated AI SOC Cases</h3>

    {highPriorityCases.slice(0, 5).map((c) => (
  <div
    key={c.case_id}
    style={{
      padding: "8px",
      borderBottom: "1px solid #334155",
    }}
  >
    <strong>{c.incident?.attack_type || "Unknown Attack"}</strong>
    <br />
    <small>
      {c.severity} · {c.incident?.source_ip} · Events: {c.event_count}
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
          className="soc-action-button"
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
        const id = i.case_id || i.id || i.incident_id;
        const attackType = i.incident?.attack_type || i.title |"Unknown Attack";
        const sourceIp = i.incident?.source_ip || i.source_ip || "Unknown IP";
        const user = i.incident?.user || i.user || "unknown";
        const eventCount = i.event_count || 1;

        return (
          <div
  className="soc-incident-row"
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
  onClick={() => navigate(`/ai-cases/${id}`)}
>
            <div style={styles.incidentTitle}>
            {attackType}
            <br />
            <small style={{ color: "#94a3b8" }}>{id}</small>
            </div>

            <div style={styles.incidentDesc}>
                  Source IP: {sourceIp} · User: {user} · Events: {eventCount}
            </div>

            <span style={{ ...styles.severityIndicator, ...getSeverityStyle(i.severity) }}>
              <span style={{ ...styles.severityRing, ...getSeverityStyle(i.severity) }} />
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
  fontSize: "20px",
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
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #263244",
    boxShadow: "0 1px 2px rgba(0,0,0,0.24)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: "62px",
  },

  criticalCard: {
  background: "#111827",
  color: "#f9fafb",
  padding: "12px",
  borderRadius: "8px",
  fontWeight: "bold",
  fontSize: "14px",
  border: "1px solid #263244",
  borderLeft: "3px solid #ef4444",
  boxShadow: "0 1px 2px rgba(0,0,0,0.24)",
},

  highCard: {
  background: "#111827",
  color: "#f9fafb",
  padding: "12px",
  borderRadius: "8px",
  fontWeight: "bold",
  fontSize: "14px",
  border: "1px solid #263244",
  borderLeft: "3px solid #f97316",
  boxShadow: "0 1px 2px rgba(0,0,0,0.24)",
},
 chartGrid: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  marginBottom: "16px",
},

chartBox: {
  background: "#111827",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #263244",
  boxShadow: "0 1px 2px rgba(0,0,0,0.24)",
  color: "#f9fafb",
  minHeight: "260px",
},

donutWrap: {
  position: "relative",
  height: "230px",
},

donutCenter: {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  color: "#f8fafc",
},

statusLegend: {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
  marginTop: "8px",
},

statusLegendItem: {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  color: "#cbd5e1",
  fontSize: "12px",
  minWidth: 0,
},

statusLegendDot: {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  border: "2px solid",
  background: "transparent",
  flexShrink: 0,
},

  filters: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },

  filterBtn: {
    background: "#111827",
    color: "#f9fafb",
    border: "1px solid #374151",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "12px",
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
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #263244",
  boxShadow: "0 1px 2px rgba(0,0,0,0.24)",

  display: "grid",
  gridTemplateColumns: "minmax(160px, 1.4fr) minmax(220px, 2fr) auto auto minmax(120px, auto)",
  gap: "10px",
  alignItems: "center",
},

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },

  severityIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: "#cbd5e1",
    fontSize: "11px",
    textTransform: "capitalize",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  severityRing: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    border: "2px solid",
    background: "transparent",
    flexShrink: 0,
  },

  desc: {
    marginTop: "14px",
    marginBottom: "18px",
    color: "#d1d5db",
    lineHeight: "1.6",
    fontSize: "13px",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
    fontSize: "12px",
    color: "#cbd5e1",
  },

 


panelTitle: {
  fontSize: "15px",
  fontWeight: "600",
  marginBottom: "8px",
},

incidentTitle: {
  fontWeight: "600",
  fontSize: "13px",
  color: "#f8fafc",
  overflowWrap: "anywhere",
},

incidentDesc: {
  color: "#cbd5e1",
  fontSize: "12px",
  lineHeight: 1.35,
  overflowWrap: "anywhere",
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
  fontSize: "12px",
  color: "#94a3b8",
  fontWeight: "600",
},

statValue: {
  marginTop: "4px",
  fontSize: "24px",
  color: "#f8fafc",
  fontWeight: "700",
  lineHeight: 1,
},

topSourceValue: {
  maxWidth: "100%",
  marginTop: "4px",
  color: "#f8fafc",
  fontSize: "22px",
  fontWeight: "700",
  lineHeight: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
},

topSourceMeta: {
  marginTop: "4px",
  color: "#94a3b8",
  fontSize: "11px",
},


};


