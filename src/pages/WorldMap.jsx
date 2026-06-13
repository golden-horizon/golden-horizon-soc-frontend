import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import socket from "./socket";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapFlyTo({ selectedMarker }) {
  const map = useMap();

  useEffect(() => {
    if (selectedMarker?.latitude && selectedMarker?.longitude) {
      map.flyTo(
        [selectedMarker.latitude, selectedMarker.longitude],
        5,
        { duration: 1.2 }
      );
    }
  }, [selectedMarker, map]);

  return null;
}
const createThreatIcon = (severity) => {
  const color =
    severity === "critical"
      ? "#dc2626"
      : severity === "high"
      ? "#f97316"
      : severity === "medium"
      ? "#eab308"
      : "#22c55e";

  return L.divIcon({
    className: "",
    html: `
      <div class="threat-dot" style="
        width: 18px;
        height: 18px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 14px ${color};
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};
export default function WorldMap() {
  const [incidents, setIncidents] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);

  const SOC_LOCATION = [-33.8688, 151.2093];

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");

    return {
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const upsertMarker = useCallback((geoLocation) => {
    if (!geoLocation) return;

    const markerIP = geoLocation.ip || geoLocation.query;

    setMarkers((prev) => {
      const existingIndex = prev.findIndex(
        (marker) => (marker.ip || marker.query) === markerIP
      );

      if (existingIndex === -1) {
        return [geoLocation, ...prev];
      }

      return prev.map((marker, index) =>
        index === existingIndex ? { ...marker, ...geoLocation } : marker
      );
    });
  }, []);

  const loadMarkerForIP = useCallback(
    async (ip, { focus = false } = {}) => {
      if (!ip) return null;

      try {
        const response = await axios.get(`http://localhost:5000/geoip/${ip}`, {
          headers: getAuthHeaders(),
        });

        const geoLocation = response.data;

        upsertMarker(geoLocation);

        if (focus) {
          setSelectedMarker(geoLocation);
        }

        return geoLocation;
      } catch (err) {
        console.error(`Failed to load GeoIP marker for ${ip}:`, err);
        return null;
      }
    },
    [getAuthHeaders, upsertMarker]
  );

  const loadIncidents = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/incidents", {
        headers: getAuthHeaders(),
      });

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.incidents)
        ? res.data.incidents
        : [];

      setIncidents(data);
      console.log("WORLD MAP INCIDENTS:", data);
      console.table(data.map((i) => ({
  title: i.title,
  source_ip: i.source_ip,
})));
    } catch (err) {
      console.error("Failed to load world map incidents:", err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadIncidents();

    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", () => {
      console.log("🌍 World Map Socket Connected");
    });

    socket.on("incident-created", (newIncident) => {
      setIncidents((prev) => {
        const exists = prev.some(
          (i) => (i.id || i.incident_id) === (newIncident.id || newIncident.incident_id)
        );

        if (exists) return prev;

        return [newIncident, ...prev];
      });

      if (newIncident.source_ip) {
        loadMarkerForIP(newIncident.source_ip, { focus: true });
      }
    });

    return () => {
      socket.off("incident-created");
      socket.off("connect");
    };
  }, [loadIncidents, loadMarkerForIP]);

  const uniqueIPs = useMemo(
    () => [
      ...new Set(
        incidents
          .map((incident) => incident.source_ip)
          .filter(Boolean)
      ),
    ],
    [incidents]
  );

  const loadMarkers = useCallback(async (ips) => {
    try {
      await Promise.all(ips.map((ip) => loadMarkerForIP(ip)));
    } catch (err) {
      console.error("Failed to load GeoIP markers:", err);
    }
  }, [loadMarkerForIP]);

  useEffect(() => {
    if (uniqueIPs.length > 0) {
      loadMarkers(uniqueIPs);
    }
  }, [loadMarkers, uniqueIPs]);

  const getSeverityColor = (severity) => {
    const s = (severity || "").toLowerCase();

    if (s === "critical") return "#dc2626";
    if (s === "high") return "#ea580c";
    if (s === "medium") return "#eab308";
    return "#22c55e";
  };

  const getIPIncidents = (ip) => {
    return incidents.filter((i) => i.source_ip === ip);
  };

  const getMarkerIncidents = (marker) => {
    const ip = marker.ip || marker.query;
    return getIPIncidents(ip);
  };

  const getMarkerHighestSeverity = (marker) => {
    const related = getMarkerIncidents(marker);

    if (related.some((i) => (i.severity || "").toLowerCase() === "critical")) {
      return "critical";
    }

    if (related.some((i) => (i.severity || "").toLowerCase() === "high")) {
      return "high";
    }

    if (related.some((i) => (i.severity || "").toLowerCase() === "medium")) {
      return "medium";
    }

    return "low";
  };

  const validMarkers = markers.filter((marker) => {
    const latitude = Number(marker.latitude);
    const longitude = Number(marker.longitude);

    return Number.isFinite(latitude) && Number.isFinite(longitude);
  });
  console.log("VALID MARKERS:", validMarkers);

  const countryStats = markers.reduce((acc, marker) => {
    const country = marker.country || "Unknown";
    const incidentCount = getMarkerIncidents(marker).length;

    acc[country] = (acc[country] || 0) + incidentCount;
    return acc;
  }, {});

  const sortedCountries = Object.entries(countryStats).sort(
    (a, b) => b[1] - a[1]
  );
  const topCountries = sortedCountries.slice(0, 4);
  const topCountryCount = topCountries[0]?.[1] || 1;

  const criticalCount = incidents.filter(
    (i) => (i.severity || "").toLowerCase() === "critical"
  ).length;

  const highCount = incidents.filter(
    (i) => (i.severity || "").toLowerCase() === "high"
  ).length;

  const totalSources = uniqueIPs.length;
  const countriesAffected = Object.keys(countryStats).length;

  const mostActiveSource =
    uniqueIPs.length > 0
      ? uniqueIPs
          .map((ip) => ({
            ip,
            count: getIPIncidents(ip).length,
          }))
          .sort((a, b) => b.count - a.count)[0]
      : null;

  const highestRisk = criticalCount > 0
    ? "Critical"
    : highCount > 0
    ? "High"
    : "Low";

  const latestAttacks = [...incidents]
    .sort(
      (a, b) =>
        new Date(b.created_at || b.createdAt) -
        new Date(a.created_at || a.createdAt)
    )
    .slice(0, 6);

  const formatDate = (date) => {
    if (!date) return "No timestamp";
    return new Date(date).toLocaleString();
  };

  return (
  <div style={styles.page}>
  <p style={styles.subtitle}>
    Live global attack visualization with GeoIP intelligence and attack paths
  </p>

  <div style={styles.summaryGrid}>
    <div style={styles.summaryCard}>
      <p style={styles.summaryLabel}>Attack Sources</p>
      <h3 style={styles.summaryValue}>{totalSources}</h3>
    </div>

    <div style={styles.summaryCard}>
      <p style={styles.summaryLabel}>Countries</p>
      <h3 style={styles.summaryValue}>{countriesAffected}</h3>
    </div>

    <div style={styles.summaryCard}>
      <p style={styles.summaryLabel}>Critical Events</p>
      <h3 style={styles.summaryValue}>{criticalCount}</h3>
    </div>

    <div
      style={{
        ...styles.summaryCard,
        border: "1px solid #ef4444",
        boxShadow: "0 0 12px rgba(239,68,68,0.25)",
      }}
    >
      <p style={styles.summaryLabel}>Threat Level</p>
      <h3 style={{ ...styles.summaryValue, color: "#ef4444" }}>
        {highestRisk}
      </h3>
    </div>
  </div>

      <div style={styles.mapBox}>
       <MapContainer
  center={[20, 0]}
  zoom={2}
  style={{
    height: "100%",
    width: "100%",
  }}
>
  <MapFlyTo selectedMarker={selectedMarker} />

  <TileLayer
    attribution="CartoDB"
    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
  />

  {/* Attack Paths */}
  {validMarkers.map((marker, index) => {
    const severity = getMarkerHighestSeverity(marker);

    return (
      <Polyline
        key={`line-${index}`}
        positions={[
          [
            Number(marker.latitude),
            Number(marker.longitude),
          ],
          SOC_LOCATION,
        ]}
        pathOptions={{
          color: getSeverityColor(severity),
          weight: severity === "critical" ? 4 : 3,
          dashArray: "10 12",
          className: "attack-line",
        }}
      />
    );
  })}

  {/* SOC Marker */}
  <Marker position={SOC_LOCATION}>
    <Popup>
      <strong>SOC Monitoring Center</strong>
      <br />
      Sydney, Australia
    </Popup>
  </Marker>

  {/* Threat Markers */}
  {validMarkers.map((marker, index) => {
    const relatedIncidents = getMarkerIncidents(marker);
    const severity = getMarkerHighestSeverity(marker);

    const attackTypes = [
      ...new Set(
        relatedIncidents
          .map((i) => i.title)
          .filter(Boolean)
      ),
    ];

    return (
      <Marker
        key={`${marker.ip || marker.query || "ip"}-${index}`}
        position={[
          Number(marker.latitude),
          Number(marker.longitude),
        ]}
        icon={createThreatIcon(severity)}
        eventHandlers={{
          click: () => {
            setSelectedMarker(marker);
          },
        }}
      >
        <Popup>
          <strong>{marker.ip || marker.query}</strong>

          <br />
          Country: {marker.country || "Unknown"}

          <br />
          City: {marker.city || "Unknown"}

          <br />
          ISP: {marker.isp || "Unknown"}

          <br />
          Risk:
          <span
            style={{
              color: getSeverityColor(severity),
              fontWeight: "bold",
            }}
          >
            {" "}
            {severity.toUpperCase()}
          </span>

          <br />
          Incident Count: {relatedIncidents.length}

          <br />
          Attack Types:

          <ul>
            {attackTypes.slice(0, 4).map((type) => (
              <li key={type}>{type}</li>
            ))}
          </ul>
        </Popup>
      </Marker>
    );
  })}
</MapContainer>
      </div>

      <div style={styles.twoColumnGrid}>
        <div style={styles.panel}>
          <h3>Live Attack Feed</h3>

          {latestAttacks.length > 0 ? (
            latestAttacks.map((incident) => (
              <div
                key={incident.id || incident.incident_id}
                style={styles.feedItem}
              >
                <div>
                  <strong>{incident.title}</strong>
                  <p>{formatDate(incident.created_at || incident.createdAt)}</p>
                </div>

                <span
                  style={{
                    ...styles.badge,
                    background: getSeverityColor(incident.severity),
                  }}
                >
                  {incident.severity || "low"}
                </span>
              </div>
            ))
          ) : (
            <p>No recent attacks found.</p>
          )}
        </div>

        <div style={styles.panel}>
          <h3>Most Active Source</h3>

          {mostActiveSource ? (
            <>
              <p>
                IP Address: <strong>{mostActiveSource.ip}</strong>
              </p>
              <p>
                Incident Count: <strong>{mostActiveSource.count}</strong>
              </p>
              <p>
                Recommendation:{" "}
                <strong>Review related incidents and consider containment.</strong>
              </p>
            </>
          ) : (
            <p>No active source available.</p>
          )}
        </div>
      </div>

      {selectedMarker && (
        <div style={styles.panel}>
          <h3>Attack Origin Intelligence</h3>

          <p>
            IP Address:{" "}
            <strong>{selectedMarker.ip || selectedMarker.query || "::1"}</strong>
          </p>

          <p>
            Country: <strong>{selectedMarker.country || "Unknown"}</strong>
          </p>

          <p>
            City: <strong>{selectedMarker.city || "Unknown"}</strong>
          </p>

          <p>
            ISP: <strong>{selectedMarker.isp || "Unknown"}</strong>
          </p>

          <p>
            Organization: <strong>{selectedMarker.org || "Unknown"}</strong>
          </p>

          <p>
            Risk: <strong>{selectedMarker.risk || "Low"}</strong>
          </p>

          <hr />

          <p>
            Reputation: <strong>{selectedMarker.reputation || "Clean"}</strong>
          </p>

          <p>
            Abuse Score: <strong>{selectedMarker.abuseScore ?? 0}</strong>
          </p>

          <p>
            TOR: <strong>{selectedMarker.isTor ? "Yes" : "No"}</strong>
          </p>

          <p>
            VPN: <strong>{selectedMarker.isVpn ? "Yes" : "No"}</strong>
          </p>

          <p>
            Recommendation:{" "}
            <strong>
              {selectedMarker.recommendation ||
                "Internal lab traffic. No external risk."}
            </strong>
          </p>
        </div>
      )}

      <div style={styles.twoColumnGrid}>
        <div style={styles.panel}>
          <h3>Observed Source IPs</h3>

          {uniqueIPs.length > 0 ? (
            uniqueIPs.map((ip) => {
              const marker = markers.find(
                (m) => m.ip === ip || m.query === ip
              );

              return (
                <div
                  key={ip}
                  style={{
                    ...styles.ipItem,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    if (marker) {
                      setSelectedMarker(marker);
                    }
                  }}
                >
                  {ip}
                </div>
              );
            })
          ) : (
            <p>No source IPs found.</p>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.countryStatsHeader}>
            <div>
              <h3 style={styles.panelTitle}>Top Attacking Countries</h3>
              <p style={styles.panelSubtitle}>
                Ranked by incident volume from GeoIP sources
              </p>
            </div>

            <span style={styles.countryTotalBadge}>
              {countriesAffected} countries
            </span>
          </div>

          {topCountries.length > 0 ? (
            <div style={styles.countryList}>
              {topCountries.map(([country, count], index) => (
                <div key={country} style={styles.countryItem}>
                  <span style={styles.countryRank}>{index + 1}</span>

                  <div style={styles.countryMeta}>
                    <div style={styles.countryRow}>
                      <strong style={styles.countryName}>{country}</strong>
                      <span style={styles.countryCount}>
                        {count} {count === 1 ? "incident" : "incidents"}
                      </span>
                    </div>

                    <div style={styles.countryShareBar}>
                      <div
                        style={{
                          ...styles.countryShareFill,
                          width: `${Math.max((count / topCountryCount) * 100, 8)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>No country statistics available.</p>
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
   
  fontSize: "26px",
  fontWeight: "700",

  },

  subtitle: {
    color: "#94a3b8",
    marginBottom: "20px",
  },

  summaryGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "16px",
  marginBottom: "20px",
},

 summaryCard: {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "12px",
  textAlign: "center",
  boxShadow: "0 0 12px rgba(59,130,246,0.12)",

  display: "flex",
  flexDirection: "column",
  justifyContent: "center",

  minHeight: "90px",
},
  mapBox: {
    background: "#020617",
    border: "1px solid #334155",
    borderRadius: "16px",
    height: "650px",
    overflow: "hidden",
    marginBottom: "20px",
  },
  summaryLabel: {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "15px",
  fontWeight: "500",
},

summaryValue: {
  fontSize: "30px",
  margin: "10px 0 0",
  fontWeight: "700",
  color: "#f8fafc",
},

  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
    marginBottom: "20px",
  },

  panel: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "18px",
    marginBottom: "20px",
  },

  panelTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
  },

  panelSubtitle: {
    margin: "6px 0 0",
    color: "#94a3b8",
    fontSize: "13px",
  },

  countryStatsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },

  countryTotalBadge: {
    flexShrink: 0,
    color: "#bae6fd",
    background: "rgba(14, 165, 233, 0.12)",
    border: "1px solid rgba(56, 189, 248, 0.35)",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: "700",
  },

  countryList: {
    display: "grid",
    gap: "10px",
  },

  countryItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "11px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
  },

  countryRank: {
    width: "30px",
    height: "30px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "#0f172a",
    background: "#38bdf8",
    borderRadius: "50%",
    fontSize: "14px",
    fontWeight: "800",
  },

  countryMeta: {
    flex: 1,
    minWidth: 0,
  },

  countryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },

  countryName: {
    color: "#f8fafc",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  countryCount: {
    flexShrink: 0,
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: "600",
  },

  countryShareBar: {
    height: "6px",
    background: "#0f172a",
    borderRadius: "999px",
    overflow: "hidden",
  },

  countryShareFill: {
    height: "100%",
    background: "#22c55e",
    borderRadius: "999px",
  },

  emptyText: {
    color: "#94a3b8",
    margin: 0,
  },

  feedItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "10px",
    background: "#1e293b",
    borderRadius: "10px",
    border: "1px solid #334155",
    marginTop: "10px",
  },

  badge: {
    color: "#fff",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  ipItem: {
    marginTop: "10px",
    padding: "10px",
    background: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #475569",
  },
};
