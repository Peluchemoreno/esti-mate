// src/components/EstimateModal/EstimateModal.jsx
import Modal from "react-modal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeAccessoriesFromLines } from "../../utils/priceResolver";
import { Svg, Line } from "@react-pdf/renderer";
import { useToast } from "../Toast/Toast";
import PhotoThumbWithAnnotations from "../Photos/PhotoThumbWithAnnotations";

const BASE_URL = import.meta.env.VITE_API_URL;

Modal.setAppElement("#root");

// ======= DEV-only profiling helpers =======
const __DEV__ = true;
function pdfMark(name) {
  if (!__DEV__) return;
  try {
    performance.mark(name);
  } catch {}
}
function pdfMeasure(label, start, end) {
  if (!__DEV__) return;
  try {
    performance.measure(label, start, end);
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
      // show a single compact table
      console.groupCollapsed("📄 Estimate PDF Performance");
      console.table(rows);
      console.groupEnd();
    }
    performance.clearMarks();
    performance.clearMeasures();
  } catch {}
}

// ——— helpers ———
async function fetchProjectPhotoMeta(projectId, photoId, jwt) {
  const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  const res = await fetch(
    `${base}dashboard/projects/${projectId}/photos/${photoId}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  );

  if (!res.ok) return null;

  const json = await res.json();
  return json?.photo || null; // backend returns { photo: {...} }
}

const prettyDsName = (raw = "") =>
  String(raw)
    .replace(
      /(\d+\s*x\s*\d+)\s*corrugated/i,
      (_m, size) => `${size.replace(/\s*/g, "")} Corrugated`,
    )
    .replace(/\s+/g, " ")
    .trim();

// NEW: Normalize item names similar to PDF so mobile preview matches it.
function prettifyLineItemName(raw) {
  if (!raw) return "";
  let name = String(raw);

  // collapse duplicates like "corrugated corrugated"
  name = name.replace(/\b(corrugated|smooth|box|round)\b\s+\1\b/gi, "$1");

  // title-case those tokens
  name = name.replace(/\b(corrugated|smooth|box|round)\b/gi, (m) => {
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  });

  // normalize dimensions like 3 x 4 -> 3x4
  name = name.replace(/(\d+)\s*[xX]\s*(\d+)/g, (_, a, b) => `${a}x${b}`);

  // 3" 3" -> 3"
  name = name.replace(/(\b\d+)"\s+\1"\b/g, `$1"`);

  // collapse whitespace
  name = name.replace(/\s{2,}/g, " ").trim();
  return name;
}

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
    pdfMark("PDF/Import EstimatePDF:start");
    const m = await import("../EstimatePDF/EstimatePDF");
    pdfMark("PDF/Import EstimatePDF:end");
    pdfMeasure(
      "PDF/Import EstimatePDF",
      "PDF/Import EstimatePDF:start",
      "PDF/Import EstimatePDF:end",
    );
    EstimatePDFMod = m.default || m;
  }
  return EstimatePDFMod;
}

// render React-PDF element -> Blob (lazy import renderer)
async function renderEstimateToBlob(EstimatePDF, props) {
  if (__DEV__) console.time("Full PDF generation");

  pdfMark("PDF/Import @react-pdf:start");
  const { pdf } = await import("@react-pdf/renderer");
  pdfMark("PDF/Import @react-pdf:end");
  pdfMeasure(
    "PDF/Import @react-pdf",
    "PDF/Import @react-pdf:start",
    "PDF/Import @react-pdf:end",
  );

  const element = <EstimatePDF {...props} />;

  pdfMark("PDF/Render-to-Blob:start");
  const blob = await pdf(element).toBlob();
  pdfMark("PDF/Render-to-Blob:end");
  pdfMeasure(
    "PDF/Render-to-Blob",
    "PDF/Render-to-Blob:start",
    "PDF/Render-to-Blob:end",
  );

  if (__DEV__) {
    console.timeEnd("Full PDF generation");
    pdfReportAndClear();
  }
  return blob;
}

// Optional downscale to keep image small for faster PDF render
async function maybeDownscaleDataUrl(dataUrl, maxSize = 1200) {
  try {
    pdfMark("PDF/Downscale image:start");
    if (!dataUrl || typeof createImageBitmap !== "function") return dataUrl;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const { width, height } = bmp;
    const long = Math.max(width, height);
    if (long <= maxSize) {
      bmp.close?.();
      const out = dataUrl;
      pdfMark("PDF/Downscale image:end");
      pdfMeasure(
        "PDF/Downscale image",
        "PDF/Downscale image:start",
        "PDF/Downscale image:end",
      );
      return out;
    }
    const scale = maxSize / long;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    bmp.close?.();
    pdfMark("PDF/Downscale image:end");
    pdfMeasure(
      "PDF/Downscale image",
      "PDF/Downscale image:start",
      "PDF/Downscale image:end",
    );
    return out;
  } catch {
    pdfMark("PDF/Downscale image:end");
    pdfMeasure(
      "PDF/Downscale image (error)",
      "PDF/Downscale image:start",
      "PDF/Downscale image:end",
    );
    return dataUrl;
  }
}

// -------- Project Photo -> dataURL helpers (browser-only) --------
async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function fetchAuthedImageAsDataUrl(url, jwt) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn("[PDF photos] fetch failed", {
      url,
      status: res.status,
      body: txt.slice(0, 200),
      hasJwt: !!jwt,
    });
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  const blob = await res.blob();
  return blobToDataUrl(blob);
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

  const isMobileUA =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

  // ✅ Use iframe PDF preview only on desktop.
  // Mobile browsers can render blob iframes as blank, so we keep mobile on HTML fallback.
  const canInlinePDF =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 769px)").matches &&
    !isMobileUA;
  const [logoUrl, setLogoUrl] = useState(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const [pricingCatalog, setPricingCatalog] = useState(null);

  // immutable meta (auto-only)
  const [estimateData, setEstimateData] = useState({
    estimateNumber: estimate?.number || "",
    estimateDate: new Date().toISOString().split("T")[0],
    paymentDue: "Upon completion",
    notes: estimate?.notes || "",
  });

  // notes draft: only commit when clicking "Save Notes"
  const [notesDraft, setNotesDraft] = useState(estimateData.notes);
  const onSaveNotes = () => {
    setEstimateData((s) => ({ ...s, notes: String(notesDraft || "") }));
  };

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

  const removeAdHoc = (id) =>
    setAdHocItemsByProject((prev) => ({
      ...prev,
      [pid]: (prev[pid] || []).filter((x) => x.id !== id),
    }));

  const [showPrices, setShowPrices] = useState(true);
  // Used by the HTML fallback preview (mobile-safe)
  const [fallbackPhotoUrlsById, setFallbackPhotoUrlsById] = useState({});
  const [fallbackPhotoAnnotationsById, setFallbackPhotoAnnotationsById] =
    useState({});

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
            }),
        )
        .then((b64) => setLogoUrl(b64))
        .catch((err) =>
          console.error("Failed to fetch and convert logo:", err),
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
          e?.message || e,
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
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    const projectId = project?._id || project?.id || "";
    const ids = Array.isArray(selectedDiagram?.includedPhotoIds)
      ? selectedDiagram.includedPhotoIds
      : [];

    if (!token || !projectId || !ids.length) {
      setFallbackPhotoUrlsById({});
      setFallbackPhotoAnnotationsById({});
      return;
    }

    let cancelled = false;
    const urlsToRevoke = [];

    (async () => {
      try {
        const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;

        // 1) fetch photo meta so we have annotations
        const metas = await Promise.all(
          ids.map((photoId) =>
            fetchProjectPhotoMeta(projectId, photoId, token).catch(() => null),
          ),
        );

        if (cancelled) return;

        const annMap = {};
        metas.forEach((m, idx) => {
          const photoId = ids[idx];
          const items = m?.annotations?.items;
          if (Array.isArray(items) && items.length) {
            annMap[photoId] = { items };
          } else {
            annMap[photoId] = { items: [] };
          }
        });

        setFallbackPhotoAnnotationsById(annMap);

        // 2) fetch preview image blobs for <img> URLs
        const nextUrls = {};
        for (const photoId of ids) {
          const res = await fetch(
            `${base}dashboard/projects/${projectId}/photos/${photoId}/image?variant=preview`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!res.ok) continue;

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          urlsToRevoke.push(url);
          nextUrls[photoId] = url;
        }

        if (!cancelled) setFallbackPhotoUrlsById(nextUrls);
      } catch (e) {
        if (!cancelled) {
          setFallbackPhotoUrlsById({});
          setFallbackPhotoAnnotationsById({});
        }
      }
    })();

    return () => {
      cancelled = true;
      urlsToRevoke.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
  }, [project?._id, project?.id, selectedDiagram?.includedPhotoIds]);

  // Choose catalog for pricing — prefer full pricing catalog if loaded
  const catalogForPricing = pricingCatalog || products;

  // Resolve correct gutter product by profile + size (avoid defaulting to 5" K-Style)
  // Resolve correct gutter product by profile + size WITHOUT overriding a line that already has a product
  function resolveGutterProductForLine(line) {
    const list = Array.isArray(catalogForPricing) ? catalogForPricing : [];

    // If the line already carries a gutter product, keep it. Do NOT “helpfully” re-guess.
    if (
      line?.currentProduct &&
      /gutter/i.test(String(line.currentProduct?.name || ""))
    ) {
      return line.currentProduct;
    }

    const rawProfile = String(
      line.profileKey || line.profile || "",
    ).toLowerCase();
    const rawSizeTok = String(line.sizeInches || "").replace(/\s+/g, "");

    // Build desired tokens from line metadata
    const wantsProfiles = [];
    if (rawProfile.includes("k")) wantsProfiles.push("k-style");
    if (rawProfile.includes("straight"))
      wantsProfiles.push("straight face", "straight-face");
    if (rawProfile.includes("half"))
      wantsProfiles.push("half round", "half-round");
    if (rawProfile.includes("box")) wantsProfiles.push("box");
    if (rawProfile.includes("round")) wantsProfiles.push("round");

    const sizeNeedle = /\d+"/.test(rawSizeTok)
      ? rawSizeTok
      : rawSizeTok.replace(/[^0-9]/g, "")
        ? rawSizeTok.replace(/[^0-9]/g, "") + '"'
        : null;

    // STRICT match: name must include size + profile tokens
    const strictHit = list.find((p) => {
      const name = String(p.name || "").toLowerCase();
      if (!/gutter/.test(name)) return false;

      const hasProfile = wantsProfiles.length
        ? wantsProfiles.some((tok) => name.includes(tok))
        : false;
      const hasSize = sizeNeedle
        ? name.includes(sizeNeedle.replace(/"/g, "").toLowerCase()) ||
          name.includes(sizeNeedle.toLowerCase())
        : false;

      return hasProfile && hasSize;
    });
    if (strictHit) return strictHit;

    // RELAXED (profile+catalog size property), used only if we still don't have a product AND line doesn't have one
    const relaxedHit = list.find((p) => {
      const name = String(p.name || "").toLowerCase();
      if (!/gutter/.test(name)) return false;

      const hasProfile = wantsProfiles.length
        ? wantsProfiles.some((tok) => name.includes(tok))
        : false;
      const matchesSizeProp = sizeNeedle
        ? String(p.size || "")
            .toLowerCase()
            .includes(sizeNeedle.replace(/"/g, "").toLowerCase())
        : false;

      return hasProfile && matchesSizeProp;
    });
    if (relaxedHit) return relaxedHit;

    // Final fallback: keep whatever the line had (if any) — do not arbitrarily change it to the first 5" K gutter
    return line.currentProduct || null;
  }

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
      {},
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
    [computedAccessories],
  );

  const toast = useToast();

  // —— define BEFORE any hook that references it ——
  const buildSavableItems = useCallback(() => {
    const rows = [];

    // 1) Base priced lines (gutters, downspouts)
    (selectedDiagram?.lines || []).forEach((l) => {
      // skip notes/free marks

      // Splash Guard (priced, quantity = 1 per mark)
      if (l.isSplashGuard && l.currentProduct) {
        const unit = Number(l.currentProduct?.price || 0);
        const name = l.currentProduct?.name || "Splash Guard";
        const qty = 1;

        rows.push({
          name,
          quantity: qty,
          price: unit,
          product: l.currentProduct,
          meta: {
            kind: "splashGuard",
            // carry color so PDF key & any UI swatch are accurate
            color:
              l.color ||
              l.currentProduct?.color ||
              l.currentProduct?.colorCode ||
              l.currentProduct?.defaultColor ||
              "#111111",
          },
        });

        return;
      }
      if (l.isNote || l.isFreeMark) return;

      if (l.isDownspout) {
        const qty = Number(l.totalFeet ?? l.measurement ?? 0);
        const unit = Number(l.price || l.currentProduct?.price || 0);
        const name =
          l.currentProduct?.name ||
          (l.downspoutSize ? `${l.downspoutSize} Downspout` : "Downspout");
        if (qty > 0 && unit >= 0) {
          rows.push({
            name: prettifyLineItemName(name),
            quantity: qty,
            price: unit,
          });
        }

        if (l.isGutter && l.currentProduct) {
          const qty = Number(l.runFeet ?? l.measurement ?? 0);
          const unit = Number(l.currentProduct?.price || 0);
          const name = l.currentProduct?.name || "Gutter";
          if (qty > 0 && unit >= 0) {
            rows.push({
              name,
              quantity: Math.round(qty * 4) / 4,
              price: unit,
              product: l.currentProduct,
              meta: {
                kind: "gutter",
                profileKey: l.profileKey || "",
                size: l.sizeInches || "",
              },
            });
          }
        }
        return;
      }

      // gutter lines
      if (
        (l.currentProduct || resolveGutterProductForLine(l)) &&
        Number((l.runFeet ?? l.measurement) || 0) > 0
      ) {
        rows.push({
          name: prettifyLineItemName(
            (l.currentProduct || resolveGutterProductForLine(l)).name,
          ),
          quantity: Number((l.runFeet ?? l.measurement) || 0),
          price: Number(
            (l.currentProduct || resolveGutterProductForLine(l))?.price || 0,
          ),
        });
      }
    });

    // 2) Accessories (merged) — use their own unit price
    (mergedAccessories || []).forEach((it) => {
      rows.push({
        name: prettifyLineItemName(it.name),
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
      });
    });

    // 3) Impromptu items
    (adHocItems || []).forEach((it) => {
      rows.push({
        name: prettifyLineItemName(it.name) || "Custom",
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
      });
    });

    return Object.freeze(foldItems(rows));
  }, [selectedDiagram?.lines, mergedAccessories, adHocItems]);

  const pdfRunIdRef = useRef(0);

  const previewItems = useMemo(() => buildSavableItems(), [buildSavableItems]);

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
    setNotesSaved(true);
  }, [notesDraft]);

  // -------- Included Project Photo IDs signature (used to invalidate PDF) --------
  const includedPhotoIdsSig = useMemo(() => {
    const ids = selectedDiagram?.includedPhotoIds;
    return Array.isArray(ids) ? ids.join(",") : "";
  }, [selectedDiagram?.includedPhotoIds]);

  // ======= PDF preview via blob + <iframe> with debounce & guards =======
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const abortRef = useRef({ aborted: false });
  const timerRef = useRef(0);
  // track which render attempt is the latest
  const genSeqRef = useRef(0);
  const isRenderingRef = useRef(false);

  // small, stable signature for rebuilds (avoid stringifying big objects)
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
      (Array.isArray(previewItems) ? previewItems.length : 0);

    const show = showPrices ? 1 : 0;
    const date = estimateData?.estimateDate || "";
    const num = estimateData?.estimateNumber || "";
    const logo = logoUrl ? 1 : 0;
    const photoSig = includedPhotoIdsSig || "";

    return [imgLen, linesN, accN, itemsN, show, date, num, logo, photoSig].join(
      "|",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDiagram?.imageData,
    selectedDiagram?.lines,
    mergedAccessories,
    adHocItems,
    previewItems?.length,
    showPrices,
    estimateData?.estimateDate,
    estimateData?.estimateNumber,
    logoUrl,
    includedPhotoIdsSig,
  ]);

  // now it’s safe to define this: it references buildSavableItems + handleCloseModal
  // inside EstimateModal.jsx

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

          // ✅ IMPORTANT: persist selected photos on the estimate
          includedPhotoIds: Array.isArray(selectedDiagram?.includedPhotoIds)
            ? selectedDiagram.includedPhotoIds
            : [],
        },
        items,
        estimateDate:
          estimateData.estimateDate || new Date().toISOString().slice(0, 10),
        notes: estimateData.notes || "",
      };

      // --------- DEV color trace (remove anytime) ---------
      if (import.meta?.env?.DEV) {
        const lines = Array.isArray(body?.diagram?.lines)
          ? body.diagram.lines
          : [];
        const colors = lines
          .map((l) => l?.color)
          .filter(Boolean)
          .map((c) => String(c).trim());
        const uniq = Array.from(
          new Set(colors.map((c) => c.toLowerCase())),
        ).sort();

        console.log(
          "[save estimate] diagram lines:",
          lines.length,
          "colored:",
          colors.length,
          "uniqueColors:",
          uniq.length,
          uniq.slice(0, 30),
        );
        console.log(
          "[save estimate] sample line colors:",
          lines.slice(0, 10).map((l) => ({
            kind: l?.isDownspout
              ? "ds"
              : l?.isSplashGuard
                ? "sg"
                : l?.isFreeMark
                  ? "free"
                  : "line",
            color: l?.color,
            product: l?.currentProduct?.name,
          })),
        );
      }

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

    // schedule the work (you already had 300ms debounce)
    timerRef.current = window.setTimeout(async () => {
      if (isRenderingRef.current) return; // prevent overlap

      // mark this attempt
      const runId = ++genSeqRef.current;

      let revoke;
      abortRef.current.aborted = false;

      isRenderingRef.current = true;
      setIsRendering(true);
      setPdfUrl(null); // show "Preparing..." immediately

      try {
        // allow modal to paint first
        await new Promise((r) => setTimeout(r, 0));

        const Doc = await importEstimatePDF();

        // build normalized props snapshot (unchanged)
        const normalizedLines = (selectedDiagram?.lines || []).map((l) =>
          l.isDownspout
            ? { ...l, downspoutSize: prettyDsName(l.downspoutSize) }
            : l,
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
          jwt: localStorage.getItem("jwt") || localStorage.jwt || "",
        };

        // src/components/EstimateModal/EstimateModal.jsx
        // inside the preview-render useEffect, right after `const prepared = { ... }`

        // ✅ Mobile safety: prefetch selected photos as data URLs (more reliable than headers during pdf().toBlob on some phones)
        const isMobileUA =
          typeof navigator !== "undefined" &&
          /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

        const projectIdForPhotos = project?._id || project?.id;
        const photoIds = Array.isArray(
          prepared?.selectedDiagram?.includedPhotoIds,
        )
          ? prepared.selectedDiagram.includedPhotoIds
          : [];

        if (
          isMobileUA &&
          projectIdForPhotos &&
          prepared.jwt &&
          photoIds.length
        ) {
          const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;

          try {
            const dataUrls = await Promise.all(
              photoIds.map((photoId) =>
                fetchAuthedImageAsDataUrl(
                  `${base}dashboard/projects/${projectIdForPhotos}/photos/${photoId}/image?variant=preview`,
                  prepared.jwt,
                ).catch(() => null),
              ),
            );

            // if we got at least one, pass through (EstimatePDF will validate)
            if (abortRef.current.aborted || runId !== genSeqRef.current) return;
            prepared.includedPhotoDataUrls = dataUrls;
          } catch (e) {
            // keep going; EstimatePDF will fall back to { uri, headers }
            console.warn("[PDF photos] mobile prefetch failed", e);
          }
        }

        // optional downscale (unchanged)
        if (prepared.selectedDiagram?.imageData) {
          const downsized = await maybeDownscaleDataUrl(
            prepared.selectedDiagram.imageData,
          );
          if (abortRef.current.aborted || runId !== genSeqRef.current) return;
          prepared.selectedDiagram.imageData = downsized;
        }

        if (abortRef.current.aborted || runId !== genSeqRef.current) return;

        // ✅ Fetch included photo annotations so preview+download PDFs match viewer modal
        if (projectIdForPhotos && prepared.jwt && photoIds.length) {
          try {
            const metas = await Promise.all(
              photoIds.map((photoId) =>
                fetchProjectPhotoMeta(
                  projectIdForPhotos,
                  photoId,
                  prepared.jwt,
                ).catch(() => null),
              ),
            );

            if (abortRef.current.aborted || runId !== genSeqRef.current) return;

            const annMap = {};
            const metaMap = {};

            metas.forEach((m, idx) => {
              const id = photoIds[idx];
              if (!m) return;

              // annotations
              const ann = m?.annotations;
              if (ann?.items?.length) annMap[id] = ann;

              // meta (prevents aspectRatio fallback -> prevents drift)
              const w = m?.originalMeta?.width;
              const h = m?.originalMeta?.height;
              if (
                typeof w === "number" &&
                typeof h === "number" &&
                w > 0 &&
                h > 0
              ) {
                metaMap[id] = { width: w, height: h };
              }
            });

            prepared.includedPhotoAnnotationsById = annMap;
            prepared.includedPhotoMetaById = metaMap;
          } catch (e) {
            // non-fatal; PDF will just render without annotations
            console.warn("[PDF photos] annotations fetch failed", e);
          }
        }

        const blob = await renderEstimateToBlob(Doc, prepared);
        if (abortRef.current.aborted || runId !== genSeqRef.current) return;

        const url = URL.createObjectURL(blob);
        revoke = () => URL.revokeObjectURL(url);

        // only set state if this attempt is still the latest
        if (!abortRef.current.aborted && runId === genSeqRef.current) {
          setPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      } catch (e) {
        console.error("PDF render failed:", e);
      } finally {
        // only clear the spinner if this attempt is still current
        if (!abortRef.current.aborted && runId === genSeqRef.current) {
          setIsRendering(false);
          isRenderingRef.current = false;
        }
      }
    }, 300);

    // IMPORTANT: do NOT mark aborted on every dependency change,
    // because that kills in-flight renders. Just clear the timer.
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    isOpen,
    pdfKey,
    // NOTE: keep large objects out to avoid thrash
  ]);

  // Hard abort only on unmount of this component
  useEffect(() => {
    return () => {
      abortRef.current.aborted = true;
      // revoke the last URL if you keep one in a ref; pdfUrl cleanup already happens elsewhere
    };
  }, []);

  const headerBar = (
    <div className={isSmallScreen ? "estimate-modal__header" : undefined}>
      {/* Row 1: title (left) + close (right) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>Estimate Preview</h2>

        <button
          onClick={handleCloseModal}
          title="Close"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--white)",
            background: "transparent",
            color: "var(--white)",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      {/* Row 2: controls */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
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
          {notesSaved ? "Saved" : "Save Notes"}
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
        overlay: { backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999 },
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
              // overflow: "hidden",
              overflow: "auto",
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
          display: "flex",
          flexWrap: "wrap",
          // gridTemplateColumns: "1fr 1fr",
          gap: 12,
          alignItems: "start",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
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
            onChange={(e) => {
              setNotesDraft(e.target.value);
              setNotesSaved(false);
            }}
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: 6,
            }}
          >
            Add custom items:
          </label>
          {/* MOBILE-FRIENDLY ADDER */}
          <div className="estimate-modal__adder" style={{ width: "100%" }}>
            {/* Row 1: Name | Qty | Price */}
            <div
              className="adder-row"
              style={{
                marginBottom: 8,
                display: "flex",
                gap: "5px",
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
                  flex: "1 1 80%",
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
                  width: "20%",
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
                  width: "20%",
                }}
              />
            </div>
            {/* Row 2: Add (full width on mobile) */}
            <button
              className="adder-add"
              onClick={addAdHocFromDraft}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--white)",
                background: "transparent",
                color: "var(--white)",
                cursor: "pointer",
                width: "100%", // desktop keeps full width too; mobile rule ensures it fills container
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
        style={{
          width: "100%",
          height: "calc(100% - 210px)",
          minHeight: 0,
        }}
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
            <h3 style={{ marginTop: 0 }}>Estimate Preview</h3>

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
                        (Array.isArray(previewItems)
                          ? previewItems
                              .reduce(
                                (s, it) =>
                                  s +
                                  Number(it.price || 0) *
                                    Number(it.quantity || 0),
                                0,
                              )
                              .toFixed(2)
                          : "0.00")
                      : "Prices hidden"}
                  </div>
                </div>
              </div>

              {/* NEW: Diagram section */}
              <section>
                <h4 style={{ margin: "8px 0" }}>Diagram</h4>
                {selectedDiagram?.svg ? (
                  <img
                    alt="Diagram"
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(
                      selectedDiagram.svg,
                    )}`}
                    style={{
                      width: "100%",
                      height: 180,
                      objectFit: "contain",
                      background: "#111",
                      border: "1px solid #333",
                      borderRadius: 8,
                    }}
                  />
                ) : selectedDiagram?.imageDataLarge ||
                  selectedDiagram?.imageData ? (
                  <img
                    alt="Diagram"
                    src={
                      selectedDiagram.imageDataLarge ||
                      selectedDiagram.imageData
                    }
                    style={{
                      width: "100%",
                      height: 180,
                      objectFit: "contain",
                      background: "#111",
                      border: "1px solid #333",
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>(No diagram)</div>
                )}
              </section>

              <div>
                {Array.isArray(previewItems) && previewItems.length ? (
                  previewItems.map((it, idx) => (
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
            {/* Photos (annotated) - HTML fallback */}
            {Array.isArray(selectedDiagram?.includedPhotoIds) &&
            selectedDiagram.includedPhotoIds.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                  Photos
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {selectedDiagram.includedPhotoIds.map((photoId) => {
                    const src = fallbackPhotoUrlsById?.[photoId];
                    const ann = fallbackPhotoAnnotationsById?.[photoId];

                    return (
                      <div
                        key={photoId}
                        style={{
                          width: "100%",
                          aspectRatio: "4 / 3",
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid #333",
                          background: "#111",
                        }}
                      >
                        {src ? (
                          <PhotoThumbWithAnnotations
                            src={src}
                            alt="Project photo"
                            annotations={ann}
                            style={{ width: "100%", height: "100%" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: 0.7,
                              fontSize: 12,
                            }}
                          >
                            Loading…
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div style={{ marginTop: 12 }}>
              {pdfUrl && estimateData?.estimateNumber ? (
                <a
                  href={pdfUrl}
                  download={`Estimate-${estimateData.estimateNumber}.pdf`}
                  onClick={() => toast.success("File downloaded")}
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
