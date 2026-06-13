import { useEffect, useState } from "react";
import axios from "axios";

export default function SecurityEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
   const [selectedEvent, setSelectedEvent] = useState(null);
   
const [search, setSearch] = useState("");
const [severityFilter, setSeverityFilter] = useState("all");
   const attackSummary = {
  total: events.length,
  sqlInjection: events.filter((e) => e.event_type === "sql_injection_attempt").length,
  xss: events.filter((e) => e.event_type === "xss_attempt").length,
  bruteForce: events.filter((e) => e.event_type === "brute_force_attempt").length,
};

const filteredEvents = events.filter((event) => {
  const searchMatch =
    event.event_type?.toLowerCase().includes(search.toLowerCase()) ||
    event.source_ip?.toLowerCase().includes(search.toLowerCase()) ||
    event.category?.toLowerCase().includes(search.toLowerCase()) ||
    event.mitre_technique?.toLowerCase().includes(search.toLowerCase());

  const severityMatch =
    severityFilter === "all" ||
    event.severity?.toLowerCase() === severityFilter;

  return searchMatch && severityMatch;
});
  const loadEvents = async () => {
    try {
      const res = await axios.get("http://localhost:5000/security-events");
      setEvents(res.data || []);
    } catch (err) {
      console.error("Failed to load security events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  if (loading) {
    return <div style={styles.page}>Loading security events...</div>;
  }

 return (
  <div style={styles.page}>
    <h2 style={styles.title}>Security Events</h2>
    <div style={styles.summaryGrid}>
  <div style={styles.summaryCard}>Total Events: {attackSummary.total}</div>
  <div style={styles.summaryCard}>SQL Injection: {attackSummary.sqlInjection}</div>
  <div style={styles.summaryCard}>XSS: {attackSummary.xss}</div>
  <div style={styles.summaryCard}>Brute Force: {attackSummary.bruteForce}</div>
</div>
<div style={styles.filters}>
  <input
    type="text"
    placeholder="Search IP, attack type, category, MITRE..."
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
          <span>Event Type</span>
          <span>Severity</span>
          <span>Source IP</span>
          <span>Category</span>
          <span>Technique</span>
        </div>
{filteredEvents.map((event) => (
          <div
            key={event.id}
            style={{
              ...styles.row,
             
      background:
        selectedEvent?.id === event.id
          ? "#1e293b"
          : "#111827",

      borderLeft:
        selectedEvent?.id === event.id
          ? "4px solid #3b82f6"
          : "4px solid transparent",
            }}
            onClick={() => setSelectedEvent(event)}
          >
            <span>{new Date(event.created_at).toLocaleString()}</span>
            <span>{event.event_type}</span>
            <span style={getSeverityStyle(event.severity)}>
              {event.severity}
            </span>
            <span>{event.source_ip || "N/A"}</span>
            <span>{event.category || "N/A"}</span>
            <span>{event.mitre_technique || "N/A"}</span>
          </div>
        ))}
      </div>

      <div style={styles.detailsPanel}>
        {!selectedEvent ? (
          <p style={styles.emptyDetails}>Select an event to view details</p>
        ) : (
          <>
            <h3 style={styles.detailsTitle}>Event Details</h3>

            <div style={styles.detailItem}>
              <span>ID</span>
              <strong>{selectedEvent.id}</strong>
            </div>

            <div style={styles.detailItem}>
              <span>Type</span>
              <strong>{selectedEvent.event_type}</strong>
            </div>

            <div style={styles.detailItem}>
              <span>Severity</span>
              <strong style={getSeverityStyle(selectedEvent.severity)}>
                {selectedEvent.severity}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span>Source IP</span>
              <strong>{selectedEvent.source_ip}</strong>
            </div>

            <div style={styles.detailItem}>
              <span>Endpoint</span>
              <strong>{selectedEvent.endpoint}</strong>
            </div>

            <div style={styles.detailItem}>
              <span>Method</span>
              <strong>{selectedEvent.http_method}</strong>
            </div>

            <div style={styles.detailBlock}>
              <span>Payload</span>
              <pre>{selectedEvent.payload || "N/A"}</pre>
            </div>

            <div style={styles.detailItem}>
              <span>Category</span>
              <strong>{selectedEvent.category}</strong>
            </div>

            <div style={styles.detailItem}>
              <span>MITRE Technique</span>
              <strong>{selectedEvent.mitre_technique}</strong>
            </div>

            <div style={styles.detailBlock}>
              <span>Description</span>
              <p>{selectedEvent.description}</p>
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

const getSeverityStyle = (severity) => {
  const s = (severity || "").toLowerCase();

  if (s === "critical") return { color: "#ef4444", fontWeight: "bold" };
  if (s === "high") return { color: "#f97316", fontWeight: "bold" };
  if (s === "medium") return { color: "#eab308", fontWeight: "bold" };
  if (s === "low") return { color: "#22c55e", fontWeight: "bold" };

  return { color: "#e5e7eb" };
};

const styles = {
 page: {
  minHeight: "100vh",
  background: "#030712",
  color: "#f9fafb",
  padding: "25px",
},
  title: {
    marginBottom: "20px",
  },

  table: {
  border: "1px solid #1e293b",
  borderRadius: "10px",
  overflow: "hidden",
  background: "#0b1120",
},

  header: {
    display: "grid",
   gridTemplateColumns: "1.6fr 1.8fr 0.8fr 0.9fr 1.4fr 1.8fr",
    background: "#020617",
    color: "#94a3b8",
    padding: "12px",
    fontWeight: "bold",
    fontSize: "13px",
    textTransform: "uppercase",
  },

  row: {
  display: "grid",
  gridTemplateColumns: "1.6fr 1.8fr 0.8fr 0.9fr 1.4fr 1.8fr",
  padding: "12px",
  borderTop: "1px solid #1e293b",
  background: "#111827",
  fontSize: "14px",
  cursor: "pointer",
  transition: "0.2s",
},
  layout: {
  display: "grid",
  gridTemplateColumns: "3fr 1fr",
  gap: "20px",
  alignItems: "start",
},

detailsPanel: {
  background: "#0b1120",
  border: "1px solid #1e293b",
  borderRadius: "10px",
  padding: "14px",
  color: "#fff",
  position: "sticky",
  top: "20px",
  maxHeight: "85vh",
  overflowY: "auto",
  fontSize: "13px",
},

detailsTitle: {
  marginTop: 0,
  marginBottom: "15px",
},

emptyDetails: {
  color: "#94a3b8",
  textAlign: "center",
},

detailItem: {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid #1e293b",
},

detailBlock: {
  padding: "10px 0",
  borderBottom: "1px solid #1e293b",
},
summaryGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "18px",
},

summaryCard: {
  background: "#0b1120",
  border: "1px solid #1e293b",
  borderRadius: "10px",
  padding: "14px",
  color: "#f9fafb",
  fontWeight: "bold",
  fontSize: "14px",
},
filters: {
  display: "flex",
  gap: "12px",
  marginBottom: "18px",
},

searchInput: {
  flex: 1,
  background: "#0b1120",
  color: "#f9fafb",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  padding: "10px",
},

select: {
  background: "#0b1120",
  color: "#f9fafb",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  padding: "10px",
},
};