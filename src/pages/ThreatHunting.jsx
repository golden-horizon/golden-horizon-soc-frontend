import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  getGeoIPLookupIP,
  getPresentationIP,
  isExternalCountry,
  isGeoIPVisualizationIP,
} from "../utils/geoPresentation";

export default function ThreatHunting() {
  const [incidents, setIncidents] = useState([]);
  const [countryByIP, setCountryByIP] = useState({});
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const navigate = useNavigate();

  const getSeverityColor = (value) => {
    const severityValue = (value || "").toLowerCase();

    if (severityValue === "critical") return "#dc2626";
    if (severityValue === "high") return "#f97316";
    if (severityValue === "medium") return "#eab308";
    return "#22c55e";
  };

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
    } catch (err) {
      console.error("Failed to load threat hunting data:", err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadIncidents();
  }, [loadIncidents]);

  const filtered = useMemo(
    () =>
      incidents.filter((item) => {
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
      }),
    [incidents, search, severity]
  );

  const huntResults = useMemo(() => {
    const seen = new Set();

    return filtered.filter((incident) => {
      const key = [
        incident.title,
        incident.description,
        incident.source_ip,
        incident.severity,
        incident.status,
      ]
        .map((value) => value || "")
        .join("|")
        .toLowerCase();

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filtered]);

  useEffect(() => {
    const loadCountryData = async () => {
      const sourceIPs = [
        ...new Set(
          huntResults
            .map((i) => i.source_ip)
            .filter(isGeoIPVisualizationIP)
            .map(getGeoIPLookupIP)
        ),
      ];

      if (sourceIPs.length === 0) {
        setCountryByIP({});
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

        const nextCountryByIP = geoResults.reduce((acc, geo) => {
          const ip = geo.ip || geo.query;
          if (ip) acc[getPresentationIP(ip)] = geo.country || "Unknown";
          return acc;
        }, {});

        setCountryByIP(nextCountryByIP);
      } catch (err) {
        console.error("Failed to load hunt country data:", err);
      }
    };

    loadCountryData();
  }, [getAuthHeaders, huntResults]);

  const timeline = [...huntResults].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const uniqueAttackSources = new Set(
    huntResults
      .map((incident) => incident.source_ip)
      .filter(isGeoIPVisualizationIP)
      .map(getPresentationIP)
  ).size;

  const countryCount = new Set(
    huntResults
      .map((incident) => countryByIP[getPresentationIP(incident.source_ip)])
      .filter(isExternalCountry)
  ).size;

  return (
    <div style={styles.page}>
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

      <div style={styles.huntResults}>
        <div style={styles.huntMetric}>
          <strong>{huntResults.length}</strong>
          <span>Matches Found</span>
        </div>

        <div style={styles.huntMetric}>
          <strong>{uniqueAttackSources}</strong>
          <span>Unique Attack Sources</span>
        </div>

        <div style={styles.huntMetric}>
          <strong>{countryCount}</strong>
          <span>Countries</span>
        </div>
      </div>

      <div style={styles.timelineBox}>
        <h3 style={styles.panelTitle}>Threat Hunting Timeline</h3>

        <div style={styles.timelineList}>
          {timeline.map((item) => (
            <div key={item.id || item.incident_id} style={styles.timelineEntry}>
              <span
                style={{
                  ...styles.timelineDot,
                  background: getSeverityColor(item.severity),
                  boxShadow: `0 0 10px ${getSeverityColor(item.severity)}`,
                }}
              />

              <div style={styles.timelineContent}>
                <div style={styles.timelineHeader}>
                  <strong>{item.title}</strong>
                  <span
                    style={{
                      ...styles.severityBadge,
                      background: getSeverityColor(item.severity),
                    }}
                  >
                    {item.severity || "low"}
                  </span>
                </div>

                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.results}>
        {huntResults.length > 0 ? (
          huntResults.map((incident) => (
            <div key={incident.id} style={styles.card}>
              <h3>{incident.title}</h3>
              <p>{incident.description}</p>
              <p>
                <strong>Source IP:</strong>{" "}
                {getPresentationIP(incident.source_ip) || "N/A"}
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
    padding: "14px",
  },

  title: {
    fontSize: "20px",
    marginBottom: "8px",
  },

  subtitle: {
    color: "#94a3b8",
    marginBottom: "14px",
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "10px",
    marginBottom: "12px",
  },

  input: {
    background: "#020617",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "8px",
    fontSize: "12px",
  },

  select: {
    background: "#020617",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "8px",
    fontSize: "12px",
  },

  huntResults: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginBottom: "14px",
  },

  huntMetric: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#cbd5e1",
    fontSize: "12px",
  },

  results: {
    display: "grid",
    gap: "10px",
  },

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "10px",
    fontSize: "12px",
  },
  statsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "10px",
  marginBottom: "14px",
},

statCard: {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "10px",
  textAlign: "center",
},
timelineBox: {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "14px",
},

panelTitle: {
  margin: "0 0 10px",
  fontSize: "15px",
},

timelineList: {
  position: "relative",
  display: "grid",
  gap: "0",
  marginLeft: "5px",
  paddingLeft: 0,
  borderLeft: "1px solid #334155",
},

timelineEntry: {
  position: "relative",
  display: "flex",
  gap: "12px",
  padding: "0 0 14px 14px",
},

timelineDot: {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  flexShrink: 0,
  marginTop: "5px",
  position: "absolute",
  left: "-5px",
  zIndex: 1,
},

timelineContent: {
  minWidth: 0,
  flex: 1,
  paddingBottom: "10px",
  borderBottom: "1px solid #1e293b",
  color: "#cbd5e1",
  fontSize: "12px",
},

timelineHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  color: "#f8fafc",
  marginBottom: "4px",
},

severityBadge: {
  color: "#fff",
  padding: "4px 7px",
  borderRadius: "999px",
  fontSize: "10px",
  fontWeight: "800",
  textTransform: "uppercase",
  flexShrink: 0,
},
investigateBtn: {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  marginTop: "10px",
},
};
