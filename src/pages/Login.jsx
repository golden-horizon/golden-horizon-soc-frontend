import { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import socket from "./socket";
import goldenHorizonLogo from "../assets/golden-horizon-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionExpired =
    new URLSearchParams(location.search).get("expired") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [step, setStep] = useState("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    sessionExpired ? "Session expired. Please log in again." : ""
  );
  const [notice, setNotice] = useState("");

  const completeLogin = (token) => {
    if (!token) {
      setError("Authentication failed. No session token returned.");
      return;
    }

    localStorage.setItem("token", token);
    setMfaCode("");
    socket.connect();

    setTimeout(() => {
      navigate("/dashboard");
    }, 200);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      if (step === "credentials") {
        const res = await axios.post("https://golden-horizon-soc-backend.onrender.com/login", {
          email,
          password,
        });

        if (res.data.requiresMfa) {
          setStep("mfa");
          setNotice(res.data.message || "Enter your MFA code to continue.");
          return;
        }

        completeLogin(res.data.token);
        return;
      }

      if (!mfaCode) {
        setError("MFA code is required");
        return;
      }

      const res = await axios.post("https://golden-horizon-soc-backend.onrender.com/login/mfa", {
        email,
        password,
        code: mfaCode,
      });

      completeLogin(res.data.token);
    } catch (err) {
      console.log(err.response?.data || err.message);
      const backendMessage =
        err.response?.data?.message || err.response?.data?.error || "";

      setError(
        backendMessage === "Invalid credentials"
          ? "Invalid email or password"
          : backendMessage || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const resetCredentials = () => {
    setStep("credentials");
    setMfaCode("");
    setNotice("");
    setError("");
  };

  return (
    <div style={styles.page}>
      <form onSubmit={handleLogin} style={styles.card}>
        <div style={styles.brand}>
          <img
            src={goldenHorizonLogo}
            alt="Golden Horizon"
            style={styles.logo}
          />
        </div>

        <div style={styles.headingGroup}>
          <h2 style={styles.title}>SOC Login</h2>
          <p style={styles.subtitle}>Security Operations Center Access Portal</p>
          <p style={styles.accessNote}>Authorized Access Only</p>
        </div>

        {step === "credentials" ? (
          <>
            <label style={styles.label}>
              Email
              <input
                className="auth-input"
                placeholder="admin@test.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Password
              <div style={styles.passwordField}>
                <input
                  className="auth-input"
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...styles.input, paddingRight: "84px" }}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  style={styles.passwordToggle}
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          </>
        ) : (
          <>
            <div style={styles.mfaPanel}>
              <span style={styles.mfaEyebrow}>MFA Verification</span>
              <p style={styles.mfaText}>Enter your MFA code to continue.</p>
            </div>

            <label style={styles.label}>
              MFA Code
              <input
                className="auth-input"
                placeholder="123456"
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                style={styles.input}
              />
            </label>

            <button
              type="button"
              className="auth-secondary-button"
              style={styles.secondaryButton}
              onClick={resetCredentials}
            >
              Use different credentials
            </button>
          </>
        )}

        <button
          type="submit"
          className="auth-button"
          style={styles.button}
          disabled={loading}
        >
          {loading
            ? "Verifying..."
            : step === "credentials"
              ? "Access SOC Platform"
              : "Verify MFA"}
        </button>

        <p style={styles.securityNotice}>
          All login activity is monitored and logged.
        </p>
        {notice && <p style={styles.notice}>{notice}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </form>

      <div style={styles.version}>Golden Horizon SOC Platform v1.0</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top, rgba(30, 64, 175, 0.22), transparent 34%), #070d1a",
    boxSizing: "border-box",
  },

  card: {
    width: "min(400px, 100%)",
    background: "#0f172a",
    padding: "30px",
    borderRadius: "14px",
    border: "1px solid #253349",
    boxShadow: "0 18px 42px rgba(0,0,0,0.38)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    boxSizing: "border-box",
  },

  brand: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "4px",
  },

  logo: {
    width: "245px",
    maxWidth: "100%",
    height: "auto",
    objectFit: "contain",
  },

  headingGroup: {
    display: "grid",
    gap: "6px",
    marginBottom: "4px",
  },

  title: {
    margin: 0,
    textAlign: "center",
    color: "#f8fafc",
    fontSize: "22px",
    fontWeight: 800,
  },

  subtitle: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "13px",
    textAlign: "center",
  },

  accessNote: {
    margin: 0,
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.02em",
    textAlign: "center",
  },

  label: {
    display: "grid",
    gap: "7px",
    color: "#9fb4d0",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textAlign: "left",
    textTransform: "uppercase",
  },

  input: {
    width: "100%",
    padding: "12px 13px",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#071021",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },

  passwordField: {
    position: "relative",
  },

  passwordToggle: {
    position: "absolute",
    top: "50%",
    right: "8px",
    transform: "translateY(-50%)",
    border: "1px solid #334155",
    borderRadius: "7px",
    background: "rgba(15, 23, 42, 0.92)",
    color: "#bfdbfe",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1,
    padding: "7px 10px",
  },

  button: {
    padding: "12px 14px",
    border: "none",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    marginTop: "4px",
  },

  secondaryButton: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "transparent",
    color: "#bfdbfe",
    fontWeight: 700,
    cursor: "pointer",
  },

  mfaPanel: {
    border: "1px solid rgba(59, 130, 246, 0.34)",
    background: "rgba(30, 64, 175, 0.13)",
    borderRadius: "10px",
    padding: "12px",
    textAlign: "left",
  },

  mfaEyebrow: {
    color: "#60a5fa",
    display: "block",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    marginBottom: "4px",
    textTransform: "uppercase",
  },

  mfaText: {
    color: "#dbeafe",
    fontSize: "13px",
    margin: 0,
  },

  notice: {
    color: "#93c5fd",
    textAlign: "center",
    margin: 0,
    fontSize: "13px",
  },

  securityNotice: {
    color: "#7f93ad",
    fontSize: "12px",
    margin: "0",
    textAlign: "center",
  },

  error: {
    color: "#ef4444",
    textAlign: "center",
    margin: 0,
    fontSize: "13px",
  },

  version: {
    position: "fixed",
    right: "18px",
    bottom: "14px",
    color: "#64748b",
    fontSize: "12px",
    letterSpacing: "0.02em",
  },
};

