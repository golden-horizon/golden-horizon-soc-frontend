import { useEffect, useState } from "react";
import axios from "axios";

export default function Investigation() {
  const [activities, setActivities] = useState([]);
  const [ipFilter, setIpFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [selectedIP, setSelectedIP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
  loadActivity();
  loadIncidents();
}, []);

  const loadActivity = async () => {
    try {
      const token = localStorage.getItem("token");

      console.log("TOKEN:", token);

      const res = await axios.get(
        "http://localhost:5000/login-activity",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
        
      );

      console.log("LOGIN ACTIVITY RESPONSE:", res.data);

      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load login activity:", err);
      console.error("STATUS:", err.response?.status);
      console.error("DATA:", err.response?.data);
    } finally {
      setLoading(false);
    }
  };
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
    console.error("Failed to load related incidents:", err);
  }
};

  const filtered = activities.filter((item) => {
    const ipMatch =
      !ipFilter ||
      item.ip_address?.toLowerCase().includes(ipFilter.toLowerCase());

    const userMatch =
      !userFilter ||
      item.username?.toLowerCase().includes(userFilter.toLowerCase());

    return ipMatch && userMatch;
  });

  const uniqueIPs = [...new Set(activities.map((a) => a.ip_address))];
  const uniqueUsers = [...new Set(activities.map((a) => a.username))];

  const selectedActivities = selectedIP
    ? activities.filter((a) => a.ip_address === selectedIP)
    : [];

    const relatedIncidents = selectedIP
  ? incidents.filter((incident) =>
      incident.description
        ?.toLowerCase()
        .includes(selectedIP.toLowerCase())
    )
  : [];
   const attackTypes = [];

if (relatedIncidents.some((i) => i.title?.includes("Brute Force"))) {
  attackTypes.push("Brute Force");
}

if (relatedIncidents.some((i) => i.title?.includes("SQL Injection"))) {
  attackTypes.push("SQL Injection");
}

if (relatedIncidents.some((i) => i.title?.includes("XSS"))) {
  attackTypes.push("XSS");
}

if (relatedIncidents.some((i) => i.title?.includes("API Abuse"))) {
  attackTypes.push("API Abuse");
}

const correlationAlerts = relatedIncidents.filter((i) =>
  i.title?.includes("Multi-Vector")
);
  const selectedUsers = [
    ...new Set(selectedActivities.map((a) => a.username)),
  ];
  const getRiskLevel = (count) => {
  if (count >= 20) return "Critical";
  if (count >= 10) return "High";
  if (count >= 5) return "Medium";
  return "Low";
};

const riskLevel = getRiskLevel(selectedActivities.length)

  const firstSeen =
    selectedActivities.length > 0
      ? selectedActivities[selectedActivities.length - 1].attempt_time
      : null;

  const lastSeen =
    selectedActivities.length > 0
      ? selectedActivities[0].attempt_time
      : null;
  const attackTimeline = [...relatedIncidents].sort(
  (a, b) => new Date(a.created_at) - new Date(b.created_at)
);
  
  const criticalCount = relatedIncidents.filter(
  (i) => i.severity === "critical"
).length;

const highCount = relatedIncidents.filter(
  (i) => i.severity === "high"
).length;

//Threat Intelligence Panel
const getIPIntel = (ip) => {
  if (!ip) {
    return {
      type: "Unknown",
      classification: "No IP selected",
      risk: "Unknown",
      location: "Unknown",
    };
  }

  if (ip === "::1" || ip === "127.0.0.1") {
    return {
      type: "Localhost",
      classification: "Internal testing address",
      risk: "Low",
      location: "Local machine",
    };
  }

  if (
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.20.") ||
    ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") ||
    ip.startsWith("172.23.") ||
    ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") ||
    ip.startsWith("172.26.") ||
    ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") ||
    ip.startsWith("172.29.") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  ) {
    return {
      type: "Private Network",
      classification: "Internal network address",
      risk: "Low",
      location: "Private LAN",
    };
  }

  if (ip.startsWith("203.0.113.")) {
    return {
      type: "Reserved Test IP",
      classification: "Documentation/test address",
      risk: "Low",
      location: "Reserved example range",
    };
  }

  return {
    type: "Public IP",
    classification: "External source",
    risk: "High",
    location: "Unknown public location",
  };
};
const ipIntel = getIPIntel(selectedIP);

//MITRE ATT&CK Mapping

const mitreMappings = [];

if (attackTypes.includes("Brute Force")) {
  mitreMappings.push({
    technique: "T1110",
    name: "Brute Force",
  });
}

if (attackTypes.includes("SQL Injection")) {
  mitreMappings.push({
    technique: "T1190",
    name: "Exploit Public-Facing Application",
  });
}

if (attackTypes.includes("XSS")) {
  mitreMappings.push({
    technique: "T1059",
    name: "Command and Scripting Interpreter",
  });
}
if (attackTypes.includes("API Abuse")) {
  mitreMappings.push({
    technique: "T1190",
    name: "Exploit Public-Facing Application",
  });
}

//Connect GeoIP
const loadGeoIP = async (ip) => {
  try {
    const token = localStorage.getItem("token");

    const res = await axios.get(
      `http://localhost:5000/geoip/${ip}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setGeoData(res.data);
  } catch (err) {
    console.error("GeoIP lookup failed:", err);
  }
};

//Threat Reputation Scoring
let reputationScore = 0;

if (attackTypes.includes("Brute Force")) reputationScore += 20;
if (attackTypes.includes("SQL Injection")) reputationScore += 30;
if (attackTypes.includes("XSS")) reputationScore += 25;
if (attackTypes.includes("API Abuse")) reputationScore += 20;

if (
  relatedIncidents.some((i) =>
    i.title?.includes("Session Hijacking")
  )
) {
  reputationScore += 40;
}

if (correlationAlerts.length > 0) reputationScore += 25;
if (criticalCount > 0) reputationScore += criticalCount * 10;
if (highCount > 0) reputationScore += highCount * 5;

if (reputationScore > 100) reputationScore = 100;

const getReputationLevel = (score) => {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
};

const reputationLevel = getReputationLevel(reputationScore);

//Threat Recommendations.
const recommendations = [];

if (attackTypes.includes("Brute Force")) {
  recommendations.push(
    "Review failed login attempts and consider account lockout policies."
  );
}

if (attackTypes.includes("SQL Injection")) {
  recommendations.push(
    "Inspect application input validation and review database logs."
  );
}

if (attackTypes.includes("XSS")) {
  recommendations.push(
    "Review input sanitisation and output encoding controls."
  );
}

if (attackTypes.includes("API Abuse")) {
  recommendations.push(
    "Review API rate limiting and unusual request patterns."
  );
}

if (relatedIncidents.some((i) => i.title?.includes("Session Hijacking"))) {
  recommendations.push(
    "Invalidate active sessions and investigate token misuse."
  );
}

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Investigation Center</h1>

      <p style={styles.subtitle}>
        Review failed login activity, source IPs, targeted users, and
        suspicious authentication patterns.
      </p>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span>Total Failed Logins</span>
          <strong>{activities.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Unique IPs</span>
          <strong>{uniqueIPs.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Targeted Users</span>
          <strong>{uniqueUsers.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Latest Attempt</span>
          <strong>
            {activities[0]
              ? new Date(
                  activities[0].attempt_time
                ).toLocaleTimeString()
              : "N/A"}
          </strong>
        </div>
      </div>

      <div style={styles.filters}>
        <input
          style={styles.input}
          placeholder="Filter by IP"
          value={ipFilter}
          onChange={(e) => setIpFilter(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Filter by Username"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        />

        <button
          style={styles.clearBtn}
          onClick={() => {
            setIpFilter("");
            setUserFilter("");
            setSelectedIP(null);
             setGeoData(null);

          }}
        >
          Clear
        </button>
      </div>

      <div style={styles.mainGrid}>
        <div style={styles.tableBox}>
          <h3 style={styles.panelTitle}>
            Login Activity Timeline
          </h3>

          {loading ? (
            <p style={styles.loading}>
              Loading investigation data...
            </p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>IP Address</th>
                  <th style={styles.th}>Username</th>
                  <th style={styles.th}>Time</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      ...styles.tr,
                      background:
                        selectedIP === row.ip_address
                          ? "#1e3a8a"
                          : "transparent",
                    }}
                    onClick={() => {
                    const ip = row.ip_address;

                         setSelectedIP(ip);
                        loadGeoIP(ip);
                    }}
                  >
                    <td style={styles.td}>{row.id}</td>
                    <td style={styles.td}>
                      {row.ip_address}
                    </td>
                    <td style={styles.td}>
                      {row.username}
                    </td>
                    <td style={styles.td}>
                      {new Date(
                        row.attempt_time
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.sidePanel}>
          <h3 style={styles.panelTitle}>
            IP Investigation
          </h3>

          {selectedIP ? (
            <>
              <div style={styles.detailRow}>
                <span>Selected IP</span>
                <strong>{selectedIP}</strong>
              </div>

              <div style={styles.detailRow}>
                <span>Failed Attempts</span>
                <strong>
                  {selectedActivities.length}
                </strong>
              </div>

              <div style={styles.detailRow}>
                <span>Targeted Users</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
  {selectedUsers.map((user) => (
    <span
      key={user}
      style={{
        background: "#7f1d1d",
        color: "#fff",
        padding: "6px 10px",
        borderRadius: "999px",
        border: "1px solid #ef4444",
        fontSize: "14px",
        fontWeight: "bold",
      }}
    >
      {user}
    </span>
  ))}
</div>
              </div>

              <div style={styles.detailRow}>
                <span>First Seen</span>
                <strong>
                  {firstSeen
                    ? new Date(
                        firstSeen
                      ).toLocaleString()
                    : "N/A"}
                </strong>
              </div>

              <div style={styles.detailRow}>
                <span>Last Seen</span>
                <strong>
                  {lastSeen
                    ? new Date(
                        lastSeen
                      ).toLocaleString()
                    : "N/A"}
                </strong>
              </div>

              <div style={styles.riskBox}>
                <strong>Risk Assessment</strong>

                 <p>
    Risk Level: <strong>{riskLevel}</strong>
  </p>

  <p>
    This IP has {selectedActivities.length} failed login attempts.
    Review related incidents and confirm whether this activity matches
    a brute-force attack pattern.
  </p>
              </div>
    <div style={styles.relatedBox}>
  <strong>Related Incidents</strong>

  {relatedIncidents.length > 0 ? (
    relatedIncidents.map((incident) => (
      <div key={incident.id} style={styles.relatedItem}>
        <strong>{incident.title}</strong>
        <span>{incident.severity}</span>
        <small>{incident.status}</small>
      </div>


    ))
  ) : (
    <p>No related incidents found for this IP.</p>
  )}
</div>

      <div style={styles.attackTypesBox}>
  <strong>Correlation Alerts</strong>

  {correlationAlerts.length > 0 ? (
    <>
      {correlationAlerts.map((alert) => (
        <div key={alert.id} style={styles.relatedItem}>
          <strong>{alert.title}</strong>
          <span>{alert.severity}</span>
          <small>{alert.status}</small>
        </div>
      ))}

      <p style={{ marginTop: "12px" }}>
        Total Correlation Alerts:{" "}
        <strong>{correlationAlerts.length}</strong>
      </p>
    </>
  ) : (
    <p>No correlation alerts found.</p>
  )}
</div>

<div style={styles.attackTypesBox}>
  <strong>Attack Timeline</strong>

  {attackTimeline.length > 0 ? (
    attackTimeline.map((event) => (
      <div key={event.id} style={styles.timelineItem}>
        <strong>{event.title}</strong>

        <small>
          {new Date(event.created_at).toLocaleString()}
        </small>

        <span>{event.severity}</span>
      </div>
    ))
  ) : (
    <p>No timeline events available.</p>
  )}
</div>
     <div style={styles.attackTypesBox}>
  <strong>Attack Statistics</strong>

  <p>Failed Logins: {selectedActivities.length}</p>

  <p>Related Incidents: {relatedIncidents.length}</p>

  <p>Attack Types: {attackTypes.length}</p>

  <p>Critical Alerts: {criticalCount}</p>

  <p>High Alerts: {highCount}</p>
</div>
      <div style={styles.attackTypesBox}>
  <strong>Threat Intelligence</strong>

  <p>IP Address: {selectedIP}</p>

  <p>Type: {ipIntel.type}</p>

  <p>Classification: {ipIntel.classification}</p>

  <p>Risk: {ipIntel.risk}</p>

  <p>Location: {ipIntel.location}</p>

  {geoData && (
    <>
      <hr />

      <p>
        Country: <strong>{geoData.country}</strong>
      </p>

      <p>
        City: <strong>{geoData.city}</strong>
      </p>

      <p>
        ISP: <strong>{geoData.isp}</strong>
      </p>

      <p>
        Organization: <strong>{geoData.org}</strong>
      </p>
    </>
  )}
</div>

        <div style={styles.attackTypesBox}>
  <strong>Threat Reputation Score</strong>

  <p>
    Score: <strong>{reputationScore}/100</strong>
  </p>

  <p>
    Classification: <strong>{reputationLevel}</strong>
  </p>

  <p>
    Recommendation:{" "}
    <strong>
      {reputationLevel === "Critical"
        ? "Investigate Immediately"
        : reputationLevel === "High"
        ? "Prioritise Review"
        : reputationLevel === "Medium"
        ? "Monitor Activity"
        : "Low Priority"}
    </strong>
  </p>
</div>

<div style={styles.attackTypesBox}>
  <strong>Threat Recommendations</strong>

  {recommendations.length > 0 ? (
    recommendations.map((item, index) => (
      <div key={index} style={styles.recommendationItem}>
        {item}
      </div>
    ))
  ) : (
    <p>No recommendations available.</p>
  )}
</div>

       <div style={styles.attackTypesBox}>
  <strong>MITRE ATT&CK Mapping</strong>

  {mitreMappings.map((item, index) => (
  <div key={`${item.technique}-${index}`} style={styles.mitreItem}>
      <strong>{item.technique}</strong>
      <span>{item.name}</span>
    </div>
  ))}
</div>
            </>
          ) : (
            <p style={styles.emptyText}>
              Click an IP address from the table to
              investigate it.
            </p>
          )}
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
    padding: "25px",
  },

  title: {
    margin: 0,
    fontSize: "34px",
  },

  subtitle: {
    color: "#94a3b8",
    marginBottom: "25px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "15px",
    marginBottom: "25px",
  },

  statCard: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  filters: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  input: {
    background: "#020617",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px",
    minWidth: "220px",
  },

  clearBtn: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    cursor: "pointer",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "20px",
  },

  tableBox: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "18px",
    overflowX: "auto",
  },

  sidePanel: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "18px",
  },

  panelTitle: {
    marginTop: 0,
    marginBottom: "15px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: "1px solid #334155",
  },

  td: {
    padding: "10px",
    borderBottom: "1px solid #1e293b",
  },

  tr: {
    cursor: "pointer",
  },

  detailRow: {
    borderBottom: "1px solid #334155",
    padding: "12px 0",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  riskBox: {
    marginTop: "18px",
    background: "#7f1d1d",
    border: "1px solid #ef4444",
    borderRadius: "10px",
    padding: "14px",
  },

  emptyText: {
    color: "#94a3b8",
  },

  loading: {
    color: "#94a3b8",
  },
  relatedBox: {
  marginTop: "18px",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "10px",
  padding: "14px",
},

relatedItem: {
  marginTop: "10px",
  padding: "10px",
  borderRadius: "8px",
  background: "#111827",
  border: "1px solid #1e293b",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
},
attackTypesBox: {
  marginTop: "18px",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "10px",
  padding: "14px",
},

attackTypeItem: {
  marginTop: "10px",
  background: "#1e293b",
  color: "#f8fafc",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #475569",
  fontWeight: "bold",
},
timelineItem: {
  marginTop: "10px",
  padding: "10px",
  borderRadius: "8px",
  background: "#111827",
  border: "1px solid #1e293b",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
},
mitreItem: {
  marginTop: "10px",
  background: "#1e293b",
  color: "#f8fafc",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #475569",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
},
recommendationItem: {
  marginTop: "10px",
  padding: "10px",
  borderRadius: "8px",
  background: "#111827",
  border: "1px solid #334155",
},
};