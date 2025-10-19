// src/components/EstimateModal/EstimateModal.jsx
import Modal from "react-modal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeAccessoriesFromLines } from "../../utils/priceResolver";

const BASE_URL = import.meta.env.VITE_API_URL;

Modal.setAppElement("#root");

// ——— helpers ———
const prettyDsName = (raw = "") =>
  String(raw)
    .replace(
      /(\d+\s*x\s*\d+)\s*corrugated/i,
      (_m, size) => `${size.replace(/\s*/g, "")} Corrugated`
    )
    .replace(/\s+/g, " ")
    .trim();

function foldItems(items) {
  const map = new Map();

  (items || []).forEach((it) => {
    const m = it?.meta || {};
    const kind = (m.kind === "endcap" ? "endCap" : m.kind) || "";

    const isAccessory =
      kind === "miter" ||
      kind === "endCap" ||
      kind === "elbow" ||
      kind === "offset";

    // back-compat tolerances
    const miterType = m.type || m.miterType || ""; // 'Strip' | 'Bay' | 'Custom'
    const degrees = m.degrees ?? m.angle ?? ""; // keep angle for custom
    const code = m.code || m.letter || ""; // 'A' | 'B' for elbows
    const inches = m.inches || ""; // '2' | '4' | '6' for offsets
    const side = m.side || "";
    const size = m.size || m.sizeLabel || ""; // '2x3' | '3x4' | '3"' | '4"'
    const profile = m.profileKey || m.profile || "";

    const key = isAccessory
      ? [
          kind,
          String(miterType).toLowerCase(),
          String(degrees),
          String(code).toUpperCase(),
          String(inches),
          String(side),
          String(size),
          String(profile),
          String(it.name || ""), // tie-breaker so renamed customs don't merge
        ].join("|")
      : it.product?._id ||
        [
          String(it.name || ""),
          kind,
          String(miterType).toLowerCase(),
          String(code).toUpperCase(),
          String(inches),
          String(side),
          String(size),
          String(degrees),
          String(profile),
        ].join("|");

    const prev = map.get(key);
    if (prev) {
      prev.quantity = Number(prev.quantity || 0) + Number(it.quantity || 0);
    } else {
      map.set(key, { ...it, quantity: Number(it.quantity || 0) });
    }
  });

  return Array.from(map.values());
}

// lazy import for the PDF document component
let EstimatePDFMod = null;
async function importEstimatePDF() {
  if (!EstimatePDFMod) {
    const m = await import("../EstimatePDF/EstimatePDF");
    EstimatePDFMod = m.default || m;
  }
  return EstimatePDFMod;
}

// render React-PDF element -> Blob (lazy import renderer)
async function renderEstimateToBlob(EstimatePDF, props) {
  const { pdf } = await import("@react-pdf/renderer");
  const element = <EstimatePDF {...props} />;
  return pdf(element).toBlob();
}

// Optional downscale to keep image small for faster PDF render
async function maybeDownscaleDataUrl(dataUrl, maxSize = 1200) {
  try {
    if (!dataUrl || typeof createImageBitmap !== "function") return dataUrl;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const { width, height } = bmp;
    const long = Math.max(width, height);
    if (long <= maxSize) {
      bmp.close?.();
      return dataUrl;
    }
    const scale = maxSize / long;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    bmp.close?.();
    return out;
  } catch {
    return dataUrl;
  }
}

// ——— component ———
const EstimateModal = ({
  isOpen,
  onClose,
  estimate,
  project,
  selectedDiagram,
  setSelectedDiagram,
  activeModal,
  currentUser,
  products, // visible catalog (listed: true)
}) => {
  const isSmallScreen =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;

  const canInlinePDF =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 769px)").matches &&
    !/iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

  const [logoUrl, setLogoUrl] = useState(null);
  const [pricingCatalog, setPricingCatalog] = useState(null);

  // immutable meta (auto-only)
  const [estimateData, setEstimateData] = useState({
    estimateNumber: estimate?.number || "001",
    estimateDate: new Date().toISOString().split("T")[0],
    paymentDue: "Upon completion",
    notes: estimate?.notes || "",
  });

  // notes draft: only commit when clicking "Save Notes"
  const [notesDraft, setNotesDraft] = useState(estimateData.notes);

  // ad-hoc (preview only, per-project bucket)
  const [adHocItemsByProject, setAdHocItemsByProject] = useState({});
  const pid = project?._id || "none";
  const adHocItems = adHocItemsByProject[pid] || [];

  // project-scoped draft; “setAdHocDraft” is a local helper, not a state setter
  const [adHocDraftByProject, setAdHocDraftByProject] = useState({});
  const adHocDraft = adHocDraftByProject[pid] || {
    name: "",
    quantity: 1,
    price: 0,
  };
  const setAdHocDraft = (patch) =>
    setAdHocDraftByProject((prev) => ({
      ...prev,
      [pid]: {
        ...(prev[pid] || { name: "", quantity: 1, price: 0 }),
        ...patch,
      },
    }));

  const addAdHocFromDraft = () => {
    const name = String(adHocDraft.name || "").trim();
    const quantity = Number(adHocDraft.quantity || 0);
    const price = Number(adHocDraft.price || 0);
    if (!name) return alert("Enter an item name.");
    if (quantity < 0) return alert("Quantity cannot be negative.");
    if (price < 0) return alert("Price cannot be negative.");

    setAdHocItemsByProject((prev) => {
      const list = prev[pid] || [];
      return {
        ...prev,
        [pid]: [
          ...list,
          {
            id: crypto.randomUUID?.() || String(Date.now()),
            name,
            quantity,
            price,
          },
        ],
      };
    });

    // reset the draft without rerendering the PDF
    setAdHocDraft({ name: "", quantity: 1, price: 0 });
  };

  const [showPrices, setShowPrices] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setSelectedDiagram({});
    }
  }, [isOpen, setSelectedDiagram]);

  // company logo (to data URL)
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (token && currentUser?._id) {
      fetch(`${BASE_URL}users/${currentUser._id}/logo`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.blob())
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
        .catch((err) =>
          console.error("Failed to fetch and convert logo:", err)
        );
    }
  }, [BASE_URL, activeModal, currentUser?._id]);

  // fetch full catalog for pricing (includes unlisted); fallback to visible products
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!isOpen || !token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}dashboard/products?scope=pricing`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!cancelled)
          setPricingCatalog(Array.isArray(j.products) ? j.products : null);
      } catch (e) {
        console.warn(
          "pricing catalog fetch failed; falling back to visible products only:",
          e?.message || e
        );
        if (!cancelled) setPricingCatalog(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [BASE_URL, isOpen]);

  // Refresh source products when catalog changes so computed accessories re-map immediately
  useEffect(() => {
    const onBump = () => {
      setNotesDraft((s) => s);
    };
    const onStorage = (e) => {
      if (e.key === "catalogVersion") onBump();
    };
    window.addEventListener("catalog:updated", onBump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("catalog:updated", onBump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // per-user estimate auto-number (DB source of truth)
  useEffect(() => {
    if (!isOpen) return;

    const token = localStorage.getItem("jwt");
    if (!token || !currentUser?._id) {
      // still update date so the PDF header isn't stale
      setEstimateData((s) => ({
        ...s,
        estimateDate: new Date().toISOString().split("T")[0],
      }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}api/estimates/next`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { next } = await res.json();

        if (!cancelled) {
          // ensure date is fresh too
          setEstimateData((s) => ({
            ...s,
            estimateNumber: String(next).padStart(3, "0"),
            estimateDate: new Date().toISOString().split("T")[0],
          }));
        }
      } catch (e) {
        alert(e.message || "Failed to fetch next estimate number.");
        // Don’t fabricate a number here; keep it empty to avoid conflicts
        if (!cancelled) {
          setEstimateData((s) => ({
            ...s,
            estimateNumber: "",
            estimateDate: new Date().toISOString().split("T")[0],
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [BASE_URL, isOpen, currentUser?._id]);

  // Choose catalog for pricing — prefer full pricing catalog if loaded
  const catalogForPricing = pricingCatalog || products;

  function itemsFromAccessoryData(accessoryData = []) {
    const out = [];

    accessoryData.forEach((bucket) => {
      if (!bucket || typeof bucket !== "object") return;
      Object.entries(bucket).forEach(([profileKey, arr]) => {
        (arr || []).forEach((entry) => {
          const type = String(entry?.type || "");
          const product = entry?.product || null;
          const qty = Number(entry?.quantity || 0);
          const price = Number(entry?.price || product?.price || 0);
          if (!product || !qty) return;

          // End caps
          if (/end\s*cap/i.test(type)) {
            out.push({
              name: product.name,
              quantity: qty,
              price,
              product,
              meta: {
                kind: "endCap",
                profileKey, // e.g., 5" K-Style
              },
            });
            return;
          }

          // Strip/Bay/Custom miters
          if (/miter/i.test(type)) {
            let miterType = "";
            let degrees = null;

            if (/strip/i.test(type)) miterType = "Strip";
            else if (/bay/i.test(type)) miterType = "Bay";
            else if (/custom/i.test(type)) miterType = "Custom";

            const m = type.match(/(\d+)\s*°/);
            if (m) degrees = Number(m[1]);
            if (degrees == null && entry?.angle != null) {
              const d = Number(entry.angle);
              if (!Number.isNaN(d)) degrees = d;
            }

            const nameOverride =
              miterType === "Custom" && degrees != null
                ? `Custom Miter (${degrees}°)`
                : product.name;

            out.push({
              name: nameOverride,
              quantity: qty,
              price,
              product,
              meta: {
                kind: "miter",
                type: miterType,
                miterType,
                degrees: degrees ?? undefined,
                profileKey,
              },
            });
          }
        });
      });
    });

    return out;
  }

  const computedAccessories = useMemo(() => {
    const eo = computeAccessoriesFromLines(
      selectedDiagram?.lines || [],
      catalogForPricing || [],
      {}
    );
    const me = itemsFromAccessoryData(selectedDiagram?.accessoryData || []);
    return [...eo, ...me];
  }, [
    selectedDiagram?.lines,
    selectedDiagram?.accessoryData,
    catalogForPricing,
  ]);

  const mergedAccessories = useMemo(
    () => computedAccessories,
    [computedAccessories]
  );

  // —— define BEFORE any hook that references it ——
  const buildSavableItems = useCallback(() => {
    const rows = [];

    // 1) Base priced lines (gutters, downspouts)
    (selectedDiagram?.lines || []).forEach((l) => {
      // skip notes/free marks
      if (l.isNote || l.isFreeMark) return;

      if (l.isDownspout) {
        const qty = Number(l.measurement || 0);
        const unit = Number(l.price || l.currentProduct?.price || 0);
        const name =
          l.currentProduct?.name ||
          (l.downspoutSize ? `${l.downspoutSize} Downspout` : "Downspout");
        if (qty > 0 && unit >= 0) {
          rows.push({ name, quantity: qty, price: unit });
        }
        return;
      }

      // gutter lines
      if (l.currentProduct && Number(l.measurement || 0) > 0) {
        rows.push({
          name: l.currentProduct.name,
          quantity: Number(l.measurement || 0),
          price: Number(l.currentProduct.price || 0),
        });
      }
    });

    // 2) Accessories (merged) — use their own unit price
    (mergedAccessories || []).forEach((it) => {
      rows.push({
        name: it.name,
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
      });
    });

    // 3) Impromptu items
    (adHocItems || []).forEach((it) => {
      rows.push({
        name: it.name || "Custom",
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
      });
    });

    return Object.freeze(foldItems(rows));
  }, [selectedDiagram?.lines, mergedAccessories, adHocItems]);

  // define BEFORE handleSaveAndClose (it depends on this)
  const handleCloseModal = useCallback(() => {
    // clear the diagram selection when the modal closes
    setSelectedDiagram({});
    if (onClose) onClose();
  }, [onClose, setSelectedDiagram]);

  // commit notes — inside component scope
  const commitNotes = useCallback(() => {
    setEstimateData((prev) => ({
      ...prev,
      notes: notesDraft || "",
    }));
  }, [notesDraft]);

  // ======= PDF preview via blob + <iframe> with debounce & guards =======
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const abortRef = useRef({ aborted: false });
  const timerRef = useRef(0);

  // small, stable signature for rebuilds (avoid stringifying big objects)
  const pdfKey = useMemo(() => {
    const d = selectedDiagram || {};
    const imgLen = d.imageData ? d.imageData.length : 0;
    const linesN = Array.isArray(d.lines) ? d.lines.length : 0;
    const accN = Array.isArray(mergedAccessories)
      ? mergedAccessories.length
      : 0;
    const itemsN =
      (Array.isArray(adHocItems) ? adHocItems.length : 0) +
      (Array.isArray(buildSavableItems()) ? buildSavableItems().length : 0);
    const show = showPrices ? 1 : 0;
    const date = estimateData?.estimateDate || "";
    const num = estimateData?.estimateNumber || "";
    const logo = logoUrl ? 1 : 0;
    return [imgLen, linesN, accN, itemsN, show, date, num, logo].join("|");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDiagram?.imageData,
    selectedDiagram?.lines,
    mergedAccessories,
    adHocItems,
    buildSavableItems,
    showPrices,
    estimateData?.estimateDate,
    estimateData?.estimateNumber,
    logoUrl,
  ]);

  // now it’s safe to define this: it references buildSavableItems + handleCloseModal
  const handleSaveAndClose = useCallback(async () => {
    try {
      const token = localStorage.getItem("jwt");
      if (!token) throw new Error("Not authenticated.");

      const projectIdToSend = project?._id || project?.id || "";
      if (!projectIdToSend) throw new Error("Missing projectId.");

      const diagramLines = Array.isArray(selectedDiagram?.lines)
        ? selectedDiagram.lines
        : [];
      const diagramImage = selectedDiagram?.imageData || null;
      if (!diagramLines.length && !diagramImage) {
        throw new Error("Missing diagram.");
      }

      const items = buildSavableItems();

      const body = {
        projectId: projectIdToSend,
        projectSnapshot: {
          name: project?.projectName || "",
          address: project?.address || "",
        },
        diagram: {
          imageData: diagramImage,
          lines: diagramLines,
        },
        items,
        estimateDate: estimateData.estimateDate,
        notes: estimateData.notes || "",
      };

      const res = await fetch(`${BASE_URL}api/estimates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      // notify the SavedEstimatesPanel to refresh
      window.dispatchEvent(new Event("estimate-created"));

      handleCloseModal();
    } catch (e) {
      alert(e.message || "Failed to save estimate.");
    }
  }, [
    BASE_URL,
    estimateData.estimateDate,
    estimateData.notes,
    project,
    selectedDiagram,
    buildSavableItems,
    handleCloseModal,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      if (isRendering) return; // prevent overlap
      let revoke;
      abortRef.current.aborted = false;
      setIsRendering(true);

      try {
        // allow modal to paint first
        await new Promise((r) => setTimeout(r, 0));

        const Doc = await importEstimatePDF();

        // build normalized props snapshot
        const normalizedLines = (selectedDiagram?.lines || []).map((l) =>
          l.isDownspout
            ? { ...l, downspoutSize: prettyDsName(l.downspoutSize) }
            : l
        );

        const prepared = {
          estimate,
          selectedDiagram: {
            ...selectedDiagram,
            lines: normalizedLines,
            accessories: { items: mergedAccessories },
          },
          items: buildSavableItems(),
          currentUser,
          logoUrl,
          estimateData,
          project,
          products,
          showPrices,
          extraItems: adHocItems,
        };

        // shrink diagram image if huge
        if (prepared.selectedDiagram?.imageData) {
          const downsized = await maybeDownscaleDataUrl(
            prepared.selectedDiagram.imageData
          );
          if (abortRef.current.aborted) return;
          prepared.selectedDiagram.imageData = downsized;
        }

        if (abortRef.current.aborted) return;
        const blob = await renderEstimateToBlob(Doc, prepared);
        if (abortRef.current.aborted) return;

        const url = URL.createObjectURL(blob);
        revoke = () => URL.revokeObjectURL(url);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e) {
        console.error("PDF render failed:", e);
      } finally {
        if (!abortRef.current.aborted) setIsRendering(false);
      }
    }, 300); // debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current.aborted = true;
    };
  }, [
    isOpen,
    pdfKey,
    // NOTE: do not depend directly on large objects to avoid thrash
  ]);

  const headerBar = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <h2 style={{ margin: 0 }}>Estimate Preview</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--white)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showPrices}
            onChange={(e) => setShowPrices(e.target.checked)}
          />
          Show prices
        </label>

        <button
          onClick={commitNotes}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--white)",
            background: "transparent",
            color: "var(--white)",
            cursor: "pointer",
          }}
        >
          Save Notes
        </button>

        <button
          onClick={handleSaveAndClose}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #19c37d",
            background: "#19c37d",
            color: "#000",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save & Close
        </button>
      </div>
    </div>
  );

  // modal
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleCloseModal}
      contentLabel="Estimate Preview"
      style={{
        overlay: { backgroundColor: "rgba(0,0,0,0.5)" },
        content: isSmallScreen
          ? {
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: "12px",
              backgroundColor: "#000",
              border: "1px solid var(--white)",
              color: "var(--white)",
              overflow: "hidden",
              borderRadius: 0,
            }
          : {
              width: "60%",
              height: "80%",
              margin: "auto",
              padding: "20px",
              backgroundColor: "#000",
              border: "1px solid var(--white)",
              color: "var(--white)",
              overflow: "hidden",
              borderRadius: "10px",
            },
      }}
    >
      {headerBar}

      {/* Controls: notes + ad-hoc list */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          alignItems: "start",
          marginBottom: 12,
        }}
      >
        <div style={{ flex: "1 1 280px" }}>
          <label style={{ display: "block", marginBottom: 6 }}>Notes:</label>
          <input
            type="text"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNotes();
              }
            }}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add a short note for the diagram page…"
            style={{
              width: "100%",
              height: 38,
              borderRadius: 8,
              border: "1px solid var(--white)",
              background: "transparent",
              color: "var(--white)",
              padding: "0 8px",
            }}
          />
        </div>

        <div style={{ flex: "1 1 300px" }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            Add custom items:
          </label>

          {/* ONE-LINE ADDER: Name, Qty, Price, Add */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 80px 100px 80px",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <input
              value={adHocDraft.name}
              onChange={(e) => setAdHocDraft({ name: e.target.value })}
              placeholder="Item name"
              style={{
                borderRadius: 6,
                padding: 6,
                background: "transparent",
                color: "#fff",
                border: "1px solid #666",
              }}
            />
            <input
              type="number"
              min={0}
              value={adHocDraft.quantity}
              onChange={(e) =>
                setAdHocDraft({ quantity: Number(e.target.value || 0) })
              }
              placeholder="Qty"
              style={{
                borderRadius: 6,
                padding: 6,
                background: "transparent",
                color: "#fff",
                border: "1px solid #666",
              }}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={adHocDraft.price}
              onChange={(e) =>
                setAdHocDraft({ price: Number(e.target.value || 0) })
              }
              placeholder="Unit Price"
              style={{
                borderRadius: 6,
                padding: 6,
                background: "transparent",
                color: "#fff",
                border: "1px solid #666",
              }}
            />
            <button
              onClick={addAdHocFromDraft}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--white)",
                background: "transparent",
                color: "var(--white)",
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>

          {/* READ-ONLY LIST of committed items */}
          <div style={{ display: "grid", gap: 6 }}>
            {adHocItems.length === 0 ? (
              <div style={{ color: "#aaa", fontSize: 12 }}>
                No items added yet.
              </div>
            ) : (
              adHocItems.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 80px 100px 28px",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div
                    title={it.name}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.name}
                  </div>
                  <div style={{ textAlign: "right" }}>{it.quantity}</div>
                  <div style={{ textAlign: "right" }}>
                    ${Number(it.price || 0).toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeAdHoc(it.id)}
                    title="Remove"
                    style={{
                      borderRadius: 6,
                      border: "1px solid #666",
                      background: "transparent",
                      color: "#fff",
                      cursor: "pointer",
                      padding: 6,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PDF area: visually identical container */}
      <div
        style={{ width: "100%", height: "calc(100% - 210px)", minHeight: 0 }}
      >
        {canInlinePDF ? (
          !pdfUrl ? (
            <div style={{ padding: 8 }}>Loading preview…</div>
          ) : (
            <iframe
              title="Estimate Preview"
              src={pdfUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          )
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "auto",
              padding: 8,
            }}
          >
            {/* Lightweight HTML fallback preview */}
            <h3 style={{ marginTop: 0 }}>Estimate Preview (mobile)</h3>
            <div
              style={{ border: "1px solid #333", padding: 8, borderRadius: 8 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold" }}>
                    {project?.name || "Project"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {estimateData?.estimateDate}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>Estimate #{estimateData?.estimateNumber || "—"}</div>
                  <div style={{ fontWeight: "bold" }}>
                    {showPrices
                      ? "Amount Due: $" +
                        (Array.isArray(items)
                          ? items
                              .reduce(
                                (s, it) =>
                                  s +
                                  Number(it.price || 0) *
                                    Number(it.quantity || 0),
                                0
                              )
                              .toFixed(2)
                          : "0.00")
                      : "Prices hidden"}
                  </div>
                </div>
              </div>

              <div>
                {Array.isArray(items) && items.length ? (
                  items.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: showPrices
                          ? "1fr 60px 100px"
                          : "1fr 80px",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px solid #222",
                      }}
                    >
                      <div style={{ fontSize: 12 }}>{it.name}</div>
                      <div style={{ textAlign: "right", fontSize: 12 }}>
                        {Number(it.quantity || 0)}
                      </div>
                      {showPrices ? (
                        <div style={{ textAlign: "right", fontSize: 12 }}>
                          $
                          {(
                            Number(it.price || 0) * Number(it.quantity || 0)
                          ).toFixed(2)}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>No items</div>
                )}
              </div>

              {estimateData?.notes ? (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <b>Notes:</b> {estimateData.notes}
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: 12 }}>
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  download={`Estimate-${
                    estimateData?.estimateNumber || ""
                  }.pdf`}
                  style={{
                    display: "inline-block",
                    padding: "8px 12px",
                    border: "1px solid #666",
                    borderRadius: 6,
                    textDecoration: "none",
                    color: "#fff",
                  }}
                >
                  Download PDF
                </a>
              ) : (
                <button
                  disabled
                  style={{ padding: 8, borderRadius: 6, opacity: 0.6 }}
                >
                  Preparing PDF…
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EstimateModal;
