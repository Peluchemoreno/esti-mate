// src/components/Estimates/EstimateViewerModal.jsx
import Modal from "react-modal";
import { useEffect, useMemo, useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import EstimatePDF from "../EstimatePDF/EstimatePDF";
const BASE_URL = import.meta.env.VITE_API_URL;
Modal.setAppElement("#root");

function getIncludedPhotoIdsFromAny(doc) {
  if (!doc) return [];
  const direct =
    doc?.diagram?.includedPhotoIds ??
    doc?.selectedDiagram?.includedPhotoIds ??
    doc?.includedPhotoIds;

  if (Array.isArray(direct)) return direct;

  if (Array.isArray(doc?.diagrams)) {
    for (const d of doc.diagrams) {
      if (Array.isArray(d?.includedPhotoIds) && d.includedPhotoIds.length) {
        return d.includedPhotoIds;
      }
    }
  }
  return [];
}

function pickProjectId(doc, selectedProject) {
  return (
    selectedProject?._id ||
    doc?.projectId ||
    doc?.project?._id ||
    doc?.projectSnapshot?.projectId ||
    doc?.projectSnapshot?._id ||
    ""
  );
}

const brand = {
  bg: "#000000",
  fg: "var(--white)",
  border: "var(--white)",
};

export default function EstimateViewerModal({
  isOpen,
  onClose,
  estimateId,
  fallbackEstimate, // optional preloaded doc (from list row)
  currentUser,
  selectedProject, // <-- live project (has billingName, etc.)
  products,
}) {
  const canInlinePDF =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 769px)").matches &&
    !/iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
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
        console.groupCollapsed("📄 Estimate PDF Performance (Viewer)");
        console.table(rows);
        console.groupEnd();
      }
      performance.clearMarks();
      performance.clearMeasures();
    } catch {}
  }

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("jwt") ||
        localStorage.jwt ||
        localStorage.getItem("token")
      : null;

  const [doc, setDoc] = useState(() => fallbackEstimate || null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // Measure the preview render time once we have a doc and can inline
  useEffect(() => {
    if (!__DEV__) return;
    if (!isOpen || !canInlinePDF || !doc) return;
    // Mark "start" just before next paint that shows the PDF
    pdfMark("PDF/Preview render:start");
    // Finish on next frame after layout/paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        pdfMark("PDF/Preview render:end");
        pdfMeasure(
          "PDF/Preview render",
          "PDF/Preview render:start",
          "PDF/Preview render:end"
        );
        pdfReportAndClear();
      }, 0);
    });
  }, [__DEV__, isOpen, canInlinePDF, doc]);

  // fetch the estimate by id when opened
  // Fetch estimate by id when opened (viewer needs full doc: diagram, items, includedPhotoIds)
  useEffect(() => {
    if (!isOpen) return;

    // show whatever we already have immediately (thin list row), then hydrate with full doc
    setDoc(fallbackEstimate || null);

    if (!estimateId || !token) return;

    let cancelled = false;
    setLoading(true);

    fetch(`${BASE_URL}api/estimates/${estimateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (cancelled) return;

        const fetched = data?.estimate || null;
        const fallback = fallbackEstimate || null;

        if (!fetched) {
          setDoc(fallback || null);
          return;
        }

        const fetchedIds = getIncludedPhotoIdsFromAny(fetched);
        const fallbackIds = getIncludedPhotoIdsFromAny(fallback);

        // ✅ If fetched doc doesn't include includedPhotoIds, preserve from fallback.
        if (!fetchedIds.length && fallbackIds.length) {
          const merged = { ...fetched };

          if (merged.diagram) {
            merged.diagram = {
              ...merged.diagram,
              includedPhotoIds: fallbackIds,
            };
          } else if (merged.selectedDiagram) {
            merged.selectedDiagram = {
              ...merged.selectedDiagram,
              includedPhotoIds: fallbackIds,
            };
          } else {
            merged.diagram = { includedPhotoIds: fallbackIds };
          }

          setDoc(merged);
          return;
        }

        setDoc(fetched);
      })

      .catch((err) => {
        console.warn(
          "[EstimateViewerModal] Failed to load full estimate:",
          err
        );
        if (!cancelled) setDoc(fallbackEstimate || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, estimateId, token, fallbackEstimate]);

  // company logo as base64 (so @react-pdf can embed it)
  useEffect(() => {
    if (!isOpen || !token || !currentUser?._id) return;
    fetch(`${BASE_URL}users/${currentUser._id}/logo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(res)))
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(blob);
          })
      )
      .then((b64) => setLogoUrl(b64))
      .catch((err) => {
        console.warn("No logo or failed to load logo:", err);
        setLogoUrl(null);
      });
  }, [isOpen, token, currentUser?._id]);

  // Build the exact props EstimatePDF expects, preferring selectedProject over snapshot
  function buildItemsFromSaved(doc) {
    try {
      const rows = [];
      const diagram = doc?.diagram || {};
      const lines = Array.isArray(diagram.lines) ? diagram.lines : [];
      const accessories = doc?.accessories?.items || doc?.accessoryItems || [];
      lines.forEach((l) => {
        if (l.isNote || l.isFreeMark) return;
        if (l.isDownspout) {
          const qty = Number(l.totalFeet ?? l.measurement ?? 0);
          const unit = Number(l.price || l.currentProduct?.price || 0);
          const name =
            l.currentProduct?.name ||
            (l.downspoutSize
              ? String(l.downspoutSize).replace(/\s*/g, "") + " Downspout"
              : "Downspout");
          if (qty > 0 && unit >= 0)
            rows.push({ name, quantity: qty, price: unit });
          return;
        }
        // gutter lines
        if (l.currentProduct && Number((l.runFeet ?? l.measurement) || 0) > 0) {
          rows.push({
            name: l.currentProduct.name,
            quantity: Number((l.runFeet ?? l.measurement) || 0),
            price: Number(l.currentProduct.price || 0),
          });
        }
      });
      (accessories || []).forEach((it) => {
        rows.push({
          name: it.name,
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),
        });
      });
      return rows;
    } catch {
      return [];
    }
  }
  // Build the exact props EstimatePDF expects, preferring selectedProject over snapshot
  const pdfProps = useMemo(() => {
    if (!doc) return null;

    const snap = doc.projectSnapshot || {};
    const proj = selectedProject || {};

    // Number padded like preview
    const paddedNum = String(doc.estimateNumber || 0).padStart(3, "0");
    const includedPhotoIds = getIncludedPhotoIdsFromAny(doc);
    const projectId = pickProjectId(doc, selectedProject);

    // BILL TO — EXACT fields from live project first, then snapshot
    const billingName = proj.billingName ?? snap.billingName ?? "";
    const billingAddress = proj.billingAddress ?? snap.billingAddress ?? "";
    const billingPrimaryPhone =
      proj.billingPrimaryPhone ?? snap.billingPrimaryPhone ?? "";

    // JOB SITE — EXACT fields from live project first, then snapshot
    const projectName = proj.projectName ?? snap.projectName ?? proj.name ?? "";
    const projectAddress =
      proj.projectAddress ?? snap.projectAddress ?? proj.address ?? "";

    return {
      // Diagram / lines (prefer saved doc)
      selectedDiagram: {
        imageData:
          doc?.diagram?.imageData || doc?.selectedDiagram?.imageData || null,

        lines: Array.isArray(doc?.diagram?.lines)
          ? doc.diagram.lines
          : Array.isArray(doc?.selectedDiagram?.lines)
          ? doc.selectedDiagram.lines
          : [],

        accessories: doc?.accessories || undefined,

        // ✅ FIX: pull includedPhotoIds from the actual saved shape
        includedPhotoIds,
      },

      // ✅ FIX: EstimatePDF expects jwt at TOP LEVEL (not inside estimateData)
      jwt: token,

      // Identity / header info
      currentUser,
      logoUrl,
      estimateData: {
        estimateNumber: paddedNum,
        estimateDate: doc.estimateDate || "",
        paymentDue: doc.paymentDue || "Upon completion.", // ensure default with period
        notes: doc.notes || "",
      },

      // ✅ FIX: ensure project._id exists so EstimatePDF can build photo URLs
      project: {
        _id: projectId,

        billingName,
        billingAddress,
        billingPrimaryPhone,
        projectName,
        projectAddress,

        // keep legacy fields too in case EstimatePDF reads name/address:
        name: projectName,
        address: projectAddress,
      },

      // Items saved with estimate (incl. impromptu)
      items: (Array.isArray(doc?.items) && doc.items.length
        ? doc.items
        : buildItemsFromSaved(doc)
      ).map((it) => ({
        name: it.name,
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
      })),

      // Pass-throughs
      products,
      showPrices: doc.showPrices ?? true,
      estimate: doc, // let PDF fall back to snapshot if ever needed
      extraItems: [], // not used for saved docs
    };
  }, [doc, selectedProject, currentUser, logoUrl, products, token]);

  const modalStyle = {
    overlay: { backgroundColor: "rgba(0,0,0,0.5)" },
    content: {
      width: "60%",
      height: "80%",
      margin: "auto",
      padding: 0,
      borderRadius: "10px",
      backgroundColor: brand.bg,
      border: `1px solid ${brand.border}`,
      color: brand.fg,
      display: "flex",
      flexDirection: "column",
    },
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="View Estimate"
      style={modalStyle}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${brand.border}`,
          display: "flex",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 700 }}>View Estimate</h3>
        <button
          onClick={onClose}
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
          Close
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {loading && <div style={{ padding: 16, color: "#aaa" }}>Loading…</div>}

        {canInlinePDF ? (
          <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
            {/* IMPORTANT: pass project via pdfProps.project (not selectedProject) */}
            <EstimatePDF {...pdfProps} />
          </PDFViewer>
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "auto",
              padding: 8,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Estimate Preview (mobile)</h3>
            <div
              style={{ border: "1px solid #333", padding: 8, borderRadius: 8 }}
            >
              {/* Very light summary to give visual parity */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold" }}>
                    {pdfProps?.project?.name || "Project"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {pdfProps?.estimateData?.estimateDate}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>
                    Estimate #{pdfProps?.estimateData?.estimateNumber || "—"}
                  </div>
                </div>
              </div>
              {pdfProps?.estimateData?.notes ? (
                <div style={{ fontSize: 12 }}>
                  <b>Notes:</b> {pdfProps.estimateData.notes}
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 12 }}>
              {/* If you have a persisted file URL, link it here. */}
              {/* Diagram preview */}
              {pdfProps?.selectedDiagram?.imageData ||
              (pdfProps?.selectedDiagram?.lines || []).length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                    Diagram
                  </div>
                  {pdfProps?.selectedDiagram?.imageData ? (
                    <img
                      alt="Diagram preview"
                      src={pdfProps.selectedDiagram.imageData}
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      (Vector diagram will render in the downloaded PDF)
                    </div>
                  )}
                </div>
              ) : null}

              {/* Items (same dataset passed to PDF) */}
              {(pdfProps?.items || []).length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                    Items
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 6,
                      fontSize: 14,
                    }}
                  >
                    {pdfProps.items.map((it, i) => (
                      <div key={i} style={{ display: "contents" }}>
                        <div>{it.name}</div>
                        <div style={{ textAlign: "right" }}>
                          {Number(it.quantity || 0)}
                        </div>
                        {pdfProps.showPrices ? (
                          <div style={{ textAlign: "right" }}>
                            ${Number(it.price || 0).toFixed(2)}
                          </div>
                        ) : (
                          <div />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {!loading && !pdfProps && (
          <div style={{ padding: 16, color: "#aaa" }}>
            Estimate not available.
          </div>
        )}
      </div>
    </Modal>
  );
}
