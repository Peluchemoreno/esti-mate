// src/components/Stripe/Stripe.jsx
import "./Stripe.css";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51S84DVLogbJCypHWSEBTfmoGZ9eTFnynjeDlGlJK6bNoLOsye4w5Dr7hfVMCcYjfeloC2JA7q4dEYPRanGWn0YsY00NjXcKslE";
const stripePromise = loadStripe(PUBLISHABLE_KEY);

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "http://127.0.0.1:4000";

const plankey = {
  basic: "price_1S9FSOLV1NkgtKMpFGrODp7C",
  test: "price_1SAblmLV1NkgtKMp569jEsoF",
  pro: "price_PRO_PLACEHOLDER", // fill in if/when you have real ids
  enterprise: "price_ENT_PLACEHOLDER", // fill in if/when you have real ids
};

export default function Stripe({ token }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planParam = (searchParams.get("plan") || "basic").toLowerCase();
  const currentPlan = plankey[planParam] ? planParam : "basic";

  const authToken = token || localStorage.getItem("jwt");
  const [clientSecret, setClientSecret] = useState(null);
  const [err, setErr] = useState(null);

  // prevent multiple embeds if user re-clicks
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchClientSecret = useCallback(async () => {
    if (!authToken) {
      throw new Error("Not authenticated (no JWT). Please sign in again.");
    }
    const res = await fetch(`${API_BASE}/api/stripe/embedded-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        priceId: plankey[currentPlan],
        quantity: 1,
      }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(
        `Failed to create session: ${res.status} ${j.error || ""}`
      );
    }
    const { client_secret } = await res.json();
    if (!client_secret) throw new Error("No client_secret from server");
    return client_secret;
  }, [authToken, currentPlan]);

  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setErr(null);

    fetchClientSecret()
      .then((secret) => {
        if (!cancelled && mountedRef.current) setClientSecret(secret);
      })
      .catch((e) => {
        if (!cancelled && mountedRef.current) setErr(e.message || String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [fetchClientSecret]);

  const options = useMemo(
    () => (clientSecret ? { clientSecret } : null),
    [clientSecret]
  );

  if (!authToken) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#b00", marginBottom: 12 }}>
          You’re not signed in. Please sign in again to continue.
        </p>
        <button onClick={() => navigate("/signin")}>Go to Sign in</button>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#b00" }}>{err}</p>
        <button onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
  }

  if (!options) {
    return <div style={{ padding: 24 }}>Loading checkout…</div>;
  }

  return (
    <div className="stripe-container" id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={options}
        key={options.clientSecret}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
