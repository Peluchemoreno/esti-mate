// src/components/Estimates/SavedEstimatesPanel.jsx
import { useEffect, useMemo, useState } from "react";
import EstimateViewerModal from "../Estimates/EstimateViewerModal";
import { PDFDownloadLink } from "@react-pdf/renderer";
import EstimatePDF from "../EstimatePDF/EstimatePDF";
import { BASE_URL } from "../../utils/constants";

const brand = {
  bg: "#000000",
  fg: "var(--white)",
  panel: "#111111",
  border: "var(--white)",
  accent: "var(--blue-primary)",
  muted: "#aaa",
  danger: "#ef4444",
};

export default function SavedEstimatesPanel({
  projectId,
  currentUser,
  products,
  project,
}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

  const [loading, setLoading] = useState(false);
  const [estimates, setEstimates] = useState([]);
  const [error, setError] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeEstimate, setActiveEstimate] = useState(null);

  const canFetch = Boolean(token && currentUser?._id && projectId);

  const fetchEstimates = async () => {
    if (!canFetch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${BASE_URL}api/estimates?projectId=${encodeURIComponent(projectId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || res.statusText);
      }
      const data = await res.json();
      setEstimates(Array.isArray(data?.estimates) ? data.estimates : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load estimates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onCreated = () => {
      // call your existing loader here
      fetchEstimates(); // <-- whatever you already use to fetch the list
    };
    window.addEventListener("estimate-created", onCreated);
    return () => window.removeEventListener("estimate-created", onCreated);
  }, []);

  useEffect(() => {
    if (!currentUser?._id || !token) return;
    fetch(`${BASE_URL}users/${currentUser._id}/logo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Logo fetch failed");
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result); // base64 data URL
            r.onerror = reject;
            r.readAsDataURL(blob);
          })
      )
      .then((b64) => setLogoUrl(b64))
      .catch((err) => {
        console.warn(
          "No logo available or failed to load:",
          err?.message || err
        );
        setLogoUrl(null);
      });
  }, [currentUser?._id, token]);

  useEffect(() => {
    fetchEstimates();
    // auto-refresh when someone saves/deletes elsewhere
    const onSaved = () => fetchEstimates();
    const onDeleted = () => fetchEstimates();
    window.addEventListener("estimate-created", onSaved);
    window.addEventListener("estimate-deleted", onDeleted);
    return () => {
      window.removeEventListener("estimate-created", onSaved);
      window.removeEventListener("estimate-deleted", onDeleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, projectId]);

  const openViewer = (est) => {
    setActiveEstimate(est);
    setViewerOpen(true);
  };
  const closeViewer = () => {
    setViewerOpen(false);
    setActiveEstimate(null);
  };

  const money = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

  const handleDelete = async (id) => {
    if (!confirm("Delete this estimate? This cannot be undone.")) return;
    try {
      const res = await fetch(`${BASE_URL}api/estimates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || res.statusText);
      }
      // refresh
      await fetchEstimates();
      window.dispatchEvent(new Event("estimate-deleted"));
    } catch (e) {
      alert(e.message || "Failed to delete");
    }
  };

  return (
    <div
      style={{
        marginTop: 16,
        border: `1px solid ${brand.border}`,
        borderRadius: 10,
        overflow: "hidden",
        background: brand.bg,
        color: brand.fg,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${brand.border}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: brand.panel,
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 700 }}>Saved Estimates</h3>
        <button
          onClick={fetchEstimates}
          style={{
            marginLeft: "auto",
            background: "transparent",
            color: brand.fg,
            border: `1px solid ${brand.border}`,
            borderRadius: 6,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${brand.border}`,
          display: "grid",
          gridTemplateColumns: "0.5fr 1fr 1fr 0.8fr 0.9fr",
          gap: 8,
          color: brand.muted,
          fontSize: 13,
          background: brand.bg,
        }}
      >
        <div>#</div>
        <div>Date</div>
        <div>Project</div>
        <div>Total</div>
        <div>Actions</div>
      </div>

      {loading && (
        <div style={{ padding: "12px 16px", color: brand.muted }}>Loading…</div>
      )}
      {error && (
        <div style={{ padding: "12px 16px", color: "#f87171" }}>{error}</div>
      )}
      {!loading && !error && estimates.length === 0 && (
        <div style={{ padding: "12px 16px", color: brand.muted }}>
          No saved estimates yet.
        </div>
      )}

      {!loading &&
        !error &&
        estimates.map((est) => {
          const padded = String(est.estimateNumber || 0).padStart(3, "0");
          const proj = est.projectSnapshot || {};
          const docProps = {
            estimate: est, // pass full estimate so PDF can use projectSnapshot fallbacks when needed
            selectedDiagram: {
              imageData: est?.diagram?.imageData || null,
              lines: Array.isArray(est?.diagram?.lines)
                ? est.diagram.lines
                : [],
            },
            activeModal: null,
            currentUser,
            logoUrl, // base64 logo you fetch in this component
            estimateData: {
              estimateNumber: String(est.estimateNumber || 0).padStart(3, "0"),
              estimateDate: est.estimateDate || "",
              paymentDue: est.paymentDue || "Upon completion.", // ensure default text
              notes: est.notes || "",
            },
            // IMPORTANT: pass the live project so Bill To has billingName/billingAddress/billingPrimaryPhone,
            // and Job Site can take projectName/projectAddress.
            // If you *don’t* have `project` in scope, keep passing whatever you already pass here
            // that contains those fields. Otherwise, we’ll fall back to estimate.projectSnapshot inside the PDF.
            project,

            products,
            items: (est.items || []).map((it) => ({
              name: it.name,
              quantity: Number(it.quantity || 0),
              price: Number(it.price || 0),
            })),
            // showPrices: true, // or whatever your toggle dictates for downloads
          };
          return (
            <div
              key={est._id}
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${brand.panel}`,
                display: "grid",
                gridTemplateColumns: "0.5fr 1fr 1fr 0.8fr 0.9fr",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div>{padded}</div>
              <div>{est.estimateDate || "—"}</div>
              <div>{project?.projectName || "—"}</div>
              <div>
                {Number(est.total || 0).toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "no-wrap" }}>
                <button
                  onClick={() => openViewer(est)}
                  style={{
                    background: "transparent",
                    color: brand.fg,
                    border: `1px solid ${brand.border}`,
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  View
                </button>

                <PDFDownloadLink
                  document={<EstimatePDF {...docProps} />}
                  fileName={`Estimate-${padded}.pdf`}
                  style={{
                    background: brand.accent,
                    color: "#fff",
                    textDecoration: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    display: "inline-block",
                  }}
                >
                  {({ loading }) => (loading ? "Preparing…" : "Download")}
                </PDFDownloadLink>

                <button
                  onClick={() => handleDelete(est._id)}
                  style={{
                    background: "transparent",
                    color: brand.danger,
                    border: `1px solid ${brand.danger}`,
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}

      <EstimateViewerModal
        isOpen={viewerOpen}
        onClose={closeViewer}
        estimateId={activeEstimate?._id || null}
        fallbackEstimate={activeEstimate || null}
        currentUser={currentUser}
        products={products}
        selectedProject={project}
      />
    </div>
  );
}
