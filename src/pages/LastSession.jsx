export default function LastSession() {
  return (
    <div style={styles.page}>
      <h1>Last Session Summary</h1>

      <h2>Completed Today</h2>
      <ul>
        <li>Investigation Center working</li>
        <li>Brute-force detection working</li>
        <li>SQL Injection detection working</li>
        <li>XSS detection working</li>
        <li>source_ip added for incident correlation</li>
        <li>Related Incidents panel working</li>
        <li>SQL Injection, XSS, and Brute Force now appear under selected IP</li>
      </ul>

      <h2>Continue Tomorrow</h2>
      <ol>
        <li>Build Attack Types Summary</li>
        <li>Show unique attack categories per IP</li>
        <li>Create Multi-Vector Attack correlation rule</li>
        <li>If one IP triggers Brute Force + SQLi + XSS, create Critical incident</li>
      </ol>
    </div>
  );
}

const styles = {
  page: {
    background: "#0f172a",
    color: "#f8fafc",
    minHeight: "100vh",
    padding: "40px",
    lineHeight: "1.8",
  },
};