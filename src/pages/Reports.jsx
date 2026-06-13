import { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";

export default function Reports() {
  const [incidents, setIncidents] = useState([]);
//helper page

  useEffect(() => {
    loadIncidents();
  }, []);

  //// LOAD DATA ...
const total = incidents.length;

const open = incidents.filter(
  (i) => i.status === "open"
).length;

const critical = incidents.filter(
  (i) => i.severity === "critical"
).length;

const high = incidents.filter(
  (i) => i.severity === "high"
).length;

const uniqueIPs = new Set(
  incidents.map((i) => i.source_ip).filter(Boolean)
).size;

const securityScore = Math.max(
  0,
  100 - critical * 15 - high * 8 - open * 4
);

const posture =
  securityScore >= 80
    ? "Good"
    : securityScore >= 60
    ? "Moderate Risk"
    : "High Risk";

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
      console.error("Failed to load report data:", err);
    }
  };
  //Threat Trends
  const threatTrends = incidents.reduce((acc, incident) => {
  const date = new Date(incident.created_at).toLocaleDateString();

  acc[date] = (acc[date] || 0) + 1;

  return acc;
}, {});
//
const exportExecutiveReport = () => {
  const doc = new jsPDF();
   const addPageNumber = (pageNum) => {
    doc.setFontSize(10);
    doc.text(
      `Page ${pageNum}`,
      180,
      290
    );
  };
  //TopIp
  const ipCounts = incidents.reduce((acc, incident) => {
  const ip = incident.source_ip || "Unknown";

  acc[ip] = (acc[ip] || 0) + 1;

  return acc;
}, {});

const topIPEntry = Object.entries(ipCounts).sort(
  (a, b) => b[1] - a[1]
)[0];

const topIP = topIPEntry ? topIPEntry[0] : "N/A";
const topIPCount = topIPEntry ? topIPEntry[1] : 0;

  // COVER PAGE
  
  doc.setFontSize(26);
  doc.text("SOC Executive Security Report", 20, 40);

  doc.setFontSize(14);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 60);
  doc.text("Organization: Navid SOC Platform", 20, 75);
  doc.text("Classification: Internal Use", 20, 90);
  doc.text("Security Operations Center", 20, 105);
  addPageNumber(1);

  // EXECUTIVE SUMMARY
  doc.addPage();
  doc.setFontSize(20);
  doc.text("Executive Summary", 20, 20);

  doc.setFontSize(12);
  doc.text(`Security Score: ${securityScore}/100`, 20, 40);
  doc.text(`Risk Level: ${posture}`, 20, 55);
  doc.text(`Total Incidents: ${total}`, 20, 70);
  doc.text(`Open Incidents: ${open}`, 20, 85);
  doc.text(`Critical Threats: ${critical}`, 20, 100);
  doc.text(`High Threats: ${high}`, 20, 115);
  doc.text(`Attack Sources: ${uniqueIPs}`, 20, 130);
 addPageNumber(2);
  
  // THREAT OVERVIEW

doc.addPage();
addPageNumber(3);

doc.setFontSize(20);
doc.text("Threat Overview", 20, 20);

doc.setFontSize(11);

doc.text("Incident", 20, 40);
doc.text("Severity", 120, 40);
doc.text("Status", 155, 40);

doc.line(20, 45, 185, 45);

let y = 60;

incidents.forEach((incident) => {
  const title =
    incident.title.length > 40
      ? incident.title.substring(0, 40) + "..."
      : incident.title;

  doc.text(title, 20, y);
  doc.text(incident.severity.toUpperCase(), 120, y);
  doc.text(incident.status, 155, y);

  y += 12;
});
 addPageNumber(3);

 // THREAT TRENDS
doc.addPage();
addPageNumber(4);

doc.setFontSize(20);
doc.text("Threat Trends", 20, 20);

doc.setFontSize(11);

doc.text("Date", 20, 40);
doc.text("Threat Count", 120, 40);

doc.line(20, 45, 180, 45);

let trendY = 60;

Object.entries(threatTrends).forEach(([date, count]) => {
  doc.text(date, 20, trendY);
  doc.text(String(count), 120, trendY);

  trendY += 12;
});

// THREAT INTELLIGENCE

doc.addPage();
addPageNumber(5);

doc.setFontSize(20);
doc.text("Threat Intelligence", 20, 20);

doc.setFontSize(12);

doc.text(`Most Active Source IP: ${topIP}`, 20, 50);

doc.text(`Country: Localhost`, 20, 70);
doc.text(`City: Local Machine`, 20, 85);
doc.text(`ISP: Internal`, 20, 100);
doc.text(
  `Organization: Development Environment`,
  20,
  115
);

doc.text(`Risk Rating: Low`, 20, 135);

doc.text(
  "Intelligence Confidence: High",
  20,
  150
);

doc.text(
  `Total Incidents From Source: ${topIPCount}`,
  20,
  170
);
doc.text(
  "Assessment: Internal laboratory activity detected.",
  20,
  190
);

doc.text(
  "No known malicious infrastructure observed.",
  20,
  205
);

doc.text(
  "Recommended Action: Continue monitoring.",
  20,
  220
);

// CONTAINMENT ACTIONS

doc.addPage();
addPageNumber(6);

doc.setFontSize(20);
doc.text("Containment Actions", 20, 20);

doc.setFontSize(11);

doc.text("Action", 20, 45);
doc.text("Status", 120, 45);

doc.line(20, 50, 180, 50);

doc.text("Block IP", 20, 65);
doc.text(" Recommended", 120, 65);

doc.text("Disable User", 20, 80);
doc.text(" Recommended", 120, 80);

doc.text("Reset Password", 20, 95);
doc.text(" Recommended", 120, 95);

doc.text("Close Session", 20, 110);
doc.text(" Recommended", 120, 110);

doc.text(
  `Current Risk Level: ${posture}`,
  20,
  130
);

doc.text(
  "Recommended Response Priority: High",
  20,
  145
);

doc.setFontSize(16);
doc.text("Recommended Priority Actions", 20, 170);

doc.setFontSize(11);
doc.text(
  "1. Investigate Session Hijacking activity.",
  20,
  190
);

doc.text(
  "2. Review authentication controls.",
  20,
  205
);

doc.text(
  "3. Monitor API Abuse activity.",
  20,
  220
);

doc.text(
  "4. Continue proactive threat hunting.",
  20,
  235
);

  // TOP RISKS
  doc.addPage();
  doc.setFontSize(20);
  doc.text("Top Business Risks", 20, 20);

  y = 40;

  incidents
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .slice(0, 5)
    .forEach((risk, index) => {
      doc.setFontSize(11);
      doc.text(
        `${index + 1}. ${risk.title} (${risk.severity})`,
        20,
        y
      );
      y += 12;
    });
     addPageNumber(7);

  // MITRE
  doc.addPage();
  doc.setFontSize(20);
  doc.text("MITRE ATT&CK Coverage", 20, 20);

  doc.setFontSize(11);
  doc.text("T1110 - Brute Force", 20, 45);
  doc.text("T1190 - Exploit Public-Facing Application", 20, 60);
  doc.text("T1059 - Command and Scripting Interpreter", 20, 75);
   addPageNumber(8);
  // RECOMMENDATIONS
  
  doc.addPage();
  doc.setFontSize(20);
  doc.text("Analyst Recommendations", 20, 20);

  doc.setFontSize(12);
  doc.text("1. Investigate Session Hijacking activity.", 20, 45);
  doc.text("2. Review authentication controls.", 20, 60);
  doc.text("3. Strengthen API rate limiting.", 20, 75);
  doc.text("4. Monitor correlated attack patterns.", 20, 90);
  doc.text("5. Continue proactive threat hunting.", 20, 105);
 addPageNumber(9);
  // FINAL ASSESSMENT

  doc.addPage();
  doc.setFontSize(20);
  doc.text("Final Assessment", 20, 20);
  doc.setFontSize(14);
  doc.text(`Current Risk Level: ${posture}`, 20, 50);
  doc.text(`Critical Incidents: ${critical}`, 20, 70);
  doc.text(`Open Incidents: ${open}`, 20, 90);
  doc.text("Immediate investigation required.", 20, 110);
addPageNumber(10);
  doc.save(
    `Executive-Security-Report-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`
  );
};
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Reports</h1>

      <p style={styles.subtitle}>
        Generate executive and analyst-ready SOC reports.
      </p>

      <div style={styles.card}>
        <h3>Executive Security Report</h3>

        <p>
          Includes total incidents, severity summary, attack sources, top risks,
          and MITRE ATT&CK coverage.
        </p>

        <button style={styles.button} onClick={exportExecutiveReport}>
          Export Executive Security Report
        </button>
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

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "14px",
    padding: "22px",
    maxWidth: "700px",
  },

  button: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    padding: "12px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    marginTop: "10px",
  },
};