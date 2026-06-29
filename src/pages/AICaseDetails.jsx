import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function AICaseDetails() {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState(null);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/case/${caseId}`)
      .then((res) => res.json())
      .then((data) => setCaseData(data))
      .catch(console.error);
  }, [caseId]);

  if (!caseData) return <div style={styles.page}>Loading case...</div>;

  const incident = caseData.incident || {};
  const mitre = caseData.mitre_analysis || {};
  const threat = caseData.threat_enrichment || {};
  const notes = caseData.analyst_notes || [];

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>{caseData.case_id}</h2>

      <div style={styles.grid}>
        <Info label="Attack Type" value={incident.attack_type} />
        <Info label="Source IP" value={incident.source_ip} />
        <Info label="User" value={incident.user} />
        <Info label="Status" value={caseData.status} />
        <Info label="Severity" value={caseData.severity} />
        <Info label="Decision" value={caseData.soc_decision} />
        <Info label="Events" value={caseData.event_count} />
        <Info label="Threat Score" value={threat.threat_score} />
        <Info label="Country" value={threat.country} />
        <Info label="Reputation" value={threat.reputation} />
        <Info label="MITRE ID" value={mitre.technique_id} />
        <Info label="MITRE Name" value={mitre.technique_name} />
      </div>

      <section style={styles.box}>
        <h3>Executive Summary</h3>
        <pre style={styles.pre}>{caseData.executive_summary}</pre>
      </section>

      <section style={styles.box}>
       <h3>Analyst Notes</h3>
       {notes.length === 0 ? (
        <p>No analyst notes.</p>
       ) : (
        notes.map((note, index) => (
          <div key={index} style={styles.note}>
            <strong>{note.analyst}</strong>
            <p>{note.note}</p>
          </div>
        ))
       )}
      </section>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.card}>
      <span>{label}</span>
      <strong>{value ?? "unknown"}</strong>
    </div>
  );
}

const styles = {
  page: {
    padding: "18px",
    background: "#0f172a",
    color: "#f8fafc",
    minHeight: "100vh",
  },
  title: {
    marginBottom: "16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },
  card: {
    background: "#111827",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "12px",
    display: "grid",
    gap: "6px",
  },
  box: {
    background: "#111827",
    border: "1px solid #263244",
    borderRadius: "8px",
    padding: "14px",
    marginBottom: "16px",
  },
  pre: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
    color: "#cbd5e1",
  },
  note: {
  padding: "8px",
  borderBottom: "1px solid #334155",
  whiteSpace: "normal",
  wordBreak: "break-word",
  },
};