import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const normalise = (value) => (value || "").toString().toLowerCase();

const categoryColors = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
];

const getEventStatus = (event) => {
  const severity = normalise(event.severity);

  if (severity === "critical") return "Escalated";
  if (severity === "high") return "Investigating";
  if (severity === "medium") return "New";
  if (severity === "low") return "Closed";
  if (event.status) return event.status;

  return "New";
};

const getEventSource = (event) => {
  const text = normalise(
    `${event.event_type} ${event.category} ${event.endpoint} ${event.description}`
  );

  if (text.includes("sql") || text.includes("injection")) {
    return "Web Application";
  }

  if (text.includes("xss")) {
    return "Web Application";
  }

  if (text.includes("api")) return "API Gateway";

  if (
    text.includes("brute") ||
    text.includes("login") ||
    text.includes("auth")
  ) {
    return "Authentication Service";
  }

  if (
    text.includes("multi-vector") ||
    text.includes("correlation") ||
    text.includes("session")
  ) {
    return "Correlation Engine";
  }

  return "Web Application";
};

const getRecommendedActions = (event) => {
  const text = normalise(
    `${event.event_type} ${event.category} ${event.description} ${event.mitre_technique}`
  );

  if (text.includes("sql") || text.includes("injection")) {
    return ["Review web logs", "Block source IP", "Validate WAF rules"];
  }

  if (text.includes("xss")) {
    return [
      "Review affected endpoint",
      "Validate output encoding",
      "Inspect payload handling",
    ];
  }

  if (text.includes("brute") || text.includes("login")) {
    return [
      "Review failed login activity",
      "Lock or reset targeted accounts",
      "Apply rate limiting",
    ];
  }

  if (text.includes("api")) {
    return [
      "Review API gateway logs",
      "Validate rate limits",
      "Check token abuse patterns",
    ];
  }

  return [
    "Review event context",
    "Correlate source IP activity",
    "Escalate if activity continues",
  ];
};

const getMitreTechniqueDisplay = (event) => {
  const text = normalise(
    `${event.event_type} ${event.category} ${event.description} ${event.mitre_technique}`
  );

  if (text.includes("api abuse")) {
    return "T1190 - Exploit Public-Facing Application";
  }

  if (
    event.mitre_technique &&
    normalise(event.mitre_technique) !== "api abuse"
  ) {
    return event.mitre_technique;
  }

  if (text.includes("sql") || text.includes("injection")) {
    return "T1190 - Exploit Public-Facing Application";
  }

  if (text.includes("brute") || text.includes("login")) {
    return "T1110 - Brute Force";
  }

  if (text.includes("xss")) {
    return "T1059 - Command and Scripting Interpreter";
  }

  return "N/A";
};

const getSeverityStyle = (severity) => {
  const s = normalise(severity);

  if (s === "critical") {
    return {
      ...styles.severityBadge,
      borderColor: "#ef4444",
      color: "#fecaca",
      boxShadow: "0 0 8px rgba(239, 68, 68, 0.35)",
    };
  }

  if (s === "high") {
    return {
      ...styles.severityBadge,
      borderColor: "#f97316",
      color: "#fed7aa",
    };
  }

  if (s === "medium") {
    return {
      ...styles.severityBadge,
      borderColor: "#eab308",
      color: "#fef08a",
    };
  }

  if (s === "low") {
    return {
      ...styles.severityBadge,
      borderColor: "#22c55e",
      color: "#bbf7d0",
    };
  }

  return {
    ...styles.severityBadge,
    borderColor: "#64748b",
    color: "#cbd5e1",
  };
};

const getStatusStyle = (status) => {
  const s = normalise(status);

  if (s === "escalated") {
    return {
      ...styles.statusBadge,
      borderColor: "#ef4444",
      color: "#fecaca",
    };
  }

  if (s === "investigating") {
    return {
      ...styles.statusBadge,
      borderColor: "#3b82f6",
      color: "#bfdbfe",
    };
  }

  if (s === "closed") {
    return {
      ...styles.statusBadge,
      borderColor: "#22c55e",
      color: "#bbf7d0",
    };
  }

  return {
    ...styles.statusBadge,
    borderColor: "#94a3b8",
    color: "#e2e8f0",
  };
};

const getRowStyle = (event, selectedEvent) => {
  const severity = normalise(event.severity);

  if (selectedEvent?.id === event.id) {
    return {
      ...styles.row,
      background: "#1e293b",
      borderLeft: "4px solid #3b82f6",
    };
  }

  if (severity === "critical") {
    return {
      ...styles.row,
      borderLeft: "4px solid #ef4444",
      boxShadow: "inset 0 0 14px rgba(239, 68, 68, 0.15)",
    };
  }

  if (severity === "high") {
    return {
      ...styles.row,
      borderLeft: "4px solid #f97316",
    };
  }

  return styles.row;
};

export default function SecurityEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const severitySummary = useMemo(
    () => ({
      total: events.length,
      critical: events.filter((e) => normalise(e.severity) === "critical")
        .length,
      high: events.filter((e) => normalise(e.severity) === "high").length,
      medium: events.filter((e) => normalise(e.severity) === "medium").length,
    }),
    [events]
  );

  const categoryData = useMemo(() => {
    const counts = events.reduce((acc, event) => {
      const name = event.category || event.event_type || "Uncategorized";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  const filteredEvents = events.filter((event) => {
    const eventStatus = getEventStatus(event);
    const eventSource = getEventSource(event);
    const searchValue = normalise(search);

    const searchMatch =
      String(event.id).includes(searchValue) ||
      normalise(event.event_type).includes(searchValue) ||
      normalise(event.source_ip).includes(searchValue) ||
      normalise(event.category).includes(searchValue) ||
      normalise(event.mitre_technique).includes(searchValue) ||
      normalise(getMitreTechniqueDisplay(event)).includes(searchValue) ||
      normalise(eventStatus).includes(searchValue) ||
      normalise(eventSource).includes(searchValue);

    const severityMatch =
      severityFilter === "all" ||
      normalise(event.severity) === severityFilter;

    return searchMatch && severityMatch;
  });

  useEffect(() => {
    let isMounted = true;

    const loadEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/security-events");

        if (isMounted) {
          setEvents(res.data || []);
        }
      } catch (err) {
        console.error("Failed to load security events:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div style={styles.page}>Loading security events...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.summaryGrid}>
        <div className="soc-kpi-card" style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total Events</span>
          <strong style={styles.summaryValue}>{severitySummary.total}</strong>
        </div>

        <div
          className="soc-kpi-card"
          style={{ ...styles.summaryCard, borderLeft: "3px solid #ef4444" }}
        >
          <span style={styles.summaryLabel}>Critical</span>
          <strong style={styles.summaryValue}>{severitySummary.critical}</strong>
        </div>

        <div
          className="soc-kpi-card"
          style={{ ...styles.summaryCard, borderLeft: "3px solid #f97316" }}
        >
          <span style={styles.summaryLabel}>High</span>
          <strong style={styles.summaryValue}>{severitySummary.high}</strong>
        </div>

        <div
          className="soc-kpi-card"
          style={{ ...styles.summaryCard, borderLeft: "3px solid #eab308" }}
        >
          <span style={styles.summaryLabel}>Medium</span>
          <strong style={styles.summaryValue}>{severitySummary.medium}</strong>
        </div>
      </div>

      <div style={styles.chartPanel}>
        <div style={styles.chartHeader}>
          <h3 style={styles.panelTitle}>Event Count by Category</h3>
          <span style={styles.panelMeta}>
            {categoryData.length} active categories
          </span>
        </div>

        <div style={styles.chartGrid}>
          <div style={styles.chartBox}>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    innerRadius={46}
                    outerRadius={72}
                    label={false}
                  >
                    {categoryData.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={categoryColors[index % categoryColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={styles.tooltip}
                    itemStyle={{ color: "#e5e7eb" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={styles.emptyChart}>No event categories found.</div>
            )}
          </div>

          <div style={styles.legendList}>
            {categoryData.slice(0, 6).map((item, index) => (
              <div key={item.name} style={styles.legendItem}>
                <span
                  style={{
                    ...styles.legendDot,
                    borderColor:
                      categoryColors[index % categoryColors.length],
                  }}
                />
                <span style={styles.legendText}>{item.name}</span>
                <strong style={styles.legendValue}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Search Event ID, IP, attack type, category, MITRE, source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div style={styles.layout}>
        <div style={styles.table}>
          <div style={styles.header}>
            <span>Time</span>
            <span>Event ID</span>
            <span>Source</span>
            <span>Event Type</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Source IP</span>
            <span>Category</span>
            <span>Technique</span>
          </div>

          {filteredEvents.map((event) => {
            const status = getEventStatus(event);
            const source = getEventSource(event);

            return (
              <div
                key={event.id}
                style={getRowStyle(event, selectedEvent)}
                onClick={() => setSelectedEvent(event)}
              >
                <span>{new Date(event.created_at).toLocaleString()}</span>
                <span>#{event.id}</span>
                <span>{source}</span>
                <span style={styles.wrapText}>{event.event_type}</span>
                <span style={getSeverityStyle(event.severity)}>
                  {event.severity || "Unknown"}
                </span>
                <span style={getStatusStyle(status)}>{status}</span>
                <span>{event.source_ip || "N/A"}</span>
                <span style={styles.wrapText}>{event.category || "N/A"}</span>
                <span style={styles.wrapText}>
                  {getMitreTechniqueDisplay(event)}
                </span>
              </div>
            );
          })}
        </div>

        <div style={styles.detailsPanel}>
          {!selectedEvent ? (
            <p style={styles.emptyDetails}>Select an event to view details</p>
          ) : (
            <>
              <h3 style={styles.detailsTitle}>Event Details</h3>

              <div style={styles.detailItem}>
                <span>ID</span>
                <strong>#{selectedEvent.id}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>Type</span>
                <strong>{selectedEvent.event_type}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>Source</span>
                <strong>{getEventSource(selectedEvent)}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>Status</span>
                <strong style={getStatusStyle(getEventStatus(selectedEvent))}>
                  {getEventStatus(selectedEvent)}
                </strong>
              </div>

              <div style={styles.detailItem}>
                <span>Severity</span>
                <strong style={getSeverityStyle(selectedEvent.severity)}>
                  {selectedEvent.severity || "Unknown"}
                </strong>
              </div>

              <div style={styles.detailItem}>
                <span>Source IP</span>
                <strong>{selectedEvent.source_ip || "N/A"}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>Endpoint</span>
                <strong>{selectedEvent.endpoint || "N/A"}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>Method</span>
                <strong>{selectedEvent.http_method || "N/A"}</strong>
              </div>

              <div style={styles.detailBlock}>
                <span>Payload</span>
                <pre>{selectedEvent.payload || "N/A"}</pre>
              </div>

              <div style={styles.detailItem}>
                <span>Category</span>
                <strong>{selectedEvent.category || "N/A"}</strong>
              </div>

              <div style={styles.detailItem}>
                <span>MITRE Technique</span>
                <strong>{getMitreTechniqueDisplay(selectedEvent)}</strong>
              </div>

              <div style={styles.detailBlock}>
                <span>Recommended Action</span>
                <ul style={styles.actionList}>
                  {getRecommendedActions(selectedEvent).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>

              <div style={styles.detailBlock}>
                <span>Description</span>
                <p>{selectedEvent.description || "N/A"}</p>
              </div>

              <div style={styles.detailBlock}>
                <span>User Agent</span>
                <p>{selectedEvent.user_agent || "N/A"}</p>
              </div>

              <div style={styles.detailItem}>
                <span>Time</span>
                <strong>
                  {new Date(selectedEvent.created_at).toLocaleString()}
                </strong>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#030712",
    color: "#f9fafb",
    padding: "16px",
  },
  title: {
    margin: "0 0 18px",
    fontSize: "30px",
    lineHeight: 1.1,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  summaryCard: {
    background: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px",
    color: "#f9fafb",
    minHeight: "78px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    transition: "background 0.18s ease, border-color 0.18s ease",
  },
  summaryLabel: {
    color: "#93a4bd",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    marginBottom: "8px",
  },
  summaryValue: {
    color: "#ffffff",
    fontSize: "27px",
    lineHeight: 1,
  },
  chartPanel: {
    background: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "14px",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.2,
  },
  panelMeta: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    gap: "12px",
    alignItems: "center",
  },
  chartBox: {
    minHeight: "170px",
  },
  emptyChart: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "170px",
    color: "#94a3b8",
    fontSize: "13px",
  },
  legendList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "8px",
  },
  legendItem: {
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "8px",
    background: "#111827",
    border: "1px solid #243247",
    borderRadius: "7px",
    padding: "8px 10px",
    fontSize: "12px",
  },
  legendDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    border: "2px solid",
    background: "transparent",
  },
  legendText: {
    color: "#dbeafe",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  legendValue: {
    color: "#ffffff",
  },
  filters: {
    display: "flex",
    gap: "10px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  searchInput: {
    flex: "1 1 360px",
    background: "#0b1120",
    color: "#f9fafb",
    border: "1px solid #1e293b",
    borderRadius: "7px",
    padding: "9px 10px",
    fontSize: "13px",
  },
  select: {
    flex: "0 0 180px",
    background: "#0b1120",
    color: "#f9fafb",
    border: "1px solid #1e293b",
    borderRadius: "7px",
    padding: "9px 10px",
    fontSize: "13px",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(300px, 1fr)",
    gap: "14px",
    alignItems: "start",
  },
  table: {
    border: "1px solid #1e293b",
    borderRadius: "8px",
    overflowX: "auto",
    overflowY: "hidden",
    background: "#0b1120",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.7fr 1.25fr 1.35fr 0.9fr 1fr 1fr 1.25fr 1.35fr",
    minWidth: "1080px",
    background: "#020617",
    color: "#94a3b8",
    padding: "9px",
    fontWeight: 700,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    gap: "9px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.7fr 1.25fr 1.35fr 0.9fr 1fr 1fr 1.25fr 1.35fr",
    minWidth: "1080px",
    padding: "9px",
    borderTop: "1px solid #1e293b",
    borderLeft: "4px solid transparent",
    background: "#111827",
    fontSize: "12px",
    cursor: "pointer",
    transition: "background 0.18s ease, border-color 0.18s ease",
    gap: "9px",
    alignItems: "center",
  },
  wrapText: {
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  severityBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    border: "1px solid",
    borderRadius: "999px",
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    border: "1px solid",
    borderRadius: "999px",
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  detailsPanel: {
    background: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px",
    color: "#fff",
    position: "sticky",
    top: "20px",
    maxHeight: "85vh",
    overflowY: "auto",
    fontSize: "12px",
  },
  detailsTitle: {
    margin: "0 0 12px",
    fontSize: "18px",
  },
  emptyDetails: {
    color: "#94a3b8",
    textAlign: "center",
  },
  detailItem: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #1e293b",
  },
  detailBlock: {
    padding: "8px 0",
    borderBottom: "1px solid #1e293b",
  },
  actionList: {
    margin: "8px 0 0",
    paddingLeft: "18px",
    color: "#dbeafe",
    lineHeight: 1.7,
  },
  tooltip: {
    background: "#020617",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e5e7eb",
    fontSize: "12px",
  },
};
