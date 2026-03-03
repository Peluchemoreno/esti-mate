import React, { useState } from "react";

export default function AdminAccountState() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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
      /* const url = `https://api.tryestimate.io/admin/account-state?email=${encodeURIComponent(
        trimmed,
      )}`; */
      const url = `http://localhost:4000/admin/account-state?email=${encodeURIComponent(
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
        // Normalize common shapes
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

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
