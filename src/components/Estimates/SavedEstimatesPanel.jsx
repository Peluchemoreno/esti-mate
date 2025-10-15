// src/components/Estimates/SavedEstimatesPanel.jsx
import { useEffect, useState } from "react";
import EstimateViewerModal from "../Estimates/EstimateViewerModal";

const BASE_URL = import.meta.env.VITE_API_URL;

const brand = {
  bg: "#000000",
  fg: "var(--white)",
  panel: "#111111",
  border: "var(--white)",
  accent: "var(--blue-primary)",
  muted: "#aaa",
  danger: "#ef4444",
};

// Module-scope in-memory blob cache for this tab/session
// key: `${estimateId}|${updatedAt}` -> Blob
const pdfBlobCache = new Map();

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

  // Fetch company logo as data URL (for PDF)
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
  }, [BASE_URL, currentUser?._id, token]);

  // Initial load + auto-refresh on create/delete
  useEffect(() => {
    fetchEstimates();
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
      // refresh + notify
      await fetchEstimates();
      window.dispatchEvent(new Event("estimate-deleted"));
    } catch (e) {
      alert(e.message || "Failed to delete");
    }
  };

  async function downloadPDF(est) {
    if (!est?._id) return;
    const key = `${est._id}|${est.updatedAt || ""}`;

    // Use cached blob if available
    const cached = pdfBlobCache.get(key);
    if (cached) {
      const url = URL.createObjectURL(cached);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Estimate-${String(est.estimateNumber || 0).padStart(
        3,
        "0"
      )}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    // Fetch full detail only on demand
    const token = localStorage.getItem("jwt");
    const res = await fetch(`${BASE_URL}api/estimates/${est._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return alert("Failed to load estimate.");
    }
    const data = await res.json();
    const doc = data?.estimate;
    if (!doc) return alert("Failed to load estimate.");

    // Lazy-load heavy libs when needed
    const [{ pdf }, { default: EstimatePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("../EstimatePDF/EstimatePDF"),
    ]);

    const paddedNum = String(doc.estimateNumber || 0).padStart(3, "0");

    // Minimal, stable props into the PDF doc (no extra work)
    const element = (
      <EstimatePDF
        selectedDiagram={{
          imageData: doc?.diagram?.imageData || null,
          lines: Array.isArray(doc?.diagram?.lines) ? doc.diagram.lines : [],
          accessories: doc?.accessories || undefined,
        }}
        currentUser={currentUser}
        logoUrl={logoUrl}
        estimateData={{
          estimateNumber: paddedNum,
          estimateDate: doc.estimateDate || "",
          paymentDue: doc.paymentDue || "Upon completion.",
          notes: doc.notes || "",
        }}
        project={{
          // Keep modal/viewer precedence: prefer live project info, fall back to snapshot
          billingName:
            project?.billingName ?? doc?.projectSnapshot?.billingName ?? "",
          billingAddress:
            project?.billingAddress ??
            doc?.projectSnapshot?.billingAddress ??
            "",
          billingPrimaryPhone:
            project?.billingPrimaryPhone ??
            doc?.projectSnapshot?.billingPrimaryPhone ??
            "",
          projectName:
            project?.projectName ??
            doc?.projectSnapshot?.projectName ??
            project?.name ??
            "",
          projectAddress:
            project?.projectAddress ??
            doc?.projectSnapshot?.projectAddress ??
            project?.address ??
            "",
          name: project?.projectName ?? doc?.projectSnapshot?.projectName ?? "",
          address:
            project?.projectAddress ??
            doc?.projectSnapshot?.projectAddress ??
            "",
        }}
        items={(doc.items || []).map((it) => ({
          name: it.name,
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),
        }))}
        showPrices={true}
      />
    );

    const blob = await pdf(element).toBlob();
    pdfBlobCache.set(key, blob);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Estimate-${paddedNum}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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

                <button
                  onClick={() => downloadPDF(est)}
                  style={{
                    background: brand.accent,
                    color: "#fff",
                    textDecoration: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    display: "inline-block",
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  Download
                </button>

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
