import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../../utils/api";

export default function ChangePassword({ setLoggedIn }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    changePassword({ newPassword })
      .then(() => {
        const token = localStorage.getItem("jwt");
        return getUser(token);
      })
      .then((user) => {
        // re-hydrate app state immediately
        setCurrentUser(user);
        setLoggedIn(true);

        // mustChangePassword is now false server-side, but set it locally too
        // (so your UI doesn't keep thinking it's forced)
        setCurrentUser((prev) => ({ ...prev, mustChangePassword: false }));

        setMessage("Password updated successfully.");
        navigate("/dashboard/projects", { replace: true });
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to update password.");
      })
      .finally(() => setLoading(false));
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>Update Your Password</h2>
        <p style={styles.subtitle}>
          For security reasons, you must set a new password before continuing.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
            required
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
            required
          />

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>

          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.success}>{message}</p>}
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f6f8",
    padding: "20px",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: "40px",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  },
  title: {
    marginBottom: "10px",
    fontSize: "22px",
    fontWeight: "600",
  },
  subtitle: {
    marginBottom: "25px",
    fontSize: "14px",
    color: "#666",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  input: {
    padding: "12px 14px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
  },
  button: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },
  error: {
    color: "#dc2626",
    fontSize: "13px",
  },
  success: {
    color: "#16a34a",
    fontSize: "13px",
  },
};
