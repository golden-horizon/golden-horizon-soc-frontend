import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";



export default function IncidentDetails() {
  const { id } = useParams();

  const [incident, setIncident] = useState(null);
  const [relatedIncidents, setRelatedIncidents] = useState([]);
  const [note, setNote] = useState("");
  const [savedNotes, setSavedNotes] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [newStatus, setNewStatus] = useState("");
  const [assignedAnalyst, setAssignedAnalyst] = useState("");
  const [caseStatus, setCaseStatus] = useState("");
  const [caseInfo, setCaseInfo] = useState(null);
  const [executedActions, setExecutedActions] = useState([]);
const [rootCause, setRootCause] = useState("");
const [actionsTaken, setActionsTaken] = useState("");
const [finalOutcome, setFinalOutcome] = useState("");
const [lessonsLearned, setLessonsLearned] = useState("");
const [closureSummary, setClosureSummary] = useState(null);

  useEffect(() => {
  loadIncident();

  const existingNotes =
    JSON.parse(localStorage.getItem(`notes-${id}`)) || [];

  setSavedNotes(existingNotes);

  const existingHistory =
    JSON.parse(localStorage.getItem(`history-${id}`)) || [];

  setStatusHistory(existingHistory);
  const existingCase =
  JSON.parse(localStorage.getItem(`case-${id}`)) || null;

setCaseInfo(existingCase);

if (existingCase) {
  setAssignedAnalyst(existingCase.assignedAnalyst || "");
  setCaseStatus(existingCase.caseStatus || "");
}
const existingActions =
  JSON.parse(localStorage.getItem(`actions-${id}`)) || [];

setExecutedActions(existingActions);
const existingClosure =
  JSON.parse(localStorage.getItem(`closure-${id}`)) || null;

setClosureSummary(existingClosure);

if (existingClosure) {
  setRootCause(existingClosure.rootCause || "");
  setActionsTaken(existingClosure.actionsTaken || "");
  setFinalOutcome(existingClosure.finalOutcome || "");
  setLessonsLearned(existingClosure.lessonsLearned || "");
}
}, [id]);
  const loadIncident = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get("http://localhost:5000/incidents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const allIncidents = Array.isArray(res.data) ? res.data : [];

      const selected = allIncidents.find(
        (item) => String(item.id) === String(id)
      );

      setIncident(selected || null);

      if (selected?.source_ip) {
        const related = allIncidents.filter(
          (item) =>
            item.source_ip === selected.source_ip &&
            String(item.id) !== String(id)
        );

        setRelatedIncidents(related);
      }
    } catch (err) {
      console.error("Failed to load incident details:", err);
    }
  };

  if (!incident) {
    return (
      <div style={styles.page}>
        <h1>Incident Not Found</h1>
      </div>
    );
  }

  const mitreMap = {
  "Brute Force Attack Detected": [
    { id: "T1110", name: "Brute Force" },
  ],

  "SQL Injection Attempt Detected": [
    {
      id: "T1190",
      name: "Exploit Public-Facing Application",
    },
  ],

  "XSS Attempt Detected": [
    {
      id: "T1059",
      name: "Command and Scripting Interpreter",
    },
  ],

  "API Abuse Detected": [
    {
      id: "T1190",
      name: "Exploit Public-Facing Application",
    },
  ],

  "Session Hijacking Detected": [
    {
      id: "T1539",
      name: "Steal Web Session Cookie",
    },
  ],

  "Multi-Vector Attack Detected": [
    {
      id: "T1110",
      name: "Brute Force",
    },
    {
      id: "T1190",
      name: "Exploit Public-Facing Application",
    },
  ],
};

const incidentMitre =
  mitreMap[incident.title] || [];

const attackTimeline = [incident, ...relatedIncidents].sort(
  (a, b) => new Date(a.created_at) - new Date(b.created_at)
);

// ================= INCIDENT RISK SCORE =================

let incidentRiskScore = 0;

if (incident.severity === "critical") incidentRiskScore += 40;
if (incident.severity === "high") incidentRiskScore += 30;
if (incident.severity === "medium") incidentRiskScore += 15;
if (incident.severity === "low") incidentRiskScore += 5;

incidentRiskScore += relatedIncidents.length * 8;

if (incident.source_ip) incidentRiskScore += 10;

if (incidentRiskScore > 100) incidentRiskScore = 100;

const incidentPriority =
  incidentRiskScore >= 80
    ? "Critical"
    : incidentRiskScore >= 60
    ? "High"
    : incidentRiskScore >= 30
    ? "Medium"
    : "Low";

    //Add save note function
    const saveNote = () => {
  if (!note.trim()) return;

  const newNote = {
    text: note,
    created_at: new Date().toISOString(),
  };

  const updatedNotes = [newNote, ...savedNotes];

  setSavedNotes(updatedNotes);
  localStorage.setItem(`notes-${id}`, JSON.stringify(updatedNotes));
  setNote("");
};

//delete function
const deleteNote = (indexToDelete) => {
  const updatedNotes = savedNotes.filter(
    (_, index) => index !== indexToDelete
  );

  setSavedNotes(updatedNotes);
  localStorage.setItem(`notes-${id}`, JSON.stringify(updatedNotes));
};

//helper
const addStatusHistory = (oldStatus, newStatus) => {
  if (!oldStatus || !newStatus || oldStatus === newStatus) return;

  const historyItem = {
    oldStatus,
    newStatus,
    created_at: new Date().toISOString(),
  };

  const updatedHistory = [historyItem, ...statusHistory];

  setStatusHistory(updatedHistory);
  localStorage.setItem(`history-${id}`, JSON.stringify(updatedHistory));
};


const updateIncidentStatus = async () => {
  if (!newStatus || newStatus === incident.status) return;

  const oldStatus = incident.status;

  try {
    const token = localStorage.getItem("token");

    const res = await axios.put(
      `http://localhost:5000/incidents/${incident.id}`,
      {
        status: newStatus,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setIncident(res.data);
    addStatusHistory(oldStatus, newStatus);
    setNewStatus("");
  } catch (err) {
    console.error("Failed to update incident status:", err);
  }
};
//IOC
const sameIPIncidents = relatedIncidents.length + 1;

const sortedTimeline = [...attackTimeline].sort(
  (a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
);

const firstSeen =
  sortedTimeline.length > 0
    ? sortedTimeline[0].created_at
    : incident.created_at;

const lastSeen =
  sortedTimeline.length > 0
    ? sortedTimeline[sortedTimeline.length - 1].created_at
    : incident.created_at;

const attackTypes = [
  ...new Set(
    attackTimeline.map((item) => item.title)
  ),
];

const saveCaseManagement = () => {
  const newCaseInfo = {
    assignedAnalyst: assignedAnalyst || "Unassigned",
    caseStatus: caseStatus || "New",
    priority: incidentPriority,
    updated_at: new Date().toISOString(),
  };

  setCaseInfo(newCaseInfo);

  localStorage.setItem(
    `case-${id}`,
    JSON.stringify(newCaseInfo)
  );
};

//Containment Actions
const executeAction = (actionName) => {
  const newAction = {
    action: actionName,
    created_at: new Date().toISOString(),
  };

  const updatedActions = [newAction, ...executedActions];

  setExecutedActions(updatedActions);

  localStorage.setItem(
    `actions-${id}`,
    JSON.stringify(updatedActions)
  );
};
//Incident Closure Summary
const saveClosureSummary = () => {
  const summary = {
    rootCause,
    actionsTaken,
    finalOutcome,
    lessonsLearned,
    created_at: new Date().toISOString(),
  };

  setClosureSummary(summary);

  localStorage.setItem(
    `closure-${id}`,
    JSON.stringify(summary)
  );
};
//PDF Incident Report
const exportIncidentReport = () => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Incident Report", 20, 20);

  doc.setFontSize(12);
  doc.text(`Title: ${incident.title}`, 20, 35);
  doc.text(`Severity: ${incident.severity}`, 20, 45);
  doc.text(`Status: ${incident.status}`, 20, 55);
  doc.text(`Source IP: ${incident.source_ip || "N/A"}`, 20, 65);
  doc.text(
    `Created: ${new Date(incident.created_at).toLocaleString()}`,
    20,
    75
  );

  doc.text("Description:", 20, 90);
  doc.text(incident.description || "No description", 20, 100, {
    maxWidth: 170,
  });

  doc.text("MITRE ATT&CK:", 20, 125);

  incidentMitre.forEach((item, index) => {
    doc.text(
      `${item.id} - ${item.name}`,
      20,
      135 + index * 10
    );
  });

  doc.text("Attack Timeline:", 20, 165);

  attackTimeline.slice(0, 5).forEach((event, index) => {
    doc.text(
      `${event.title} - ${event.severity}`,
      20,
      175 + index * 10
    );
  });

  doc.save(`incident-report-${incident.id}.pdf`);
};
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>{incident.title}</h1>

      <div style={styles.grid}>

        <div style={styles.card}>
  <h3>Incident Summary</h3>

  <p><strong>Severity:</strong> {incident.severity}</p>

  <p><strong>Status:</strong> {incident.status}</p>

  <p><strong>Source IP:</strong> {incident.source_ip || "N/A"}</p>

  <p>
    <strong>Created:</strong>{" "}
    {new Date(incident.created_at).toLocaleString()}
  </p>

  <select
    value={newStatus}
    onChange={(e) => setNewStatus(e.target.value)}
    style={styles.select}
  >
    <option value="">Change status</option>
    <option value="open">Open</option>
    <option value="in-progress">In Progress</option>
    <option value="closed">Closed</option>
  </select>

  <button
    style={styles.saveBtn}
    onClick={updateIncidentStatus}
  >
    Update Status
  </button>
</div>

        <div style={styles.card}>
  <h3>Incident Risk Score</h3>

  <p>
    Score: <strong>{incidentRiskScore}/100</strong>
  </p>

  <p>
    Priority: <strong>{incidentPriority}</strong>
  </p>

  <p>
    Action:{" "}
    <strong>
      {incidentPriority === "Critical"
        ? "Immediate investigation required"
        : incidentPriority === "High"
        ? "Prioritise analyst review"
        : incidentPriority === "Medium"
        ? "Monitor and review"
        : "Low priority"}
    </strong>
  </p>
</div>

    <div style={styles.card}>
  <h3>Case Management</h3>

  <p>
    Assigned Analyst:{" "}
    <strong>{caseInfo?.assignedAnalyst || "Unassigned"}</strong>
  </p>

  <p>
    Case Status:{" "}
    <strong>{caseInfo?.caseStatus || "New"}</strong>
  </p>

  <p>
    Priority: <strong>{incidentPriority}</strong>
  </p>

  <input
    style={styles.input}
    placeholder="Assign analyst name"
    value={assignedAnalyst}
    onChange={(e) => setAssignedAnalyst(e.target.value)}
  />

  <select
    style={styles.select}
    value={caseStatus}
    onChange={(e) => setCaseStatus(e.target.value)}
  >
    <option value="">Select case status</option>
    <option value="New">New</option>
    <option value="Active">Active</option>
    <option value="Escalated">Escalated</option>
    <option value="Resolved">Resolved</option>
  </select>

  <button
    style={styles.saveBtn}
    onClick={saveCaseManagement}
  >
    Save Case
  </button>
</div>

   <div style={styles.card}>
  <h3>Containment Actions</h3>

  <div style={styles.actionGrid}>
    {["Block IP", "Disable User", "Reset Password", "Close Session"].map(
      (action) => (
        <button
          key={action}
          style={styles.actionBtn}
          onClick={() => executeAction(action)}
        >
          {action}
        </button>
      )
    )}
  </div>

  <div style={styles.card}>
  <h3>Incident Closure Summary</h3>

  <textarea
    style={styles.textarea}
    placeholder="Root Cause"
    value={rootCause}
    onChange={(e) => setRootCause(e.target.value)}
  />

  <textarea
    style={styles.textarea}
    placeholder="Actions Taken"
    value={actionsTaken}
    onChange={(e) => setActionsTaken(e.target.value)}
  />

  <textarea
    style={styles.textarea}
    placeholder="Final Outcome"
    value={finalOutcome}
    onChange={(e) => setFinalOutcome(e.target.value)}
  />

  <textarea
    style={styles.textarea}
    placeholder="Lessons Learned"
    value={lessonsLearned}
    onChange={(e) => setLessonsLearned(e.target.value)}
  />

  <button
    style={styles.saveBtn}
    onClick={saveClosureSummary}
  >
    Save Closure Report
  </button>
</div>

  <h4>Executed Actions</h4>

  {executedActions.length > 0 ? (
    executedActions.map((item, index) => (
      <div key={index} style={styles.relatedItem}>
        <strong>{item.action}</strong>
        <small>{new Date(item.created_at).toLocaleString()}</small>
      </div>
    ))
  ) : (
    <p>No containment actions executed yet.</p>
  )}
</div>

        <div style={styles.card}>
          <h3>Description</h3>
          <p>{incident.description}</p>
        </div>

        <div style={styles.card}>
  <h3>Threat Intelligence</h3>

  <p>
    <strong>IP Address:</strong>{" "}
    {incident.source_ip || "Unknown"}
  </p>

  <p>
    <strong>Risk Level:</strong>{" "}
    {incident.severity === "critical"
      ? "Critical"
      : incident.severity === "high"
      ? "High"
      : "Medium"}
  </p>

  <p>
    <strong>Classification:</strong>{" "}
    Internal Investigation
  </p>

  <p>
    <strong>Confidence:</strong> 95%
  </p>
</div>
      </div>

      <div style={styles.card}>
  <h3>Indicators of Compromise (IOC)</h3>

  <p>
    <strong>Source IP:</strong>{" "}
    {incident.source_ip || "N/A"}
  </p>

  <p>
    <strong>Total Incidents:</strong>{" "}
    {sameIPIncidents}
  </p>

  <p>
    <strong>First Seen:</strong>{" "}
    {new Date(firstSeen).toLocaleString()}
  </p>

  <p>
    <strong>Last Seen:</strong>{" "}
    {new Date(lastSeen).toLocaleString()}
  </p>

  <p>
    <strong>Attack Types:</strong>
  </p>

  {attackTypes.map((type, index) => (
    <div key={index} style={styles.relatedItem}>
      {type}
    </div>
  ))}
</div>

      <div style={styles.card}>
        <h3>Related Incidents</h3>

        {relatedIncidents.length > 0 ? (
          relatedIncidents.map((item) => (
            <div key={item.id} style={styles.relatedItem}>
              <strong>{item.title}</strong>
              <span>{item.severity}</span>
              <small>{item.status}</small>
            </div>

       
          ))
        ) : (
          <p>No related incidents found.</p>
        )}
      </div>

      <div style={styles.card}>
  <h3>MITRE ATT&CK Mapping</h3>

  {incidentMitre.map((technique) => (
    <div
      key={technique.id}
      style={styles.relatedItem}
    >
      <strong>{technique.id}</strong>
      <span>{technique.name}</span>
    </div>
  ))}
</div>

<div style={styles.card}>
  <h3>Attack Timeline</h3>

  {attackTimeline.map((event) => (
    <div key={event.id} style={styles.relatedItem}>
      <strong>{event.title}</strong>
      <span>{event.severity}</span>
      <small>
        {new Date(event.created_at).toLocaleString()}
      </small>
    </div>
  ))}
</div>

<div style={styles.card}>
  <h3>Analyst Notes</h3>

  <textarea
    style={styles.textarea}
    placeholder="Write investigation notes here..."
    value={note}
    onChange={(e) => setNote(e.target.value)}
  />

  <button style={styles.saveBtn} onClick={saveNote}>
    Save Note
  </button>

  {savedNotes.length > 0 ? (
  savedNotes.map((item, index) => (
    <div key={index} style={styles.relatedItem}>
      <p>{item.text}</p>

      <small>
        {new Date(item.created_at).toLocaleString()}
      </small>

      <button
        style={styles.deleteNoteBtn}
        onClick={() => deleteNote(index)}
      >
        Delete Note
      </button>
    </div>
  ))
) : (
  <p>No analyst notes yet.</p>
)}
</div>

<div style={styles.card}>
  <h3>Incident Status History</h3>

  {statusHistory.length > 0 ? (
    statusHistory.map((item, index) => (
      <div key={index} style={styles.relatedItem}>
        <strong>
          {item.oldStatus} → {item.newStatus}
        </strong>

        <small>
          {new Date(item.created_at).toLocaleString()}
        </small>
      </div>
    ))
  ) : (
    <p>No status changes recorded yet.</p>
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
    padding: "30px",
  },

  title: {
    fontSize: "34px",
    marginBottom: "20px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "20px",
  },

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "14px",
    padding: "20px",
  },

  relatedItem: {
    marginTop: "10px",
    padding: "12px",
    background: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #475569",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  textarea: {
  width: "100%",
  minHeight: "100px",
  background: "#020617",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "12px",
  marginBottom: "10px",
},

saveBtn: {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  marginBottom: "15px",
},
deleteNoteBtn: {
  background: "#7f1d1d",
  color: "#fff",
  border: "none",
  padding: "8px 10px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold",
  marginTop: "8px",
  width: "120px",
},
select: {
  width: "100%",
  background: "#020617",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "10px",
  marginTop: "10px",
  marginBottom: "10px",
},
input: {
  width: "100%",
  background: "#020617",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "10px",
  marginTop: "10px",
  marginBottom: "10px",
},
actionGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "10px",
  marginBottom: "15px",
},

actionBtn: {
  background: "#7f1d1d",
  color: "#fff",
  border: "1px solid #ef4444",
  padding: "10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
},

};