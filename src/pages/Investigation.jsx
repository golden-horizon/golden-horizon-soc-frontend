import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import socket from "./socket";
import {
  getDisplayCountry,
  getPresentationIP,
} from "../utils/geoPresentation";

const API = "https://golden-horizon-soc-backend.onrender.com";

const normalise = (value) => (value || "").toString().toLowerCase();

const getSeverityStyle = (severity) => {
  const level = normalise(severity);

  if (level === "critical") return { borderColor: "#ef4444", color: "#fecaca" };
  if (level === "high") return { borderColor: "#f97316", color: "#fed7aa" };
  if (level === "medium") return { borderColor: "#eab308", color: "#fef08a" };
  if (level === "low") return { borderColor: "#22c55e", color: "#bbf7d0" };

  return { borderColor: "#64748b", color: "#cbd5e1" };
};

const getTypeStyle = (type) => {
  if (type === "Incident") return { borderColor: "#ef4444", color: "#fecaca" };
  if (type === "Security Event") return { borderColor: "#eab308", color: "#fef08a" };
  if (type === "Failed Login") return { borderColor: "#3b82f6", color: "#bfdbfe" };

  return { borderColor: "#64748b", color: "#cbd5e1" };
};

const getMitreTechnique = (item) => {
  const text = normalise(
    `${item.title || ""} ${item.description || ""} ${item.event_type || ""} ${
      item.category || ""
    } ${item.mitre_technique || ""}`
  );

  if (item.mitre_technique) return item.mitre_technique;
  if (text.includes("brute")) return "T1110";
  if (text.includes("sql") || text.includes("api abuse")) return "T1190";
  if (text.includes("xss")) return "T1059";
  if (text.includes("session hijack")) return "T1539";

  return "N/A";
};

const getMitreName = (technique) => {
  const names = {
    T1110: "Brute Force",
    T1190: "Exploit Public-Facing Application",
    T1059: "Command and Scripting Interpreter",
    T1539: "Steal Web Session Cookie",
  };

  return names[technique] || "Unmapped Technique";
};

const getMitreTactic = (technique) => {
  const tactics = {
    T1110: "Credential Access",
    T1190: "Initial Access",
    T1059: "Execution",
    T1539: "Credential Access",
  };

  return tactics[technique] || "Technique";
};

const getCountryFlag = (country) => {
  const countryCodes = {
    "north korea": "KP",
    russia: "RU",
    china: "CN",
    iran: "IR",
    "united states": "US",
  };
  const code = countryCodes[normalise(country)];

  if (!code) return "";

  return code
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
};

const getThreatClassification = (geoData, riskLevel) => {
  const country = normalise(geoData?.country);
  const isHighRiskCountry = highRiskCountries.includes(country);
  const isInternal =
    country === "localhost" ||
    country === "internal network" ||
    normalise(geoData?.isp) === "internal" ||
    normalise(geoData?.isp) === "internal host" ||
    normalise(geoData?.org).includes("development");

  if (isInternal) {
    return {
      classification: "Internal Lab Traffic",
      confidence: "Medium",
    };
  }

  return {
    classification: "External Threat",
    confidence: riskLevel === "Critical" || isHighRiskCountry ? "High" : "Medium",
  };
};

const getItemTime = (item) =>
  item.timestamp || item.created_at || item.attempt_time || item.time || null;

const formatDate = (value) => {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
};

const highRiskCountries = ["north korea", "russia", "iran", "china"];

const calculateLocalRisk = ({ incidents, securityEvents, failedLogins, geoData }) => {
  const criticalIncidents = incidents.filter(
    (item) => item.severity === "critical"
  ).length;
  const highIncidents = incidents.filter((item) => item.severity === "high").length;
  const criticalEvents = securityEvents.filter(
    (item) => item.severity === "critical"
  ).length;
  const highEvents = securityEvents.filter((item) => item.severity === "high").length;
  const eventCategories = new Set(
    securityEvents.map((item) => item.category || item.event_type).filter(Boolean)
  );
  const hasMultiVector = [...incidents, ...securityEvents].some((item) =>
    normalise(`${item.title || ""} ${item.description || ""} ${item.event_type || ""}`)
      .includes("multi-vector")
  );
  const country = normalise(geoData?.country);
  const isHighRiskCountry = highRiskCountries.includes(country);

  let riskScore =
    criticalIncidents * 18 +
    highIncidents * 10 +
    criticalEvents * 14 +
    highEvents * 8 +
    Math.min(failedLogins.length * 3, 24) +
    Math.max(eventCategories.size - 1, 0) * 10;

  if (hasMultiVector) riskScore += 25;
  if (isHighRiskCountry) riskScore += 20;
  if (isHighRiskCountry && (criticalIncidents > 0 || criticalEvents > 0)) {
    riskScore += 15;
  }
  if (incidents.length >= 10) riskScore += 20;
  if (securityEvents.length >= 5) riskScore += 10;

  riskScore = Math.min(Math.round(riskScore), 100);

  const riskLevel =
    riskScore >= 80
      ? "Critical"
      : riskScore >= 60
      ? "High"
      : riskScore >= 30
      ? "Medium"
      : "Low";

  const actions = [];

  if (riskScore >= 80) actions.push("Block IP or apply temporary deny rule.");
  if (criticalIncidents > 0 || criticalEvents > 0) {
    actions.push("Investigate critical incidents and confirm affected assets.");
  }
  if (securityEvents.some((item) => normalise(item.event_type).includes("sql"))) {
    actions.push("Review web logs and validate input filtering controls.");
  }
  if (failedLogins.length >= 5) {
    actions.push("Check affected accounts and failed authentication patterns.");
  }
  if (isHighRiskCountry) {
    actions.push(`Review geo-risk context for ${geoData.country}.`);
  }
  if (actions.length === 0) {
    actions.push("Monitor source activity and retain evidence for trend analysis.");
  }

  return {
    riskScore,
    riskLevel,
    recommendation: actions[0],
    actions,
  };
};

const getAttackStage = (item) => {
  const text = normalise(
    `${item.title || ""} ${item.description || ""} ${item.event_type || ""} ${
      item.category || ""
    }`
  );

  if (text.includes("recon")) return "Reconnaissance Activity";
  if (text.includes("brute") || text.includes("failed")) return "Credential Access";
  if (text.includes("sql")) return "SQL Injection";
  if (text.includes("xss")) return "Cross-Site Scripting";
  if (text.includes("api")) return "API Abuse";
  if (text.includes("session")) return "Session Hijacking";
  if (text.includes("multi-vector")) return "Multi-Vector Attack";

  return item.title || item.event_type || "Suspicious Activity";
};

export default function Investigation() {
  const [failedLogins, setFailedLogins] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedIP, setSelectedIP] = useState(null);
  const [ipInvestigation, setIpInvestigation] = useState(null);
  const [activeInvestigationTab, setActiveInvestigationTab] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [ipLoading, setIpLoading] = useState(false);
  const [geoData, setGeoData] = useState(null);
  const [criticalToast, setCriticalToast] = useState(null);
  const [criticalPulse, setCriticalPulse] = useState(false);
  const [filters, setFilters] = useState({
    ip: "",
    username: "",
    severity: "all",
    attack: "",
    mitre: "",
  });

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [loginRes, incidentRes, eventRes, summaryRes] = await Promise.allSettled([
        axios.get(`${API}/login-activity`, { headers: authHeaders() }),
        axios.get(`${API}/incidents`, { headers: authHeaders() }),
        axios.get(`${API}/security-events`, { headers: authHeaders() }),
        axios.get(`${API}/investigation/summary`, { headers: authHeaders() }),
      ]);

      const loginData =
        loginRes.status === "fulfilled" && Array.isArray(loginRes.value.data)
          ? loginRes.value.data
          : [];
      const incidentData =
        incidentRes.status === "fulfilled" && Array.isArray(incidentRes.value.data)
          ? incidentRes.value.data
          : [];
      const eventData =
        eventRes.status === "fulfilled" && Array.isArray(eventRes.value.data)
          ? eventRes.value.data
          : [];

      setFailedLogins(loginData);
      setIncidents(incidentData);
      setSecurityEvents(eventData);
      setSummary(
        summaryRes.status === "fulfilled"
          ? summaryRes.value.data
          : {
              totalIncidents: incidentData.length,
              securityEvents: eventData.length,
              failedLogins: loginData.length,
              uniqueSourceIPs: [
                ...new Set(
                  [
                    ...incidentData.map((item) => item.source_ip),
                    ...eventData.map((item) => item.source_ip),
                    ...loginData.map((item) => item.ip_address),
                  ]
                    .filter(Boolean)
                    .map(getPresentationIP)
                ),
              ].length,
              criticalAlerts:
                incidentData.filter((item) => item.severity === "critical").length +
                eventData.filter((item) => item.severity === "critical").length,
            }
      );
    } catch (err) {
      console.error("Failed to load investigation data:", err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const loadIPInvestigation = useCallback(
    async (ip) => {
      if (!ip) return;

      try {
        setSelectedIP(ip);
        setActiveInvestigationTab("summary");
        setIpLoading(true);
        setGeoData(null);

        const [investigationRes, geoRes] = await Promise.allSettled([
          axios.get(`${API}/investigation/ip/${encodeURIComponent(ip)}`, {
            headers: authHeaders(),
          }),
          axios.get(`${API}/geoip/${encodeURIComponent(ip)}`, {
            headers: authHeaders(),
          }),
        ]);

        if (investigationRes.status === "fulfilled") {
          setIpInvestigation(investigationRes.value.data);
        }

        if (geoRes.status === "fulfilled") {
          setGeoData(geoRes.value.data);
        }
      } catch (err) {
        console.error("Failed to load IP investigation:", err);
      } finally {
        setIpLoading(false);
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleCriticalIncident = (incident) => {
      if (normalise(incident?.severity) !== "critical") return;

      setCriticalToast(incident);
      setCriticalPulse(true);

      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gain.gain.setValueAtTime(0.04, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.35);
      } catch (err) {
        console.debug("Critical alert sound blocked:", err);
      }

      window.setTimeout(() => {
        setCriticalToast(null);
        setCriticalPulse(false);
      }, 5000);
    };

    socket.on("incident-created", handleCriticalIncident);

    return () => {
      socket.off("incident-created", handleCriticalIncident);
    };
  }, []);

  const timeline = useMemo(() => {
    const loginItems = failedLogins.map((item) => ({
      id: `login-${item.id}`,
      raw: item,
      type: "Failed Login",
      title: "Failed Login Attempt",
      severity: "medium",
      sourceIP: item.ip_address,
      username: item.username,
      timestamp: item.attempt_time,
      mitre: "T1110",
      description: `Failed authentication for ${item.username || "unknown user"}`,
    }));

    const incidentItems = incidents.map((item) => ({
      id: `incident-${item.id}`,
      raw: item,
      type: "Incident",
      title: item.title || "Incident",
      severity: item.severity || "low",
      sourceIP: item.source_ip,
      username: item.username,
      timestamp: item.created_at,
      mitre: getMitreTechnique(item),
      description: item.description,
    }));

    const eventItems = securityEvents.map((item) => ({
      id: `event-${item.id}`,
      raw: item,
      type: "Security Event",
      title: item.event_type || item.category || "Security Event",
      severity: item.severity || "low",
      sourceIP: item.source_ip,
      username: item.username,
      timestamp: item.created_at,
      mitre: getMitreTechnique(item),
      description: item.description || item.endpoint,
    }));

    return [...loginItems, ...incidentItems, ...eventItems].sort(
      (a, b) => new Date(getItemTime(b)) - new Date(getItemTime(a))
    );
  }, [failedLogins, incidents, securityEvents]);

  const filteredTimeline = useMemo(
    () =>
      timeline.filter((item) => {
        const ipMatch =
          !filters.ip || normalise(item.sourceIP).includes(normalise(filters.ip));
        const userMatch =
          !filters.username ||
          normalise(item.username).includes(normalise(filters.username));
        const severityMatch =
          filters.severity === "all" ||
          normalise(item.severity) === filters.severity;
        const attackMatch =
          !filters.attack ||
          normalise(`${item.title} ${item.description}`).includes(
            normalise(filters.attack)
          );
        const mitreMatch =
          !filters.mitre || normalise(item.mitre).includes(normalise(filters.mitre));

        return ipMatch && userMatch && severityMatch && attackMatch && mitreMatch;
      }),
    [filters, timeline]
  );

  const aggregatedTimeline = useMemo(() => {
    const groups = new Map();

    filteredTimeline.forEach((item) => {
      const key = [
        item.type,
        item.title,
        item.sourceIP || "no-ip",
        item.username || "no-user",
        item.mitre,
        item.severity,
      ].join("|");
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, { ...item, count: 1, children: [item] });
        return;
      }

      existing.count += 1;
      existing.children.push(item);

      if (new Date(item.timestamp) > new Date(existing.timestamp)) {
        existing.timestamp = item.timestamp;
        existing.raw = item.raw;
        existing.id = item.id;
      }
    });

    return [...groups.values()].sort(
      (a, b) => new Date(getItemTime(b)) - new Date(getItemTime(a))
    );
  }, [filteredTimeline]);

  const uniqueSourceIPs = useMemo(
    () => [
      ...new Set(
        timeline
          .map((item) => item.sourceIP)
          .filter(Boolean)
          .map(getPresentationIP)
      ),
    ],
    [timeline]
  );

  const criticalAlerts = useMemo(
    () => timeline.filter((item) => item.severity === "critical").length,
    [timeline]
  );

  const localIPDetails = useMemo(() => {
    if (!selectedIP) {
      return { incidents: [], securityEvents: [], failedLogins: [] };
    }

    return {
      incidents: incidents.filter(
        (item) =>
          item.source_ip === selectedIP ||
          normalise(item.description).includes(normalise(selectedIP))
      ),
      securityEvents: securityEvents.filter((item) => item.source_ip === selectedIP),
      failedLogins: failedLogins.filter((item) => item.ip_address === selectedIP),
    };
  }, [failedLogins, incidents, securityEvents, selectedIP]);

  const selectedDetails = useMemo(() => {
    const incidentsForIP = ipInvestigation?.incidents || localIPDetails.incidents;
    const eventsForIP = ipInvestigation?.securityEvents || localIPDetails.securityEvents;
    const loginsForIP = ipInvestigation?.failedLogins || localIPDetails.failedLogins;
    const localRisk = calculateLocalRisk({
      incidents: incidentsForIP,
      securityEvents: eventsForIP,
      failedLogins: loginsForIP,
      geoData,
    });

    return {
      ip: selectedIP,
      incidents: incidentsForIP,
      securityEvents: eventsForIP,
      failedLogins: loginsForIP,
      riskScore: Math.max(ipInvestigation?.riskScore || 0, localRisk.riskScore),
      riskLevel:
        localRisk.riskScore > (ipInvestigation?.riskScore || 0)
          ? localRisk.riskLevel
          : ipInvestigation?.riskLevel || localRisk.riskLevel,
      recommendation: localRisk.recommendation,
      actions: localRisk.actions,
    };
  }, [geoData, ipInvestigation, localIPDetails, selectedIP]);

  const relatedMitre = useMemo(() => {
    const items = [
      ...(selectedDetails.incidents || []),
      ...(selectedDetails.securityEvents || []),
      ...(selectedDetails.failedLogins || []),
    ];

    return [
      ...new Map(
        items.map((item) => {
          const technique = getMitreTechnique(item);
          return [
            technique,
            {
              technique,
              tactic: getMitreTactic(technique),
              name: getMitreName(technique),
            },
          ];
        })
      ).values(),
    ].filter((item) => item.technique !== "N/A");
  }, [selectedDetails]);

  const threatClassification = useMemo(
    () => getThreatClassification(geoData, selectedDetails.riskLevel),
    [geoData, selectedDetails.riskLevel]
  );

  const attackChain = useMemo(() => {
    const items = [
      ...(selectedDetails.failedLogins || []).map((item) => ({
        ...item,
        title: "Failed Login Attempt",
      })),
      ...(selectedDetails.securityEvents || []),
      ...(selectedDetails.incidents || []),
    ].sort((a, b) => new Date(getItemTime(a)) - new Date(getItemTime(b)));
    const seen = new Set();

    return items
      .map((item) => getAttackStage(item))
      .filter((stage) => {
        if (seen.has(stage)) return false;
        seen.add(stage);
        return true;
      })
      .slice(0, 5);
  }, [selectedDetails]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      ip: "",
      username: "",
      severity: "all",
      attack: "",
      mitre: "",
    });
  };

  return (
    <div style={styles.page}>
      <p style={styles.subtitle}>
        Correlate failed logins, incidents, security events, source IPs, and
        MITRE mappings in one analyst investigation view.
      </p>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Incidents</span>
          <strong style={styles.statValue}>
            {summary?.totalIncidents ?? incidents.length}
          </strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Security Events</span>
          <strong style={styles.statValue}>
            {summary?.securityEvents ?? securityEvents.length}
          </strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Failed Logins</span>
          <strong style={styles.statValue}>
            {summary?.failedLogins ?? failedLogins.length}
          </strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Unique Source IPs</span>
          <strong style={styles.statValue}>
            {summary?.uniqueSourceIPs ?? uniqueSourceIPs.length}
          </strong>
        </div>

        <div
          className={criticalPulse ? "critical-finding-pulse" : ""}
          style={{ ...styles.statCard, ...styles.criticalFindingCard }}
        >
          <span style={styles.statLabel}>Critical Findings</span>
          <strong style={styles.statValue}>
            {summary?.criticalAlerts ?? criticalAlerts}
          </strong>
        </div>
      </div>

      {criticalToast && (
        <div style={styles.criticalToast}>
          <strong>New Critical Alert</strong>
          <span>{criticalToast.title || "Critical incident created"}</span>
        </div>
      )}

      <div style={styles.filters}>
        <input
          style={styles.input}
          placeholder="IP address"
          value={filters.ip}
          onChange={(e) => updateFilter("ip", e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Username"
          value={filters.username}
          onChange={(e) => updateFilter("username", e.target.value)}
        />

        <select
          style={styles.input}
          value={filters.severity}
          onChange={(e) => updateFilter("severity", e.target.value)}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <input
          style={styles.input}
          placeholder="Attack type / title"
          value={filters.attack}
          onChange={(e) => updateFilter("attack", e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="MITRE technique"
          value={filters.mitre}
          onChange={(e) => updateFilter("mitre", e.target.value)}
        />

        <button style={styles.clearBtn} onClick={clearFilters}>
          Clear
        </button>
      </div>

      <div className="investigation-main-grid" style={styles.mainGrid}>
        <div style={styles.timelinePanel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Investigation Timeline</h3>
            <span style={styles.panelMeta}>
              {filteredTimeline.length} events / {aggregatedTimeline.length} groups
            </span>
          </div>

          {loading ? (
            <p style={styles.emptyText}>Loading investigation data...</p>
          ) : aggregatedTimeline.length === 0 ? (
            <p style={styles.emptyText}>No timeline items match the filters.</p>
          ) : (
            <div style={styles.timelineList}>
              {aggregatedTimeline.map((item) => (
                <button
                  key={`${item.id}-${item.count}`}
                  type="button"
                  style={{
                    ...styles.timelineItem,
                    borderColor:
                      selectedIP === item.sourceIP ? "#3b82f6" : "#263244",
                    background:
                      selectedIP === item.sourceIP ? "#0f1a33" : "#111827",
                  }}
                  onClick={() => item.sourceIP && loadIPInvestigation(item.sourceIP)}
                >
                  <span
                    style={{
                      ...styles.timelineDot,
                      borderColor: getTypeStyle(item.type).borderColor,
                      boxShadow: `0 0 9px ${getTypeStyle(item.type).borderColor}`,
                    }}
                  />

                  <div style={styles.timelineContent}>
                    <div style={styles.timelineTop}>
                      <span style={{ ...styles.typeLabel, ...getTypeStyle(item.type) }}>
                        {item.type}
                      </span>
                      <span style={styles.timeText}>{formatDate(item.timestamp)}</span>
                    </div>

                    <div style={styles.timelineTitle}>
                      {item.title}
                      {item.count > 1 && (
                        <span style={styles.countBadge}>{item.count} events</span>
                      )}
                    </div>

                    <div style={styles.timelineMeta}>
                      <span>IP: {getPresentationIP(item.sourceIP) || "N/A"}</span>
                      <span>User: {item.username || "N/A"}</span>
                      <span>MITRE: {item.mitre}</span>
                      <span
                        style={{
                        ...styles.severityRingLabel,
                        ...getSeverityStyle(item.severity),
                        ...(normalise(item.severity) === "critical"
                          ? styles.criticalSeverityGlow
                          : {}),
                      }}
                      >
                        <span
                          style={{
                            ...styles.severityRing,
                            borderColor: getSeverityStyle(item.severity).borderColor,
                          }}
                        />
                        {item.severity}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={styles.sidePanel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>IP Investigation</h3>
            {selectedIP ? (
              <button
                type="button"
                style={styles.investigateBtn}
                onClick={() => setActiveInvestigationTab("activity")}
              >
                Investigate Selected
              </button>
            ) : (
              ipLoading && <span style={styles.panelMeta}>Loading...</span>
            )}
          </div>

          {selectedIP ? (
            <>
              <div style={styles.tabList}>
                {[
                  ["summary", "Summary"],
                  ["risk", "Risk"],
                  ["geo", "GeoIP"],
                  ["mitre", "MITRE"],
                  ["activity", "Activity"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    style={{
                      ...styles.tabButton,
                      ...(activeInvestigationTab === id ? styles.tabButtonActive : {}),
                    }}
                    onClick={() => setActiveInvestigationTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeInvestigationTab === "summary" && (
                <div style={styles.sectionBox}>
                  <strong style={styles.sectionTitle}>Summary</strong>
                  <div style={styles.detailGrid}>
                    <div style={styles.detailRow}>
                      <span>Source IP</span>
                      <strong>{getPresentationIP(selectedIP)}</strong>
                    </div>

                    <div style={styles.detailRow}>
                      <span>Failed Logins</span>
                      <strong>{selectedDetails.failedLogins?.length || 0}</strong>
                    </div>

                    <div style={styles.detailRow}>
                      <span>Related Incidents</span>
                      <strong>{selectedDetails.incidents?.length || 0}</strong>
                    </div>

                    <div style={styles.detailRow}>
                      <span>Security Events</span>
                      <strong>{selectedDetails.securityEvents?.length || 0}</strong>
                    </div>
                  </div>

                  <div style={styles.classificationBox}>
                    <strong style={styles.sectionTitle}>Threat Classification</strong>
                    <div style={styles.compactRows}>
                      <span>
                        Country: {getCountryFlag(geoData?.country)}{" "}
                        {getDisplayCountry(geoData?.country)}
                      </span>
                      <span>
                        Classification: {threatClassification.classification}
                      </span>
                      <span>Confidence: {threatClassification.confidence}</span>
                    </div>
                  </div>

                  {attackChain.length > 0 && (
                    <div style={styles.attackChainBox}>
                      <strong style={styles.sectionTitle}>Attack Chain</strong>
                      <div style={styles.attackChain}>
                        {attackChain.map((stage, index) => (
                          <div key={stage} style={styles.attackChainItem}>
                            <span style={styles.chainDot}>{index + 1}</span>
                            <span>{stage}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeInvestigationTab === "risk" && (
                <div
                  style={{
                    ...styles.riskBox,
                    borderColor: getSeverityStyle(selectedDetails.riskLevel).borderColor,
                  }}
                >
                  <div style={styles.riskHeader}>
                    <span>Risk Score</span>
                    <strong>{selectedDetails.riskScore}/100</strong>
                  </div>
                  <div style={styles.scoreBar}>
                    <div
                      style={{
                        ...styles.scoreFill,
                        width: `${selectedDetails.riskScore || 0}%`,
                        background: getSeverityStyle(selectedDetails.riskLevel).borderColor,
                      }}
                      className="risk-score-fill"
                    />
                  </div>
                  <strong style={getSeverityStyle(selectedDetails.riskLevel)}>
                    {selectedDetails.riskLevel} Risk
                  </strong>
                  <p style={styles.recommendationText}>
                    {selectedDetails.recommendation}
                  </p>
                  <div style={styles.actionList}>
                    <strong>Recommended Action</strong>
                    {(selectedDetails.actions || []).map((action) => (
                      <span key={action}>- {action}</span>
                    ))}
                  </div>
                </div>
              )}

              {activeInvestigationTab === "geo" && (
                <div style={styles.sectionBox}>
                  <strong style={styles.sectionTitle}>GeoIP Intelligence</strong>
                  {geoData ? (
                    <div style={styles.compactRows}>
                      <span>
                        Country: {getCountryFlag(geoData.country)}{" "}
                        {getDisplayCountry(geoData.country)}
                      </span>
                      <span>City: {geoData.city}</span>
                      <span>ISP: {geoData.isp}</span>
                      <span>Org: {geoData.org}</span>
                    </div>
                  ) : (
                    <p style={styles.emptyText}>GeoIP data unavailable.</p>
                  )}
                </div>
              )}

              {activeInvestigationTab === "mitre" && (
                <div style={styles.sectionBox}>
                  <strong style={styles.sectionTitle}>MITRE Technique Mapping</strong>
                  {relatedMitre.length > 0 ? (
                    relatedMitre.map((item) => (
                      <div key={item.technique} style={styles.mitreItem}>
                        <span style={styles.mitreTactic}>{item.tactic}</span>
                        <strong>{item.technique}</strong>
                        <span>{item.name}</span>
                      </div>
                    ))
                  ) : (
                    <p style={styles.emptyText}>No MITRE techniques mapped.</p>
                  )}
                </div>
              )}

              {activeInvestigationTab === "activity" && (
                <div style={styles.sectionBox}>
                  <strong style={styles.sectionTitle}>Related Activity</strong>
                  {(selectedDetails.incidents || []).slice(0, 5).map((incident) => (
                    <div key={`incident-${incident.id}`} style={styles.relatedItem}>
                      <span style={styles.relatedTitle}>{incident.title}</span>
                      <div style={styles.badgeRow}>
                        <span
                          style={{
                            ...styles.activityBadge,
                            borderColor: getTypeStyle("Incident").borderColor,
                            color: getTypeStyle("Incident").color,
                          }}
                        >
                          INCIDENT
                        </span>
                        <span
                          style={{
                            ...styles.activityBadge,
                            borderColor: getSeverityStyle(incident.severity).borderColor,
                            color: getSeverityStyle(incident.severity).color,
                          }}
                        >
                          {incident.severity || "LOW"}
                        </span>
                        <span style={styles.statusBadge}>
                          {incident.status || "open"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {(selectedDetails.securityEvents || []).slice(0, 5).map((event) => (
                    <div key={`event-${event.id}`} style={styles.relatedItem}>
                      <span style={styles.relatedTitle}>
                        {event.event_type || event.category}
                      </span>
                      <div style={styles.badgeRow}>
                        <span
                          style={{
                            ...styles.activityBadge,
                            borderColor: getTypeStyle("Security Event").borderColor,
                            color: getTypeStyle("Security Event").color,
                          }}
                        >
                          SECURITY EVENT
                        </span>
                        <span
                          style={{
                            ...styles.activityBadge,
                            borderColor: getSeverityStyle(event.severity).borderColor,
                            color: getSeverityStyle(event.severity).color,
                          }}
                        >
                          {event.severity || "LOW"}
                        </span>
                        <span style={styles.statusBadge}>
                          {formatDate(event.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {(selectedDetails.incidents || []).length === 0 &&
                    (selectedDetails.securityEvents || []).length === 0 && (
                      <p style={styles.emptyText}>No related activity.</p>
                    )}
                </div>
              )}
            </>
          ) : (
            <p style={styles.emptyText}>
              Select any timeline row with a source IP to open the investigation
              panel.
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
    padding: "10px",
  },

  subtitle: {
    color: "#94a3b8",
    margin: "0 0 12px",
    fontSize: "13px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },

  statCard: {
    background: "#111827",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "10px 12px",
    minHeight: "62px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  criticalFindingCard: {
    borderLeft: "4px solid #ef4444",
    boxShadow: "0 0 10px rgba(239,68,68,.14)",
  },

  statLabel: {
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "600",
  },

  statValue: {
    marginTop: "4px",
    fontSize: "23px",
    lineHeight: 1,
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "8px",
    marginBottom: "12px",
  },

  input: {
    background: "#020617",
    color: "#e5e7eb",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 10px",
    fontSize: "12px",
    minWidth: 0,
  },

  clearBtn: {
    background: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.65fr) minmax(340px, 0.9fr)",
    gap: "12px",
    alignItems: "start",
  },

  timelinePanel: {
    background: "#111827",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "10px",
    minWidth: 0,
  },

  sidePanel: {
    background: "#111827",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "10px",
    minWidth: 0,
  },

  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
  },

  panelTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "700",
  },

  panelMeta: {
    color: "#94a3b8",
    fontSize: "11px",
  },

  tabList: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "6px",
    marginBottom: "10px",
  },

  tabButton: {
    background: "#020617",
    color: "#94a3b8",
    border: "1px solid #263244",
    borderRadius: "6px",
    padding: "7px 6px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "700",
  },

  tabButtonActive: {
    color: "#f8fafc",
    borderColor: "#3b82f6",
    background: "#0f1a33",
    boxShadow: "0 0 8px rgba(59,130,246,.5)",
  },

  investigateBtn: {
    background: "#1e293b",
    color: "#bfdbfe",
    border: "1px solid #3b82f6",
    borderRadius: "6px",
    padding: "6px 9px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "700",
  },

  timelineList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  timelineItem: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "16px 1fr",
    gap: "8px",
    textAlign: "left",
    color: "#f8fafc",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "9px",
    cursor: "pointer",
  },

  timelineDot: {
    width: "13px",
    height: "13px",
    borderRadius: "50%",
    border: "3px solid",
    marginTop: "3px",
  },

  timelineContent: {
    minWidth: 0,
  },

  timelineTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "4px",
  },

  typeLabel: {
    color: "#38bdf8",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  timeText: {
    color: "#94a3b8",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  timelineTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    fontSize: "13px",
    fontWeight: "700",
    overflowWrap: "anywhere",
  },

  countBadge: {
    color: "#bfdbfe",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "2px 7px",
    fontSize: "10px",
    fontWeight: "700",
  },

  timelineMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "6px",
    color: "#cbd5e1",
    fontSize: "11px",
  },

  severityRingLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    border: "1px solid currentColor",
    borderRadius: "999px",
    padding: "2px 7px",
    textTransform: "capitalize",
    fontWeight: "700",
  },

  criticalSeverityGlow: {
    boxShadow: "0 0 8px rgba(239,68,68,.3)",
    background: "rgba(239,68,68,.08)",
  },

  severityRing: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    border: "2px solid",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },

  detailRow: {
    background: "#020617",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },

  riskBox: {
    marginTop: "10px",
    background: "#020617",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "10px",
  },

  riskHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    fontSize: "12px",
  },

  scoreBar: {
    height: "8px",
    background: "#1e293b",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "8px",
  },

  scoreFill: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 700ms ease",
  },

  recommendationText: {
    color: "#cbd5e1",
    fontSize: "12px",
    lineHeight: 1.4,
    margin: "8px 0 0",
  },

  actionList: {
    display: "grid",
    gap: "5px",
    marginTop: "10px",
    color: "#cbd5e1",
    fontSize: "11px",
    lineHeight: 1.35,
  },

  sectionBox: {
    marginTop: "10px",
    background: "#020617",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "10px",
  },

  sectionTitle: {
    display: "block",
    marginBottom: "8px",
    fontSize: "12px",
  },

  compactRows: {
    display: "grid",
    gap: "4px",
    color: "#cbd5e1",
    fontSize: "11px",
  },

  classificationBox: {
    marginTop: "10px",
    paddingTop: "10px",
    borderTop: "1px solid #1e293b",
  },

  attackChainBox: {
    marginTop: "10px",
    paddingTop: "10px",
    borderTop: "1px solid #1e293b",
  },

  attackChain: {
    display: "grid",
    gap: "7px",
  },

  attackChainItem: {
    display: "grid",
    gridTemplateColumns: "22px 1fr",
    alignItems: "center",
    gap: "8px",
    color: "#cbd5e1",
    fontSize: "11px",
  },

  chainDot: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "1px solid #3b82f6",
    color: "#bfdbfe",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: "700",
  },

  relatedItem: {
    borderTop: "1px solid #1e293b",
    padding: "7px 0",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },

  relatedTitle: {
    fontSize: "12px",
    fontWeight: "700",
    overflowWrap: "anywhere",
  },

  relatedMeta: {
    color: "#94a3b8",
    fontSize: "11px",
    textTransform: "capitalize",
  },

  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "5px",
    marginTop: "3px",
  },

  activityBadge: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "2px 6px",
    fontSize: "10px",
    fontWeight: "700",
    lineHeight: 1.2,
    textTransform: "uppercase",
  },

  statusBadge: {
    border: "1px solid #334155",
    borderRadius: "999px",
    color: "#bfdbfe",
    background: "#1e293b",
    padding: "2px 6px",
    fontSize: "10px",
    fontWeight: "700",
    lineHeight: 1.2,
    textTransform: "uppercase",
  },

  criticalToast: {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxWidth: "320px",
    background: "#111827",
    border: "1px solid #ef4444",
    borderLeft: "4px solid #ef4444",
    borderRadius: "8px",
    color: "#f8fafc",
    padding: "10px 12px",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    fontSize: "12px",
  },

  mitreItem: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    borderTop: "1px solid #1e293b",
    padding: "7px 0",
    color: "#cbd5e1",
    fontSize: "11px",
  },

  mitreTactic: {
    color: "#38bdf8",
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  emptyText: {
    color: "#94a3b8",
    fontSize: "12px",
    margin: 0,
  },
};


