// src/components/EstimateModal/EstimateModal.jsx
import Modal from "react-modal";
import { PDFViewer } from "@react-pdf/renderer";
import EstimatePDF from "../EstimatePDF/EstimatePDF";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// Commit the notesDraft into estimateData.notes (same as your Save Notes button)
const commitNotes = () => {
  setEstimateData((prev) => ({
    ...prev,
    notes: notesDraft || "",
  }));
};

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

// ——— component ———
const EstimateModal = ({
  isOpen,
  onClose,
  estimate,
  project,
  selectedDiagram,
  activeModal,
  currentUser,
  products, // visible catalog (listed: true)
}) => {
  const [logoUrl, setLogoUrl] = useState(null);

  // NEW: full catalog for pricing (includes unlisted elbows/offsets)
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

  // add this just after adHocItemsByProject / pid
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

  // commit draft into the real list (this is what triggers the PDF update)
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

  // price column toggle
  const [showPrices, setShowPrices] = useState(true);

  const handleSaveAndClose = async () => {
    try {
      const token = localStorage.getItem("jwt");
      if (!token) throw new Error("Not authenticated.");

      // ✅ robust project id: support both _id and id
      const projectIdToSend = project?._id || project?.id || "";
      if (!projectIdToSend) throw new Error("Missing projectId.");

      // ✅ ensure a diagram payload exists (server expects diagram)
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

      onClose();
    } catch (e) {
      alert(e.message || "Failed to save estimate.");
    }
  };

  // company logo
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
  }, [activeModal, currentUser?._id]);

  // NEW: fetch full catalog just for pricing (includes unlisted)
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
  }, [isOpen]);

  // Refresh source products when catalog changes so computed accessories re-map immediately
  useEffect(() => {
    const onBump = () => {
      setNotesDraft((s) => s);
    };
    window.addEventListener("catalog:updated", onBump);
    window.addEventListener("storage", (e) => {
      if (e.key === "catalogVersion") onBump();
    });
    return () => {
      window.removeEventListener("catalog:updated", onBump);
      window.removeEventListener("storage", (e) => {
        if (e.key === "catalogVersion") onBump();
      });
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
  }, [isOpen, currentUser?._id]);

  // Choose catalog for pricing — prefer full pricing catalog if loaded
  const catalogForPricing = pricingCatalog || products;

  // Convert selectedDiagram.accessoryData (the tallies you saved earlier)
  // into the same "items" shape we fold for the PDF.
  //
  // accessoryData looks like:
  // [ { '5" K-Style': [ { type:'End Cap', price, quantity, product }, ... ] }, ... ]
  function itemsFromAccessoryData(accessoryData = []) {
    const out = [];
    const norm = (s) => String(s || "").toLowerCase();

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
              name: product.name, // e.g., 5" K-Style End Cap
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
            // Derive miterType + degrees from the "type" OR from entry.angle
            let miterType = "";
            let degrees = null;

            if (/strip/i.test(type)) miterType = "Strip";
            else if (/bay/i.test(type)) miterType = "Bay";
            else if (/custom/i.test(type)) miterType = "Custom";

            // Try to extract angle if present in "Custom Miter (9°)" OR entry.angle
            const m = type.match(/(\d+)\s*°/);
            if (m) degrees = Number(m[1]);
            if (degrees == null && entry?.angle != null) {
              const d = Number(entry.angle);
              if (!Number.isNaN(d)) degrees = d;
            }

            // Optional: override visible name for customs to show angle explicitly
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
                type: miterType, // server-canonical field
                // keep extra fields to avoid any merging later
                miterType, // tolerate client shape elsewhere
                degrees: degrees ?? undefined,
                profileKey,
              },
            });
            return;
          }
        });
      });
    });

    return out;
  }

  // Accessories (elbows/offsets/miters/end caps) computed live
  const computedAccessories = useMemo(() => {
    // elbows/offsets computed from live lines
    const eo = computeAccessoriesFromLines(
      selectedDiagram?.lines || [],
      catalogForPricing || [],
      {}
    );
    // miters + end caps from the diagram’s saved tallies
    const me = itemsFromAccessoryData(selectedDiagram?.accessoryData || []);

    // Combine; no fold here — we fold once at the end of buildSavableItems()
    return [...eo, ...me];
  }, [
    selectedDiagram?.lines,
    selectedDiagram?.accessoryData,
    catalogForPricing,
  ]);

  // Merge any saved accessories with the freshly computed ones (prevents stale diagrams from hiding offsets)

  // Preview should reflect the diagram *right now*, not previously saved accessories
  const mergedAccessories = useMemo(
    () => computedAccessories,
    [computedAccessories]
  );

  // ad-hoc handlers
  const addAdHoc = useCallback(() => {
    setAdHocItemsByProject((prev) => {
      const list = prev[pid] || [];
      return {
        ...prev,
        [pid]: [
          ...list,
          {
            id: crypto.randomUUID?.() || String(Date.now()),
            name: "",
            description: "",
            quantity: 1,
            price: 0,
          },
        ],
      };
    });
  }, [pid]);

  const updateAdHoc = (id, patch) =>
    setAdHocItemsByProject((prev) => {
      const list = prev[pid] || [];
      return {
        ...prev,
        [pid]: list.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      };
    });

  const removeAdHoc = (id) =>
    setAdHocItemsByProject((prev) => {
      const list = prev[pid] || [];
      return { ...prev, [pid]: list.filter((it) => it.id !== id) };
    });

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
    return foldItems(rows);
  }, [selectedDiagram?.lines, mergedAccessories, adHocItems]);

  // header
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
          onClick={() => {
            setEstimateData((s) => ({ ...s, notes: notesDraft }));
          }}
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
      onRequestClose={onClose}
      contentLabel="Estimate Preview"
      style={{
        overlay: { backgroundColor: "rgba(0,0,0,0.5)" },
        content: {
          width: "60%",
          height: "80%",
          margin: "auto",
          padding: "20px",
          borderRadius: "10px",
          backgroundColor: "#000",
          border: "1px solid var(--white)",
          color: "var(--white)",
          overflow: "hidden",
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
                commitNotes(); // Commit notes on Enter key
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

          {/* READ-ONLY LIST of committed items (doesn't rerender while typing in the adder) */}
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

      {/* PDF */}
      <div style={{ width: "100%", height: "calc(100% - 210px)" }}>
        <PDFViewer style={{ width: "100%", height: "100%" }}>
          <EstimatePDF
            estimate={estimate}
            selectedDiagram={{
              ...selectedDiagram,
              lines: (selectedDiagram?.lines || []).map((l) =>
                l.isDownspout
                  ? { ...l, downspoutSize: prettyDsName(l.downspoutSize) }
                  : l
              ),
              accessories: { items: mergedAccessories },
            }}
            items={buildSavableItems()}
            currentUser={currentUser}
            logoUrl={logoUrl}
            estimateData={estimateData}
            project={project}
            products={products} // UI list (unchanged)
            showPrices={showPrices}
            extraItems={adHocItems}
          />
        </PDFViewer>
      </div>
    </Modal>
  );
};

export default EstimateModal;
