// src/components/Stripe/CheckoutReturn.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
const BASE_URL = import.meta.env.VITE_API_URL;

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!sessionId) throw new Error("Missing session_id");
        console.log(`${BASE_URL}api/stripe/session/${sessionId}`);
        const res = await fetch(`${BASE_URL}api/stripe/session/${sessionId}`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Expect your backend to return { jwt, user, subscription }
        if (!data?.jwt) throw new Error("No JWT returned from server");
        if (!cancelled) {
          localStorage.setItem("jwt", data.jwt);
          // optional: localStorage.setItem("user", JSON.stringify(data.user));
          navigate("/dashboard/projects", { replace: true });
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  if (err) {
    return (
      <div style={{ padding: 24, color: "#b00" }}>
        Stripe return error: {err}
      </div>
    );
  }
  return <div style={{ padding: 24 }}>Finalizing your subscription…</div>;
}
