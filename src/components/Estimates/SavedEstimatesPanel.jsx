// src/components/Estimates/SavedEstimatesPanel.jsx
import { useEffect, useState } from "react";
import EstimateViewerModal from "../Estimates/EstimateViewerModal";
import { useToast } from "../Toast/Toast";

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

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

async function fetchProjectPhotoMeta(projectId, photoId, jwt) {
  const base = BASE_URL?.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  const res = await fetch(
    `${base}dashboard/projects/${projectId}/photos/${photoId}`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json?.photo || null; // { photo: { originalMeta, annotations, ... } }
}

async function fetchAuthedImageAsDataUrl(url, jwt) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`photo fetch failed ${res.status}`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

export default function SavedEstimatesPanel({
  projectId,
  currentUser,
  products,
  project,
}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
  const __DEV__ = true;
  function pdfMark(n) {
    if (!__DEV__) return;
    try {
      performance.mark(n);
    } catch {}
  }
  function pdfMeasure(n, a, b) {
    if (!__DEV__) return;
    try {
      performance.measure(n, a, b);
    } catch {}
  }
  function pdfReportAndClear() {
    if (!__DEV__) return;
    try {
      const rows = performance
        .getEntriesByType("measure")
        .filter((e) => e.name.startsWith("PDF/"))
        .map((e) => ({
          Stage: e.name.replace(/^PDF\//, ""),
          Duration_ms: e.duration.toFixed(2),
        }));
      if (rows.length) {
        console.groupCollapsed("📄 Estimate PDF Performance (Download)");
        console.table(rows);
        console.groupEnd();
      }
      performance.clearMarks();
      performance.clearMeasures();
    } catch {}
  }

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
        { headers: { Authorization: `Bearer ${token}` } },
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

  const toast = useToast();

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
          }),
      )
      .then((b64) => setLogoUrl(b64))
      .catch((err) => {
        console.warn(
          "No logo available or failed to load:",
          err?.message || err,
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
    const projectIdForPhotos = project?._id || doc?.projectId || projectId;
    if (!est?._id) return;

    const key = `${est._id}|${est.updatedAt || ""}`;
    const cached = pdfBlobCache.get(key);
    if (cached) {
      // Cached path: quick return, no heavy profiling
      const url = URL.createObjectURL(cached);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Estimate-${String(est.estimateNumber || 0).padStart(
        3,
        "0",
      )}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    if (__DEV__) console.time("Full PDF generation");
    let hadError = false;

    try {
      const token = localStorage.getItem("jwt");
      const res = await fetch(`${BASE_URL}api/estimates/${est._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load estimate.");
      const data = await res.json();
      const doc = data?.estimate;
      if (!doc) throw new Error("No estimate data found.");

      const ids = Array.isArray(doc?.diagram?.includedPhotoIds)
        ? doc.diagram.includedPhotoIds
        : [];

      let includedPhotoDataUrls = [];
      if (ids.length) {
        const projectIdForPhotos = project?._id || doc?.projectId || projectId;
        const base = BASE_URL?.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
        const urls = ids.map(
          (pid) =>
            `${base}dashboard/projects/${projectIdForPhotos}/photos/${pid}/image?variant=preview`,
        );

        // sequential to avoid memory spikes
        for (const u of urls) {
          const dataUrl = await fetchAuthedImageAsDataUrl(u, token);
          includedPhotoDataUrls.push(dataUrl);
        }
      }

      // ✅ Fetch annotation + originalMeta for included photos
      const includedPhotoAnnotationsById = {};
      const includedPhotoMetaById = {};

      if (ids.length) {
        for (const pid of ids) {
          const meta = await fetchProjectPhotoMeta(
            projectIdForPhotos,
            pid,
            token,
          ).catch(() => null);
          if (meta?.annotations?.items?.length) {
            includedPhotoAnnotationsById[pid] = meta.annotations;
          }
          const w = meta?.originalMeta?.width;
          const h = meta?.originalMeta?.height;
          if (
            typeof w === "number" &&
            typeof h === "number" &&
            w > 0 &&
            h > 0
          ) {
            includedPhotoMetaById[pid] = { width: w, height: h };
          }
        }
      }

      // Lazy imports with timings
      pdfMark("PDF/Import @react-pdf:start");
      pdfMark("PDF/Import EstimatePDF:start");

      const [{ pdf }, { default: EstimatePDF }] = await Promise.all([
        import("@react-pdf/renderer").then((m) => {
          pdfMark("PDF/Import @react-pdf:end");
          pdfMeasure(
            "PDF/Import @react-pdf",
            "PDF/Import @react-pdf:start",
            "PDF/Import @react-pdf:end",
          );
          return m;
        }),
        import("../EstimatePDF/EstimatePDF").then((m) => {
          pdfMark("PDF/Import EstimatePDF:end");
          pdfMeasure(
            "PDF/Import EstimatePDF",
            "PDF/Import EstimatePDF:start",
            "PDF/Import EstimatePDF:end",
          );
          return m;
        }),
      ]);

      const paddedNum = String(doc.estimateNumber || 0).padStart(3, "0");

      const element = (
        <EstimatePDF
          selectedDiagram={{
            imageData: doc?.diagram?.imageData || null,
            lines: Array.isArray(doc?.diagram?.lines) ? doc.diagram.lines : [],
            accessories: doc?.accessories || undefined,
            includedPhotoIds: ids,
          }}
          includedPhotoDataUrls={includedPhotoDataUrls}
          includedPhotoAnnotationsById={includedPhotoAnnotationsById}
          includedPhotoMetaById={includedPhotoMetaById}
          currentUser={currentUser}
          logoUrl={logoUrl}
          estimateData={{
            estimateNumber: paddedNum,
            estimateDate: doc.estimateDate || "",
            paymentDue: doc.paymentDue || "Upon completion.",
            notes: doc.notes || "",
          }}
          project={{
            _id: projectIdForPhotos,
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
            name:
              project?.projectName ?? doc?.projectSnapshot?.projectName ?? "",
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
          jwt={token}
        />
      );

      // Render to Blob with timings
      pdfMark("PDF/Render-to-Blob:start");
      const blob = await pdf(element).toBlob();
      pdfMark("PDF/Render-to-Blob:end");
      pdfMeasure(
        "PDF/Render-to-Blob",
        "PDF/Render-to-Blob:start",
        "PDF/Render-to-Blob:end",
      );

      pdfBlobCache.set(key, blob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Estimate-${paddedNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      hadError = true;
      console.error("PDF generation failed:", e);
      alert(e.message || "Failed to generate PDF.");
    } finally {
      if (__DEV__) {
        console.timeEnd("Full PDF generation");
        pdfReportAndClear();
      }
      if (hadError) return;
    }
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
        // ✅ scalable sizing variables
        "--panel-font": "clamp(11px, 2.8vw, 14px)",
        "--panel-btn-font": "clamp(11px, 2.6vw, 13px)",
        "--panel-btn-pad-y": "clamp(4px, 1.6vw, 6px)",
        "--panel-btn-pad-x": "clamp(6px, 2vw, 10px)",
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
        <h3
          style={{ margin: 0, fontWeight: 700, fontSize: "var(--panel-font)" }}
        >
          Saved Estimates
        </h3>
        <button
          onClick={fetchEstimates}
          style={{
            marginLeft: "auto",
            background: "transparent",
            color: brand.fg,
            border: `1px solid ${brand.border}`,
            borderRadius: 6,
            cursor: "pointer",
            padding: "var(--panel-btn-pad-y) var(--panel-btn-pad-x)",
            fontSize: "var(--panel-btn-font)",
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
          fontSize: "var(--panel-font)",

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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => openViewer(est)}
                  style={{
                    background: "transparent",
                    color: brand.fg,
                    border: `1px solid ${brand.border}`,
                    borderRadius: 6,
                    padding: "var(--panel-btn-pad-y) var(--panel-btn-pad-x)",
                    fontSize: "var(--panel-btn-font)",

                    cursor: "pointer",
                  }}
                >
                  View
                </button>

                <button
                  onClick={() => {
                    downloadPDF(est);
                    toast.success("File download started");
                  }}
                  style={{
                    background: brand.accent,
                    color: "#fff",
                    textDecoration: "none",
                    borderRadius: 6,
                    display: "inline-block",
                    cursor: "pointer",
                    border: "none",
                    padding: "var(--panel-btn-pad-y) var(--panel-btn-pad-x)",
                    fontSize: "var(--panel-btn-font)",
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
                    cursor: "pointer",
                    padding: "var(--panel-btn-pad-y) var(--panel-btn-pad-x)",
                    fontSize: "var(--panel-btn-font)",
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
