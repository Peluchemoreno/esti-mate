import React, { useState } from "react";
import BackButton from "../BackButton/BackButton";

export default function AdminAccountState() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [error, setError] = useState("");
  const [resetError, setResetError] = useState("");

  const [result, setResult] = useState(null);
  const [tempPassword, setTempPassword] = useState("");

  async function handleLookup(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email.");
      return;
    }

    const token = localStorage.getItem("jwt");
    if (!token) {
      setError("No JWT found in localStorage.jwt. Log in first.");
      return;
    }

    setLoading(true);
    try {
      const url = `https://api.tryestimate.io/admin/account-state?email=${encodeURIComponent(
        trimmed,
      )}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const msg =
          data?.error?.message ||
          data?.error ||
          data?.message ||
          `Request failed (${res.status})`;

        setError(`${res.status}: ${msg}`);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setResetError("");
    setTempPassword("");

    const trimmed = email.trim();
    if (!trimmed) {
      setResetError("Enter an email first.");
      return;
    }

    const token = localStorage.getItem("jwt");
    if (!token) {
      setResetError("No JWT found in localStorage.jwt. Log in first.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(
        "https://api.tryestimate.io/users/admin/reset-user-password",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: trimmed.toLowerCase() }),
        },
      );

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const msg =
          data?.error?.message ||
          data?.error ||
          data?.message ||
          `Request failed (${res.status})`;
        setResetError(`${res.status}: ${msg}`);
        return;
      }

      // Support a few common response shapes
      const pw =
        data?.temporaryPassword ||
        data?.tempPassword ||
        data?.password ||
        data?.value;

      if (!pw) {
        setResetError(
          "Reset succeeded but no temp password was returned. Check backend response.",
        );
        return;
      }

      setTempPassword(pw);
    } catch (err) {
      setResetError(err?.message || "Reset failed");
    } finally {
      setResetLoading(false);
    }
  }

  async function copyTempPassword() {
    try {
      await navigator.clipboard.writeText(tempPassword);
    } catch {
      // If clipboard fails (rare), user can still manually select/copy
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <BackButton to="/dashboard/projects" style={{ marginBottom: 20 }} />
      <h1 style={{ marginBottom: 8 }}>Admin: Account State</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Looks up a user by email and shows Stripe + subscription state.
      </p>

      <form onSubmit={handleLookup} style={{ display: "flex", gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@email.com"
          style={{ flex: 1, padding: 10, color: "white" }}
        />
        <button disabled={loading} style={{ padding: "10px 14px" }}>
          {loading ? "Loading..." : "Lookup"}
        </button>
      </form>

      {/* Reset password panel */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(17, 24, 39, 0.35)",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetLoading}
            style={{ padding: "10px 14px" }}
          >
            {resetLoading ? "Resetting..." : "Generate Temporary Password"}
          </button>

          {tempPassword ? (
            <button
              type="button"
              onClick={copyTempPassword}
              style={{ padding: "10px 14px" }}
            >
              Copy Password
            </button>
          ) : null}
        </div>

        {resetError ? (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid #f0b4b4",
              background: "#fff5f5",
            }}
          >
            <strong>Error:</strong> {resetError}
          </div>
        ) : null}

        {tempPassword ? (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Temporary password:
            </div>
            <code style={{ fontSize: 16, wordBreak: "break-all" }}>
              {tempPassword}
            </code>
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
              Share this with the user. They should change it immediately after
              logging in.
            </div>
          </div>
        ) : null}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #f0b4b4",
            background: "#fff5f5",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20 }}>
          {/* === STATUS HEADER === */}
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              marginBottom: 20,
              background:
                result.summary.subscriptionStatus === "active"
                  ? "#e6fffa"
                  : "#fff5f5",
              border: "2px solid",
              borderColor:
                result.summary.subscriptionStatus === "active"
                  ? "#38b2ac"
                  : "#f56565",
            }}
          >
            <h2 style={{ margin: 0, color: "#111827" }}>
              {result.account.email}
            </h2>

            <div style={{ marginTop: 10, fontSize: 18, color: "#555" }}>
              Plan: <strong>{result.account.subscriptionPlan || "none"}</strong>
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 20,
                fontWeight: "bold",
                color:
                  result.summary.subscriptionStatus === "active"
                    ? "#2c7a7b"
                    : "#c53030",
              }}
            >
              {result.summary.subscriptionStatus?.toUpperCase()}
            </div>
          </div>

          {/* === BIG COUNT CARDS === */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {[
              { label: "Customers", value: result.counts.customers },
              { label: "Projects", value: result.counts.projects },
              { label: "Estimates", value: result.counts.estimates },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: "#111827",
                  color: "white",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 14, opacity: 0.7 }}>{item.label}</div>
                <div style={{ fontSize: 42, fontWeight: "bold" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* === ACCOUNT DETAILS === */}
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              marginBottom: 20,
            }}
          >
            <h3>Account Info</h3>
            <div>
              <strong>ID:</strong> {result.account.id}
            </div>
            <div>
              <strong>Name:</strong> {result.account.fullName}
            </div>
            <div>
              <strong>Created:</strong> {result.account.createdAt}
            </div>
          </div>

          {/* === STRIPE DETAILS === */}
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <h3>Stripe</h3>
            <div>
              <strong>Stripe Customer:</strong>{" "}
              {result.account.stripeCustomerId || "—"}
            </div>
            <div>
              <strong>Stripe Subscription:</strong>{" "}
              {result.account.stripeSubscriptionId || "—"}
            </div>
            <div>
              <strong>Has Stripe Customer:</strong>{" "}
              {result.summary.hasStripeCustomer ? "✅ Yes" : "❌ No"}
            </div>
            <div>
              <strong>Has Subscription:</strong>{" "}
              {result.summary.hasSubscription ? "✅ Yes" : "❌ No"}
            </div>
            <div>
              <strong>Will cancel at period end:</strong>{" "}
              {result.summary.willCancelAtPeriodEnd ? "⚠️ YES" : "No"}
            </div>

            <div>
              <strong>Cancel date:</strong>{" "}
              {result.summary.cancelAt
                ? new Date(result.summary.cancelAt).toLocaleString()
                : "—"}
            </div>

            <div>
              <strong>Current period end:</strong>{" "}
              {result.summary.currentPeriodEnd
                ? new Date(result.summary.currentPeriodEnd).toLocaleString()
                : "—"}
            </div>

            <div>
              <strong>Stripe status:</strong>{" "}
              {result.summary.stripeStatus || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
