// testing the branch

import "./Diagram.css";
import { useQueryClient } from "@tanstack/react-query";
import closeIcon from "../../assets/icons/close.svg";
import saveIcon from "../../assets/icons/check.svg";
import trashIcon from "../../assets/icons/trash.svg";
import itemsIcon from "../../assets/icons/items.svg";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isLineParallelToTop,
  isLineParallelToSide,
  calculateDistance,
  isLineNearPoint,
} from "../../utils/constants";
import DownspoutModal from "../DownspoutModal/DownspoutModal";
import { OverwriteDiagramModal } from "../OverwriteDiagramModal/OverwriteDiagramModal";
import { AnnotationModal } from "../AnnotationModal/AnnotationModal";
import { useProductsCatalog } from "../../contexts/ProductsContext";
import { useProductsListed, useProductsPricing } from "../../hooks/useProducts";

// ---- fixed palette used by free tools ----
const COMMON_COLORS = [
  "#ffffff", // white (visible on dark)
  "#ff0000",
  "#00aaff",
  "#00c853",
  "#ffab00",
  "#9c27b0",
  "#000000",
];

// ------- small helpers -------
const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const titleCase = (s = "") => s.replace(/\b\w/g, (c) => c.toUpperCase());

const PROFILE_ALIASES = [
  [/k[-\s]?style/i, "K-Style"],
  [/half[-\s]?round/i, "Half Round"],
  [/straight[-\s]?face|straightface/i, "Straight Face"],
  [/box/i, "Box"],
  [/round(?!.*half)/i, "Round"],
  [/custom/i, "Custom"],
];

function formatDownspoutName(sizeRaw, profileRaw) {
  const s = String(sizeRaw || "").trim();
  const p = String(profileRaw || "").trim();
  const corr = /corr/i.test(p);
  const round = /round/i.test(p);
  // normalize to: 3x4 Corrugated Downspout  OR  3" Round Downspout
  if (/^\d+\s*x\s*\d+$/i.test(s)) {
    return `${s.replace(/\s*/g, "")} ${
      corr
        ? "Corrugated"
        : /smooth/i.test(p)
        ? "Smooth"
        : /box/i.test(p)
        ? "Box"
        : p
    } Downspout`;
  }
  const m = s.match(/^(\d+)/);
  if (m && round) return `${m[1]}" Round Downspout`;
  // fallback
  return `${s} ${p} Downspout`.replace(/\s+/g, " ").trim();
}

// ---- Catalog matching helpers (robust to your seedTemplate) ----

// normalize
const ci = (s) => String(s || "").toLowerCase();

// Map gutter drawing profile -> tokens we can match in template *names*
function nameTokensForProfile(profileKey) {
  const p = ci(profileKey);
  if (p.includes("k")) return ["k-style"];
  if (p.includes("straight")) return ["straight face", "straight-face"];
  if (p.includes("half")) return ["half round", "half-round"];
  if (p.includes("box")) return ["box"];
  if (p.includes("custom")) return ["custom"];
  // fallback
  return [p];
}

// “size” for gutters is like 5", 6", 7"
function inchesToken(sizeInches) {
  const s = String(sizeInches || "").replace(/\s+/g, "");
  return /(\d+)"/.test(s) ? s : `${s.replace(/[^0-9]/g, "")}"`;
}

// For downspouts: 2x3 / 3x4 / 4x5 / 3" / 4"
function dsSizeToken(dsSizeRaw) {
  const s = ci(dsSizeRaw).replace(/\s+/g, "");
  if (/^\d+x\d+$/.test(s)) return s; // 3x4
  const m = s.match(/^(\d+)("?|inch|in)$/); // 3"
  return m ? `${m[1]}"` : s;
}

// does a product *name* contain one of tokens?
function nameHasAny(n, tokens = []) {
  const S = ci(n);
  return tokens.some((t) => S.includes(ci(t)));
}

// Find an accessory template by *name* patterns more than by profile field.
// kind: "end cap" | "strip miter" | "bay miter"
function findGutterAccessoryTemplate(
  allProducts,
  { profileKey, sizeInches, kind }
) {
  const sizeTok = inchesToken(sizeInches); // e.g., 5"
  const profNameTokens = nameTokensForProfile(profileKey); // e.g., ["k-style"] or ["half round", "half-round"]

  const kindTokens = ci(kind); // "end cap" / "strip miter" / "bay miter"
  const isEndCap = kindTokens.includes("end");
  const isStrip = kindTokens.includes("strip");
  const isBay = kindTokens.includes("bay");

  // pass 1: strict -> name must include profile token + size + kind words
  let hit = allProducts.find((p) => {
    const n = p.name || "";
    if (!/accessory/i.test(p.type || "accessory")) return false;
    if (!nameHasAny(n, profNameTokens)) return false;
    if (!n.includes(sizeTok)) return false;
    if (isEndCap && !/end\s*cap|endcap/i.test(n)) return false;
    if (isStrip && !/strip\s*miter/i.test(n)) return false;
    if (isBay && !/bay\s*miter/i.test(n)) return false;
    return true;
  });
  if (hit) return hit;

  // pass 2: relaxed -> ignore size (some entries are size-less for custom/box)
  hit = allProducts.find((p) => {
    const n = p.name || "";
    if (!/accessory/i.test(p.type || "accessory")) return false;
    if (!nameHasAny(n, profNameTokens)) return false;
    if (isEndCap && !/end\s*cap|endcap/i.test(n)) return false;
    if (isStrip && !/strip\s*miter/i.test(n)) return false;
    if (isBay && !/bay\s*miter/i.test(n)) return false;
    return true;
  });
  return hit || null;
}

// Downspout elbows/offsets: match by profile family + size + code A/B (when present)
// Requires helpers already in your file:
//   - ci: (s) => String(s || "").toLowerCase()
//   - nameHasAny: (name, tokens[]) => tokens.some(t => String(name).toLowerCase().includes(String(t).toLowerCase()))
//   - dsSizeToken: (dsSize) => '2x3' | '3x4' | '3"' | '4"' (normalized)
function findDownspoutFitting(allProducts, { profileKey, dsSize, code, kind }) {
  const catalog = Array.isArray(allProducts) ? allProducts : [];
  const K = ci(kind || ""); // e.g., "elbow", '2" offset'
  const prof = ci(profileKey || ""); // corrugated | smooth | box | round
  const sizeTok = dsSizeToken(dsSize || ""); // "3x4", "2x3", '3"', '4"'

  // Profile tokens used in product NAME matching
  let profTokens = [];
  if (prof.includes("corr")) profTokens = ["corrugated"];
  else if (prof.includes("smooth")) profTokens = ["smooth"];
  else if (prof.includes("box")) profTokens = ["box"];
  else if (prof.includes("round")) profTokens = ["round"];

  const wantElbow = /elbow/i.test(K);
  const wantOffset = /offset/i.test(K);

  // ---- elbow code handling (A/B) ----
  // Non-round elbow SKUs have explicit A/B; round elbows don't.
  const needCode = wantElbow && !prof.includes("round") && !!code;
  const codeSafe = code
    ? String(code).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : "";
  const codeRe = needCode ? new RegExp(`\\b${codeSafe}\\b`, "i") : null;

  // ---- size matching helpers ----
  const sizeNeedle = String(sizeTok || "").toLowerCase(); // '2x3' | '3"' etc.
  function nameHasSize(n) {
    const s = String(n || "").toLowerCase();
    if (!sizeNeedle) return true;
    // '2x3', '2 x 3', '2X3'
    if (/^\d+x\d+$/.test(sizeNeedle)) {
      const [w, h] = sizeNeedle.split("x");
      const re = new RegExp(`\\b${w}\\s*[xX]\\s*${h}\\b`);
      return re.test(s);
    }
    // round inches, e.g. 3" or 4"
    if (/^\d+"\s*$/.test(sizeNeedle)) {
      const w = sizeNeedle.replace(/"/g, "");
      return s.includes(`${w}"`) || new RegExp(`\\b${w}\\b`).test(s);
    }
    return s.includes(sizeNeedle);
  }

  // ---- offset inches (parsed from kind) ----
  // Supports '2" offset', '4 in offset', '6 inch offset'
  let inchesRe = null;
  if (wantOffset) {
    const m = K.match(/(\d+)\s*(?:"|in\b|inch\b|”)?/i);
    if (m) {
      const inchesSafe = m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match 2" or bare 2
      inchesRe = new RegExp(
        `(?:\\b${inchesSafe}"\\b|\\b${inchesSafe}\\b)`,
        "i"
      );
    }
  }

  // ---- base type checks ----
  function isDesiredKind(n) {
    const s = String(n || "");
    if (wantElbow && !/elbow/i.test(s)) return false;
    if (wantOffset && !/offset/i.test(s)) return false;
    return wantElbow || wantOffset; // must be one of them
  }

  // ---------- PASS 1: strict (profile + size + kind + code if needed + inches for offset) ----------
  let hit = catalog.find((p) => {
    const n = p?.name || "";
    if (!/accessory/i.test(p?.type || "accessory")) return false;
    if (!nameHasAny(n, profTokens)) return false;
    if (!isDesiredKind(n)) return false;
    if (!nameHasSize(n)) return false;
    if (needCode && !(codeRe && codeRe.test(n))) return false;
    if (wantOffset && inchesRe && !inchesRe.test(n)) return false;
    return true;
  });
  if (hit) return hit;

  // ---------- PASS 2: allow size-less catalog entries (e.g., "Box A Elbow") ----------
  hit = catalog.find((p) => {
    const n = p?.name || "";
    if (!/accessory/i.test(p?.type || "accessory")) return false;
    if (!nameHasAny(n, profTokens)) return false;
    if (!isDesiredKind(n)) return false;
    if (needCode && !(codeRe && codeRe.test(n))) return false;
    if (wantOffset && inchesRe && !inchesRe.test(n)) return false;
    return true;
  });
  if (hit) return hit;

  // ---------- PASS 3: round elbows with no A/B (ignore code entirely) ----------
  if (wantElbow && prof.includes("round")) {
    hit = catalog.find((p) => {
      const n = p?.name || "";
      if (!/accessory/i.test(p?.type || "accessory")) return false;
      if (!nameHasAny(n, ["round"])) return false;
      if (!/elbow/i.test(n)) return false;
      if (sizeNeedle && !nameHasSize(n)) return false;
      return true;
    });
    if (hit) return hit;
  }

  // ---------- PASS 4: last resort (profile + kind only) ----------
  hit = catalog.find((p) => {
    const n = p?.name || "";
    if (!/accessory/i.test(p?.type || "accessory")) return false;
    if (!nameHasAny(n, profTokens)) return false;
    if (!isDesiredKind(n)) return false;
    return true;
  });

  return hit || null;
}

function normalizeGutterKey(name = "") {
  const trimmed = name.trim();
  const sizeMatch = trimmed.match(/(\d+)\s*"/);
  if (!sizeMatch) return trimmed;

  const size = `${sizeMatch[1]}"`;
  for (const [rx, label] of PROFILE_ALIASES) {
    if (rx.test(trimmed)) return `${size} ${label}`;
  }

  // fallback: grab a couple of non-junk words after size
  const after = trimmed.slice(sizeMatch.index + sizeMatch[0].length);
  const stop = /[-–—,(\/\\|]/;
  const cut = after.search(stop);
  let chunk = (cut >= 0 ? after.slice(0, cut) : after)
    .replace(
      /\b(alum(?:inum)?|copper|steel|gutter|seamless|paint(?:ed)?|color|white|black|bronze|brown|matte|textured|coil|sku|ft|pcs?)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  chunk = chunk.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");

  return chunk ? `${size} ${titleCase(chunk)}` : size;
}

// Async replacement for canvas.toDataURL() to avoid blocking the main thread
function canvasToDataURLAsync(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    try {
      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve("");
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          type,
          quality
        );
      } else {
        // Fallback (older Safari), still synchronous but rarely hit
        resolve(canvas.toDataURL(type, quality));
      }
    } catch (e) {
      resolve("");
    }
  });
}

// ======= Component =======
const Diagram = ({
  activeModal,
  closeModal,
  isMobile,
  currentProjectId,
  updateDiagram,
  addDiagramToProject,
  handlePassDiagramData,
  selectedDiagram,
  setSelectedDiagram,
  originalDiagram,
  diagrams,
  setActiveModal,
}) => {
  // ------- Constants for UX fidelity on phones -------
  const MIN_HANDLE_PX = 6; // CSS pixels minimum for handles
  const PADDING_PX = 24; // auto-fit padding
  // Products (context first, then API)
  // ✅ Call hooks once at top-level, never conditionally
  const { data: pricingProducts = [], isLoading, error } = useProductsPricing(); // ALL items
  // which downspout we are editing via the modal (null = adding a new one)
  const [editingDownspoutIndex, setEditingDownspoutIndex] = useState(null);

  const { data: listedProducts = [] } = useProductsListed(); // fallback (optional)

  const productsCtx = useProductsCatalog();
  // which annotation (note) is being edited; null means "creating"
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);

  // click-vs-drag detection for notes (like you already do for downspout box)
  const noteClickRef = useRef({ x: 0, y: 0, index: null });

  const allProducts =
    pricingProducts && pricingProducts.length
      ? pricingProducts
      : listedProducts;

  const boxClickRef = useRef({ x: 0, y: 0, index: null });

  useEffect(() => {
    if (activeModal === "diagram") {
      setCanvasSize();
      drawScene();
    }
  }, [activeModal]);

  // When opening the modal to create a NEW diagram, make sure canvas is blank,
  // but only once per open and only if there is no content yet.
  useEffect(() => {
    if (activeModal !== "diagram") return;

    if (didInitDiagram.current) return; // already initialized this open

    const hasId =
      selectedDiagram &&
      typeof selectedDiagram === "object" &&
      selectedDiagram._id;

    // only clear if it's truly a brand-new diagram AND you don't already have lines
    if (!hasId && (lines?.length ?? 0) === 0) {
      setLines([]);
      setSelectedIndex(null);
      setIsDrawing(false);
      if (baselineHashRef && "current" in baselineHashRef) {
        baselineHashRef.current = hashLines([]);
      }
      drawScene();
    }

    didInitDiagram.current = true; // mark initialized for this open
  }, [activeModal]); // keep dep list tight

  useEffect(() => {
    if (activeModal !== "diagram") {
      didInitDiagram.current = false;
    }
  }, [activeModal]);

  // Observe container size + window zoom
  useEffect(() => {
    if (activeModal !== "diagram") return;
    const el = canvasRef.current?.parentElement;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      setCanvasSize();
      drawScene();
    });
    ro.observe(el);

    const onWin = () => {
      setCanvasSize();
      drawScene();
    };
    window.addEventListener("resize", onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [activeModal]);

  // Keep a stable ref to the reload function for event listeners
  const reloadRef = useRef(null);
  useEffect(() => {
    reloadRef.current = productsCtx?.reload || productsCtx?.refetch || null;
  }, [productsCtx]);

  // Only gutter products in the dropdown
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(allProducts) ? allProducts : [];
    return list.filter((p) => {
      const type = (p?.type || p?.category || "").toLowerCase();
      const name = (p?.name || "").toLowerCase();
      const isGutterByType = type === "gutter";
      const isGutterByName = name.includes("gutter"); // safety net
      const isListed = p?.listed !== false; // default to visible unless explicitly false
      return (isGutterByType || isGutterByName) && isListed;
    });
  }, [allProducts]);

  const queryClient = useQueryClient();
  const [, force] = useState(0);
  useEffect(() => {
    const bump = async () => {
      // 1) Tell context to refetch if it exposes a loader
      if (typeof reloadRef.current === "function") {
        try {
          await reloadRef.current();
        } catch (e) {
          /* no-op */
        }
      }
      // 2) Invalidate React Query caches used by Diagram/useProducts()
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["gutterProducts"] });
      queryClient.invalidateQueries({ queryKey: ["downspoutProducts"] });
      // 3) Ensure a re-render in case something is memoized upstream
      force((v) => v + 1);
    };

    const onStorage = (e) => {
      if (e.key === "catalogVersion") bump();
    };

    window.addEventListener("catalog:updated", bump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("catalog:updated", bump);
      window.removeEventListener("storage", onStorage);
    };
  }, [queryClient]);
  useEffect(() => {}, []);
  // canvas + state
  const canvasRef = useRef(null);

  const [tool, setTool] = useState(""); // dropdown selection
  const [isDrawing, setIsDrawing] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [feetPerSquare, setFeetPerSquare] = useState(1);

  useEffect(() => {
    if (activeModal === "diagram") {
      drawScene();
    }
  }, [gridSize, feetPerSquare, activeModal]);

  const [currentLine, setCurrentLine] = useState({
    id: null,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isHorizontal: false,
    isVertical: false,
    isSelected: false,
    color: "black",
  });

  const [lines, setLines] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [dragging, setDragging] = useState({
    mode: "none", // "none" | "move" | "drag-end"
    end: null, // "start" | "end"
    lastX: 0,
    lastY: 0,
  });

  function setCanvasSize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement || canvas;
    const dpr = window.devicePixelRatio || 1;

    const cssW = Math.max(1, parent.clientWidth);
    const cssH = Math.max(1, parent.clientHeight);

    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    const ctx = canvas.getContext("2d");
    // draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ------------ Utility: numeric safety & clamping ------------
  const isFiniteNumber = (n) => Number.isFinite(n) && !Number.isNaN(n);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function clampLine(l, cw, ch) {
    const copy = { ...l };
    const clampX = (x) => clamp(isFiniteNumber(x) ? x : 0, 0, cw);
    const clampY = (y) => clamp(isFiniteNumber(y) ? y : 0, 0, ch);
    if (copy.startX != null) copy.startX = clampX(copy.startX);
    if (copy.startY != null) copy.startY = clampY(copy.startY);
    if (copy.endX != null) copy.endX = clampX(copy.endX);
    if (copy.endY != null) copy.endY = clampY(copy.endY);
    if (copy.centerX != null) copy.centerX = clampX(copy.centerX);
    if (copy.centerY != null) copy.centerY = clampY(copy.centerY);
    if (copy.radius != null && !isFiniteNumber(copy.radius)) copy.radius = 0;
    return copy;
  }

  function contentBBox(arr = []) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const l of arr) {
      if (
        l.isFreeMark &&
        l.kind === "free-circle" &&
        isFiniteNumber(l.centerX) &&
        isFiniteNumber(l.centerY)
      ) {
        const r = Number(l.radius || 0);
        minX = Math.min(minX, l.centerX - r);
        minY = Math.min(minY, l.centerY - r);
        maxX = Math.max(maxX, l.centerX + r);
        maxY = Math.max(maxY, l.centerY + r);
        continue;
      }
      const xs = [l.startX, l.endX, l.centerX].filter(isFiniteNumber);
      const ys = [l.startY, l.endY, l.centerY].filter(isFiniteNumber);
      if (xs.length) {
        minX = Math.min(minX, ...xs);
        maxX = Math.max(maxX, ...xs);
      }
      if (ys.length) {
        minY = Math.min(minY, ...ys);
        maxY = Math.max(maxY, ...ys);
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        empty: true,
      };
    }
    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
      empty: false,
    };
  }

  function getCurrentMeta() {
    const c = canvasRef.current;
    const rect = c?.getBoundingClientRect?.() || { width: 0, height: 0 };
    return {
      canvasW: Math.round(rect.width || 0),
      canvasH: Math.round(rect.height || 0),
      dpr: window.devicePixelRatio || 1,
      gridSize,
      feetPerSquare,
      version: 1,
    };
  }

  function sanitizeLines(arr, cw, ch) {
    return (arr || []).map((l) => clampLine(l, cw, ch)).filter(Boolean);
  }

  function buildDiagramPayload() {
    const meta = getCurrentMeta();
    const safe = sanitizeLines(lines, meta.canvasW, meta.canvasH);
    return { lines: safe, meta };
  }

  // one true render path
  function drawScene() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // grid first
    drawGrid(ctx);
    // existing lines
    (lines || []).forEach((L) => drawLine(ctx, L));
    // in-progress line
    if (isDrawing && currentLine) drawLine(ctx, currentLine);
  }

  const [downspoutCoordinates, setDownspoutCoordinates] = useState([0, 0]);
  const [noteCoordinates, setNoteCoordinates] = useState([0, 0]);
  const [lineLength, setLineLength] = useState(0);
  const [isDownspoutModalOpen, setIsDownspoutModalOpen] = useState(false);

  // listen for catalog bumps and ask the context to reload when possible
  // listen for catalog bumps and ask the context to reload when possible
  useEffect(() => {
    const onBump = () => {
      try {
        const reload = reloadRef.current;
        if (typeof reload === "function") reload();
      } catch (e) {
        console.warn(
          "Diagram: catalog reload failed (will still re-render):",
          e
        );
      }
      // force a repaint at minimum
      setLines((prev) => [...prev]);
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

  useEffect(() => {
    if (activeModal === "diagram") {
      // ctx may already be set; safe to call
      drawScene();
    }
  }, [activeModal, lines]); // lines array is your source of truth

  // default tool -> first gutter
  useEffect(() => {
    if (!tool && filteredProducts.length > 0) {
      setTool(filteredProducts[0].name);
    }
  }, [filteredProducts, tool]);
  const metaIn = selectedDiagram?.meta || {};
  const savedGrid = Number(metaIn.gridSize) || gridSize;
  const savedFeet = Number(metaIn.feetPerSquare) || feetPerSquare;
  // Do not push raw savedGrid directly; we must match the geometric scale below.
  if (metaIn && (metaIn.gridSize || metaIn.feetPerSquare)) {
    if (savedFeet !== feetPerSquare) setFeetPerSquare(savedFeet);
  }

  // hydrate lines when a diagram is selected
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const curW = Math.max(1, Math.round(rect.width));
    const curH = Math.max(1, Math.round(rect.height));

    // ----- Upgrader/backfill for old diagrams without meta -----
    const metaIn = selectedDiagram?.meta || {};
    const savedW = Number(metaIn.canvasW) || curW;
    const savedH = Number(metaIn.canvasH) || curH;
    const savedGrid = Number(metaIn.gridSize) || gridSize;
    const savedFeet = Number(metaIn.feetPerSquare) || feetPerSquare;
    // keep state if meta provided, else retain current state
    if (metaIn && (metaIn.gridSize || metaIn.feetPerSquare)) {
      // only update if different to avoid loops
      if (savedGrid !== gridSize) setGridSize(savedGrid);
      if (savedFeet !== feetPerSquare) setFeetPerSquare(savedFeet);
    }
    // If this diagram was saved on a different canvas size, scale coordinates
    const sx = curW / savedW;
    const sy = curH / savedH;
    const kAvg = (sx + sy) / 2; // keep px/ft stable across anisotropic scale

    const scaleLine = (l) => {
      const copy = { ...l };

      // Priced gutter/downspout lines
      if (!copy.isFreeMark && !copy.isNote) {
        if (copy.startX != null) copy.startX = copy.startX * sx;
        if (copy.startY != null) copy.startY = copy.startY * sy;
        if (copy.endX != null) copy.endX = copy.endX * sx;
        if (copy.endY != null) copy.endY = copy.endY * sy;
      }

      // Free-line
      if (copy.isFreeMark && copy.kind === "free-line") {
        if (copy.startX != null) copy.startX = copy.startX * sx;
        if (copy.startY != null) copy.startY = copy.startY * sy;
        if (copy.endX != null) copy.endX = copy.endX * sx;
        if (copy.endY != null) copy.endY = copy.endY * sy;
      }

      // Free-square
      if (copy.isFreeMark && copy.kind === "free-square") {
        if (copy.startX != null) copy.startX = copy.startX * sx;
        if (copy.startY != null) copy.startY = copy.startY * sy;
        if (copy.endX != null) copy.endX = copy.endX * sx;
        if (copy.endY != null) copy.endY = copy.endY * sy;
      }

      // Free-circle
      if (copy.isFreeMark && copy.kind === "free-circle") {
        if (copy.centerX != null) copy.centerX = copy.centerX * sx;
        if (copy.centerY != null) copy.centerY = copy.centerY * sy;
        if (copy.radius != null) copy.radius = copy.radius * ((sx + sy) / 2);
      }

      // Notes
      if (copy.isNote) {
        if (copy.startX != null) copy.startX = copy.startX * sx;
        if (copy.startY != null) copy.startY = copy.startY * sy;
      }

      return copy;
    };

    let withIds = (selectedDiagram?.lines || []).map((l) => ({
      id: l.id || newId(),
      ...scaleLine(l),
    }));

    // Align gridSize with the same overall geometric scaling applied to coordinates
    if (metaIn && (metaIn.gridSize || metaIn.feetPerSquare)) {
      const desiredGrid = Math.max(1, savedGrid * kAvg);
      if (Math.abs(desiredGrid - gridSize) > 0.1) setGridSize(desiredGrid);
    }

    // ----- Auto-fit once if content exceeds canvas by >10% -----
    const bbox = contentBBox(withIds);
    if (!bbox.empty) {
      const overLeft = bbox.left < -0.1 * curW;
      const overTop = bbox.top < -0.1 * curH;
      const overRight = bbox.right > 1.1 * curW;
      const overBottom = bbox.bottom > 1.1 * curH;
      const exceeds = overLeft || overTop || overRight || overBottom;
      const bw = Math.max(1, bbox.width);
      const bh = Math.max(1, bbox.height);
      const k = Math.min(
        (curW - 2 * PADDING_PX) / bw,
        (curH - 2 * PADDING_PX) / bh
      );
      if (exceeds && Number.isFinite(k) && k > 0 && k < 1_000) {
        // scale then center
        withIds = withIds.map((l) => {
          const copy = { ...l };
          const scale = (n) => Number(n) * k;
          if (copy.startX != null) copy.startX = scale(copy.startX - bbox.left);
          if (copy.endX != null) copy.endX = scale(copy.endX - bbox.left);
          if (copy.centerX != null)
            copy.centerX = scale(copy.centerX - bbox.left);
          if (copy.startY != null) copy.startY = scale(copy.startY - bbox.top);
          if (copy.endY != null) copy.endY = scale(copy.endY - bbox.top);
          if (copy.centerY != null)
            copy.centerY = scale(copy.centerY - bbox.top);
          if (copy.radius != null) copy.radius = Number(copy.radius) * k; // circles by uniform k
          // add offset to center inside canvas with padding
          const offX = PADDING_PX + (curW - 2 * PADDING_PX - bw * k) / 2;
          const offY = PADDING_PX + (curH - 2 * PADDING_PX - bh * k) / 2;
          if (copy.startX != null) copy.startX += offX;
          if (copy.endX != null) copy.endX += offX;
          if (copy.centerX != null) copy.centerX += offX;
          if (copy.startY != null) copy.startY += offY;
          if (copy.endY != null) copy.endY += offY;
          if (copy.centerY != null) copy.centerY += offY;
          return copy;
        });
        // VERY IMPORTANT: scale gridSize by the same k to preserve px-per-foot
        setGridSize((g) => Math.max(1, g * k));
      }
    }

    // clamp to canvas and reject invalids
    // clamp to canvas and reject invalids
    withIds = sanitizeLines(withIds, curW, curH)
      // clear any cached derived props so we never render stale labels
      .map((l) => ({ ...l, measurement: undefined, midpoint: undefined }));

    // draw the scaled content exactly as your code does now
    setLines(withIds);

    // If you’re using the baseline-hash to decide overwrite prompts, reset it here
    if (
      typeof baselineHashRef !== "undefined" &&
      baselineHashRef?.current !== undefined
    ) {
      baselineHashRef.current = hashLines(withIds);
    }
  }, [selectedDiagram]);

  useEffect(() => {
    if (activeModal === "diagram") drawScene();
  }, [activeModal, currentLine, lines, isDrawing]);

  // --- stable diagram hashing (only fields that define "meaningful change") ---
  const baselineHashRef = useRef(null);

  const didInitDiagram = useRef(false);

  function round2(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  function normColor(c) {
    return String(c || "")
      .trim()
      .toLowerCase();
  }

  /**
   * Build a normalized snapshot of what matters to the diagram:
   * - Lines (coordinates rounded to 2 decimals, product id/name, kind, color, ds size)
   * - If you later want notes/free marks included, fold them in here similarly.
   */
  function hashLines(lines = []) {
    const norm = (l) => {
      // Notes
      if (l.isNote) {
        return {
          t: "note",
          x: round2(l.startX),
          y: round2(l.startY),
          text: String(l.note || "").trim(),
        };
      }

      // Downspouts (priced)
      if (l.isDownspout) {
        return {
          t: "ds",
          x: round2(l.startX),
          y: round2(l.startY),
          size: l.downspoutSize || null,
          seq: String(l.elbowSequence || "").trim(),
          c: normColor(l.color || "#000"),
        };
      }

      // Free marks (non-priced)
      if (l.isFreeMark) {
        if (l.kind === "free-circle") {
          return {
            t: "fc",
            cx: round2(l.centerX),
            cy: round2(l.centerY),
            r: round2(l.radius || 0),
            fill: !!l.fill,
            c: normColor(l.color || "#111"),
            dashed: !!l.dashed,
            w: Number(l.strokeWidth || 2),
          };
        }
        if (l.kind === "free-square") {
          const left = Math.min(l.startX, l.endX);
          const top = Math.min(l.startY, l.endY);
          const w = Math.abs(l.endX - l.startX);
          const h = Math.abs(l.endY - l.startY);
          return {
            t: "fs",
            x: round2(left),
            y: round2(top),
            w: round2(w),
            h: round2(h),
            fill: !!l.fill,
            c: normColor(l.color || "#111"),
            dashed: !!l.dashed,
            sw: Number(l.strokeWidth || 2),
          };
        }
        // free-line
        return {
          t: "fl",
          x1: round2(l.startX),
          y1: round2(l.startY),
          x2: round2(l.endX),
          y2: round2(l.endY),
          c: normColor(l.color || "#111"),
          dashed: !!l.dashed,
          w: Number(l.strokeWidth || 2),
        };
      }

      // Gutters (priced)
      return {
        t: "gut",
        x1: round2(l.startX),
        y1: round2(l.startY),
        x2: round2(l.endX),
        y2: round2(l.endY),
        pid: l.currentProduct?._id || null,
        pname: l.currentProduct?.name || null,
        c: normColor(
          l.color ||
            l.currentProduct?.colorCode ||
            l.currentProduct?.color ||
            "#000"
        ),
      };
    };

    const core = (lines || []).map(norm);
    // order-independent
    core.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify(core);
  }

  // ======= Geometry / draw helpers =======
  function drawGrid(ctx) {
    const { width, height } = ctx.canvas;
    const size = gridSize;
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  const convertToFeet = (dist) => {
    // dist is in pixels
    // each square is gridSize px and equals feetPerSquare feet
    // => pixels per foot = gridSize / feetPerSquare
    // => feet = pixels / (gridSize / feetPerSquare) = pixels * (feetPerSquare / gridSize)
    const pxPerFoot = gridSize / Math.max(0.0001, feetPerSquare);
    return Math.round(dist / pxPerFoot);
  };

  const snap = (n) => Math.round(n / gridSize) * gridSize;

  function getCanvasCoords(e) {
    const ne = e.nativeEvent;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = ne?.clientX ?? ne?.touches?.[0]?.clientX ?? 0;
    const clientY = ne?.clientY ?? ne?.touches?.[0]?.clientY ?? 0;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function updateLineComputedProps(line) {
    line.midpoint = [
      (line.startX + line.endX) / 2,
      (line.startY + line.endY) / 2,
    ];
    line.measurement = convertToFeet(
      calculateDistance([line.startX, line.startY], [line.endX, line.endY])
    );
    if (isLineParallelToSide(line.startX, line.startY, line.endX, line.endY)) {
      line.isVertical = true;
      line.isHorizontal = false;
      line.position =
        line.midpoint[0] >= window.innerWidth / 2 ? "right" : "left";
    } else if (
      isLineParallelToTop(line.startX, line.startY, line.endX, line.endY)
    ) {
      line.isHorizontal = true;
      line.isVertical = false;
      line.position =
        line.midpoint[1] <= window.innerHeight / 2 ? "top" : "bottom";
    } else {
      line.isVertical = false;
      line.isHorizontal = false;
    }
    return line;
  }

  // hit tests
  function hitTestLine(line, x, y) {
    const EP = Math.max(6, gridSize * 0.6);
    if (calculateDistance([x, y], [line.startX, line.startY]) <= EP)
      return { hit: "start" };
    if (calculateDistance([x, y], [line.endX, line.endY]) <= EP)
      return { hit: "end" };
    if (
      isLineNearPoint(line.startX, line.startY, line.endX, line.endY, x, y, 6)
    )
      return { hit: "body" };
    return null;
  }

  function hitTestFreeSquare(sq, x, y) {
    const left = Math.min(sq.startX, sq.endX);
    const top = Math.min(sq.startY, sq.endY);
    const w = Math.abs(sq.endX - sq.startX);
    const h = Math.abs(sq.endY - sq.startY);

    if (w <= 0 || h <= 0) return false;

    if (sq.fill) {
      // Click inside filled rect selects
      return x >= left && x <= left + w && y >= top && y <= top + h;
    }

    // For stroked (not filled): near any edge within tolerance
    const EP = Math.max(6, gridSize * 0.6);
    const onLeft = Math.abs(x - left) <= EP && y >= top && y <= top + h;
    const onRight = Math.abs(x - (left + w)) <= EP && y >= top && y <= top + h;
    const onTop = Math.abs(y - top) <= EP && x >= left && x <= left + w;
    const onBottom =
      Math.abs(y - (top + h)) <= EP && x >= left && x <= left + w;
    return onLeft || onRight || onTop || onBottom;
  }

  function hitTestFreeCircle(circ, x, y) {
    const cx = circ.centerX ?? circ.startX ?? 0;
    const cy = circ.centerY ?? circ.startY ?? 0;
    const R = Number(circ.radius || 0);
    if (R <= 0) return false;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    if (circ.fill) {
      // Click anywhere inside the filled circle
      return dist <= R;
    }

    // For stroked only: near the ring
    const EP = Math.max(6, gridSize * 0.6);
    return Math.abs(dist - R) <= EP;
  }

  function hitTestDownspout(ds, x, y) {
    const r = gridSize;
    // center/X
    if (calculateDistance([x, y], [ds.startX, ds.startY]) <= r) {
      return { part: "center" };
    }

    // compute the dynamic box rect exactly as in draw
    const w = 60;
    const h = 28;
    const angle =
      typeof ds.elbowBoxAngle === "number" ? ds.elbowBoxAngle : Math.PI / 4;
    const radius =
      typeof ds.elbowBoxRadius === "number" ? ds.elbowBoxRadius : gridSize * 5;

    const cx = ds.startX + radius * Math.cos(angle);
    const cy = ds.startY + radius * Math.sin(angle);
    const boxX = cx - w / 2;
    const boxY = cy - h / 2;

    if (x >= boxX && x <= boxX + w && y >= boxY && y <= boxY + h) {
      return { part: "box" };
    }

    return null;
  }

  function hitTestAnnotation(note, x, y) {
    const ctx = canvasRef.current.getContext("2d");
    ctx.font = "1000 12px Arial";
    const text = note.note || "";
    const w = ctx.measureText(text).width;
    const padX = 6;
    const padY = 4;
    const h = 12;
    const x1 = note.startX - w / 2 - padX;
    const y1 = note.startY - h - padY;
    const W = w + padX * 2;
    const H = h + padY * 2;
    return x >= x1 && x <= x1 + W && y >= y1 && y <= y1 + H;
  }

  function selectIndex(i) {
    setLines((prev) => prev.map((l, idx) => ({ ...l, isSelected: idx === i })));
    setSelectedIndex(i);
  }
  function bringToFront(i) {
    setLines((prev) => {
      const next = [...prev];
      const [picked] = next.splice(i, 1);
      next.push(picked);
      setSelectedIndex(next.length - 1);
      return next.map((l, idx) => ({
        ...l,
        isSelected: idx === next.length - 1,
      }));
    });
  }
  function deleteSelected() {
    if (selectedIndex === null) return;
    setLines((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    setDragging({ mode: "none", end: null, lastX: 0, lastY: 0 });
  }

  // ======= Product helpers =======
  function currentProductFromTool() {
    return filteredProducts.find((p) => p.name === tool);
  }

  function productColor(p) {
    // prefer explicit color, then visual, then template defaultColor, then black
    return (
      p?.colorCode ?? p?.visual ?? p?.color ?? p?.defaultColor ?? "#000000"
    );
  }

  function gutterProfileKeyFromProductName(name) {
    return normalizeGutterKey(name);
  }

  // ======= Drawing =======
  function drawAllLines(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawGrid(ctx);
    for (const L of lines) drawLine(ctx, L);
    if (isDrawing) drawLine(ctx, currentLine);
  }

  function placeMeasurement(line, measurement, x, y) {
    const ctx = canvasRef.current.getContext("2d");
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "black";

    if (line.isHorizontal) {
      ctx.fillText(
        `${measurement}'`,
        x,
        y + (line.position === "top" ? -gridSize / 1.5 : gridSize * 1.5)
      );
    } else if (line.isVertical) {
      ctx.fillText(
        `${measurement}'`,
        x + (line.position === "left" ? -gridSize / 0.75 : gridSize * 1.25),
        y
      );
    } else {
      ctx.fillText(`${measurement}'`, x, y - gridSize / 1.5);
    }
  }

  function drawLine(ctx, line) {
    const x1 = snap(line.startX);
    const y1 = snap(line.startY);
    const x2 = snap(line.endX);
    const y2 = snap(line.endY);

    // Annotation text
    if (line.isNote) {
      ctx.font = "1000 12px Arial";
      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.fillText(line.note, x1, y1);
      if (line.isSelected) {
        const w = ctx.measureText(line.note || "").width;
        const padX = 6;
        const padY = 4;
        const h = 12;
        ctx.save();
        ctx.strokeStyle = "orange";
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(
          x1 - w / 2 - padX,
          y1 - h - padY,
          w + padX * 2,
          h + padY * 2
        );
        ctx.restore();
      }
      return;
    }

    // Downspout (priced)
    if (line.isDownspout) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + gridSize / 2.75, y1 + gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - gridSize / 2.75, y1 + gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - gridSize / 2.75, y1 - gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + gridSize / 2.75, y1 - gridSize / 2.75);
      ctx.strokeStyle = line.color || "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      const w = 60;
      const h = 28;

      // defaults if missing (for old diagrams)
      const angle =
        typeof line.elbowBoxAngle === "number"
          ? line.elbowBoxAngle
          : Math.PI / 4;
      const radius =
        typeof line.elbowBoxRadius === "number"
          ? line.elbowBoxRadius
          : gridSize * 5;

      // center of the label box relative to the X
      const cx = x1 + radius * Math.cos(angle);
      const cy = y1 + radius * Math.sin(angle);

      // top-left corner for drawing the rect
      const boxX = cx - w / 2;
      const boxY = cy - h / 2;

      ctx.fillStyle = "grey";
      ctx.fillRect(boxX, boxY, w, h);
      ctx.strokeStyle = line.color || "#000";
      ctx.strokeRect(boxX, boxY, w, h);

      // label: UPPERCASE sequence and footage
      const seq = String(line.elbowSequence || "").toUpperCase();
      const ft = Number.isFinite(Number(line.measurement))
        ? `${Number(line.measurement)}'`
        : ""; // or "0'" if you prefer always showing
      ctx.fillStyle = "white";
      ctx.textAlign = "center";

      // top line: sequence
      ctx.font = "10px Arial";
      ctx.fillText(seq, boxX + w / 2, boxY + 11);

      // bottom line: footage
      ctx.font = "10px Arial";
      ctx.fillText(ft, boxX + w / 2, boxY + 22);

      if (line.isSelected) {
        ctx.save();
        ctx.strokeStyle = "orange";
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(boxX - 4, boxY - 4, w + 8, h + 8);
        ctx.restore();
      }

      return;
    }

    // Splash Guard / Valley Shield (solid circle, non-priced)
    if (line.isFreeMark && line.kind === "free-circle" && line.fill) {
      const R = line.radius || gridSize * 0.8;
      ctx.beginPath();
      ctx.arc(x1, y1, R, 0, Math.PI * 2);
      ctx.fillStyle = line.color || "#111";
      ctx.fill();
      if (line.isSelected) {
        ctx.save();
        ctx.strokeStyle = "orange";
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x1 - R - 6, y1 - R - 6, (R + 6) * 2, (R + 6) * 2);
        ctx.restore();
      }
      return;
    }

    // Free marks (line/square/hollow circle) — not priced
    // --- Free marks (free-line, free-square, free-circle) ---
    if (line.isFreeMark) {
      ctx.save();

      // stroke style
      ctx.lineWidth = line.strokeWidth ?? 2;
      ctx.strokeStyle = line.color ?? "#111";
      ctx.setLineDash(line.dashed ? [6, 4] : []);

      if (line.kind === "free-line") {
        // draw the line itself
        ctx.beginPath();
        ctx.moveTo(line.startX, line.startY);
        ctx.lineTo(line.endX, line.endY);
        ctx.stroke();

        // show edit handles when selected (same UX as gutters)
        if (line.isSelected) {
          const handleR = Math.max(
            MIN_HANDLE_PX,
            (typeof gridSize === "number" ? gridSize : 8) / 2
          );
          ctx.setLineDash([]); // handles are solid
          ctx.fillStyle = "orange";

          // start handle
          ctx.beginPath();
          ctx.arc(line.startX, line.startY, handleR, 0, Math.PI * 2);
          ctx.fill();

          // end handle
          ctx.beginPath();
          ctx.arc(line.endX, line.endY, handleR, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (line.kind === "free-square") {
        const left = Math.min(line.startX, line.endX);
        const top = Math.min(line.startY, line.endY);
        const w = Math.abs(line.endX - line.startX);
        const h = Math.abs(line.endY - line.startY);
        if (line.fill) {
          ctx.fillStyle = line.color ?? "#111";
          ctx.fillRect(left, top, w, h);
        } else {
          ctx.strokeRect(left, top, w, h);
        }
      } else if (line.kind === "free-circle") {
        ctx.beginPath();
        ctx.arc(line.centerX, line.centerY, line.radius ?? 0, 0, Math.PI * 2);
        if (line.fill) {
          ctx.fillStyle = line.color ?? "#111";
          ctx.fill();
        } else {
          ctx.stroke();
        }
      }

      ctx.restore();
      return;
    }

    // Gutter line (priced)
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = line.isSelected
      ? "orange"
      : line.currentProduct?.color || line.color || "#000";
    ctx.stroke();

    if (line.isSelected) {
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(x1, y1, Math.max(MIN_HANDLE_PX, gridSize / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, Math.max(MIN_HANDLE_PX, gridSize / 2), 0, Math.PI * 2);
      ctx.fill();
    }

    // Derive fresh label position & feet from snapped endpoints
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const feetNow = convertToFeet(calculateDistance([x1, y1], [x2, y2]));
    placeMeasurement(
      {
        ...line,
        isHorizontal: line.isHorizontal,
        isVertical: line.isVertical,
        position: line.position,
      },
      feetNow,
      midX,
      midY
    );
  }

  async function saveCurrentDiagram() {
    const payload = buildDiagramPayload();
    // Prefer the host app’s provided callbacks; do not change their signatures
    try {
      if (
        selectedDiagram &&
        selectedDiagram._id &&
        typeof updateDiagram === "function"
      ) {
        await updateDiagram(selectedDiagram._id, payload);
      } else if (typeof addDiagramToProject === "function") {
        await addDiagramToProject(currentProjectId, payload);
      } else if (typeof handlePassDiagramData === "function") {
        // last-resort generic bridge used elsewhere in your app
        await handlePassDiagramData(payload);
      }
    } finally {
      // no modal/UX assumptions here
    }
  }

  // ======= Tools =======
  function handleToolSelectChange(e) {
    setTool(e.target.value);
    setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
    setSelectedIndex(null);
  }

  function handleAddDownspout(downspoutData) {
    const currentDownspout = (allProducts || []).find((p) => {
      return (
        /ownspout/i.test(p.name) &&
        p.name.toLowerCase().includes(downspoutData.profile.toLowerCase()) &&
        p.name.includes(downspoutData.downspoutSize.split(" ")[0])
      );
    });

    // If we came from clicking an existing DS box: update instead of creating a new line
    if (editingDownspoutIndex !== null) {
      setLines((prev) => {
        const next = [...prev];
        const ds = next[editingDownspoutIndex];
        if (!ds || !ds.isDownspout) return prev;

        // Keep product mapping logic consistent with add flow
        const currentDownspout = (allProducts || []).find((p) => {
          return (
            /ownspout/i.test(p.name) &&
            p.name
              .toLowerCase()
              .includes(downspoutData.profile.toLowerCase()) &&
            (p.name.includes(downspoutData.downspoutSize) ||
              p.size === downspoutData.downspoutSize)
          );
        });

        // Force uppercase sequence and update footage (measurement)
        ds.elbowSequence = String(
          downspoutData.elbowSequence || ""
        ).toUpperCase();
        ds.profile = downspoutData.profile; // persist the profile family ("corrugated" | "smooth" | "box" | "round")
        ds.measurement = parseInt(downspoutData.totalFootage, 10) || 0;

        // If size/profile changed in modal, reflect that too
        ds.downspoutSize = downspoutData.downspoutSize;
        ds.currentProduct = {
          price: currentDownspout?.price || ds.currentProduct?.price || 0,
          name: formatDownspoutName(
            downspoutData.downspoutSize,
            downspoutData.profile
          ),
          description:
            currentDownspout?.description ||
            ds.currentProduct?.description ||
            "",
        };
        ds.price = currentDownspout?.price || ds.price || 0;
        ds.color = currentDownspout?.visual || ds.color || "#000";

        return next;
      });

      // Close modal and clear edit state
      setIsDownspoutModalOpen(false);
      setActiveModal(null);
      setEditingDownspoutIndex(null);
      return;
    }

    const formatted = {
      id: newId(),
      startX: downspoutCoordinates[0],
      startY: downspoutCoordinates[1],
      endX: downspoutCoordinates[0],
      endY: downspoutCoordinates[1],
      midpoint: null,
      measurement: parseInt(downspoutData.totalFootage, 10),
      color: currentDownspout?.color || "#000",
      isSelected: false,
      isDownspout: true,
      profile: downspoutData.profile,
      price: currentDownspout?.price || 0,
      elbowSequence: downspoutData.elbowSequence,
      downspoutSize: downspoutData.downspoutSize,
      currentProduct: {
        price: currentDownspout?.price || 0,
        name: formatDownspoutName(
          downspoutData.downspoutSize,
          downspoutData.profile
        ),
        description: currentDownspout?.description || "",
      },
      rainBarrel: downspoutData.rainBarrel,
      splashBlock: downspoutData.splashBlock,
      undergroundDrainage: downspoutData.undergroundDrainage,
      elbowBoxAngle: Math.PI / 4, // 45°, keeps your current “bottom-right-ish” vibe
      elbowBoxRadius: gridSize * 5, // tweak as you like
    };
    console.log(currentDownspout);
    setLines((prev) => [...prev, formatted]);
  }

  function addNote(note) {
    const n = {
      id: newId(),
      startX: noteCoordinates[0],
      startY: noteCoordinates[1],
      endX: noteCoordinates[0],
      endY: noteCoordinates[1],
      isSelected: false,
      isNote: true,
      note,
      color: "black",
    };
    setLines((prev) => [...prev, n]);
  }

  // ======= Pointer handlers =======
  function handleMouseDown(e) {
    if (isDownspoutModalOpen) return;

    const { x, y } = getCanvasCoords(e);
    const snappedX = snap(x);
    const snappedY = snap(y);

    // Downspout
    if (tool === "downspout") {
      setDownspoutCoordinates([snappedX, snappedY]);
      setIsDownspoutModalOpen(true);
      setActiveModal("downspout");
      return;
    }

    // Note
    if (tool === "note") {
      setNoteCoordinates([snappedX, snappedY]);
      setActiveModal("note");
      return;
    }

    // Splash Guard / Valley Shield (solid circle mark, not priced)
    if (tool === "splashGuard") {
      const mark = {
        id: newId(),
        isFreeMark: true,
        kind: "free-circle",
        fill: true,
        color: "#111111",
        dashed: false,
        strokeWidth: 2,
        centerX: snappedX,
        centerY: snappedY,
        startX: snappedX, // <-- add
        startY: snappedY,
        radius: 4,
        isSelected: false,
      };
      setLines((prev) => [...prev, mark]);
      return;
    }

    // Select
    if (tool === "select") {
      let hitIndex = null;
      let dragMode = "none";
      let end = null;

      for (let i = lines.length - 1; i >= 0; i--) {
        const el = lines[i];

        if (el.isNote) {
          if (hitTestAnnotation(el, x, y)) {
            // bring note to front
            bringToFront(i);
            // start as a move, but decide click-vs-drag on mouseup
            setDragging({ mode: "move", end: null, lastX: x, lastY: y });
            noteClickRef.current = { x, y, index: lines.length - 1 }; // after bringToFront
            return;
          }
        } else if (el.isDownspout) {
          const hit = hitTestDownspout(el, x, y);
          if (hit) {
            if (hit.part === "box") {
              // start a box-drag, but decide "open modal vs drag" on mouseup
              bringToFront(i);
              setDragging({ mode: "move-box", end: null, lastX: x, lastY: y });
              boxClickRef.current = { x, y, index: lines.length - 1 }; // top after bringToFront
              return;
            } else {
              // click on the X moves the whole DS
              hitIndex = i;
              dragMode = "move";
              break;
            }
          }
        } else if (el.isFreeMark) {
          // Unified free-shape hit-testing: line endpoints/body OR square/circle
          let h = null;

          if (el.kind === "free-line") {
            h = hitTestLine(
              {
                startX: el.startX,
                startY: el.startY,
                endX: el.endX,
                endY: el.endY,
              },
              x,
              y
            );
          } else if (el.kind === "free-square") {
            h = hitTestFreeSquare(el, x, y) ? { hit: "body" } : null;
          } else if (el.kind === "free-circle") {
            h = hitTestFreeCircle(el, x, y) ? { hit: "body" } : null;
          }

          if (h) {
            hitIndex = i;
            if (h.hit === "start" || h.hit === "end") {
              dragMode = "drag-end";
              end = h.hit === "start" ? "start" : "end";
            } else {
              dragMode = "move";
            }
            break;
          }
        } else {
          const hit = hitTestLine(el, x, y);
          if (hit) {
            hitIndex = i;
            if (hit.hit === "start" || hit.hit === "end") {
              dragMode = "drag-end";
              end = hit.hit;
            } else {
              dragMode = "move";
            }
            break;
          }
        }
      }

      if (hitIndex !== null) {
        bringToFront(hitIndex);
        setDragging({
          mode: dragMode,
          end: end ?? null,
          lastX: x,
          lastY: y,
        });
        return;
      }

      setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
      setSelectedIndex(null);
      setDragging({ mode: "none", end: null, lastX: 0, lastY: 0 });
      return;
    }

    // Free Line / Square / Circles (non-priced)
    // Free Line / Square / Circles (non-priced)
    // Free Line / Square / Circles (non-priced)
    if (tool === "freeLine") {
      // Keep mini-UI selections
      const base = {
        ...currentLine,
        id: newId(),
        isFreeMark: true,
        color: currentLine.color || "#111111",
        dashed: !!currentLine.dashed,
        strokeWidth: currentLine.strokeWidth ?? 2,
        isSelected: false,
        kind: currentLine.kind || "free-line",
        fill: currentLine.fill,
        radius: currentLine.radius,
      };

      if (base.kind === "free-line") {
        // drag-to-draw line
        setCurrentLine({
          ...base,
          startX: snappedX,
          startY: snappedY,
          endX: snappedX,
          endY: snappedY,
        });
        setIsDrawing(true);
        return;
      }

      if (base.kind === "free-square") {
        // CLICK-TO-PLACE: static square
        const size = Math.max(16, gridSize);
        const half = Math.floor(size / 2);
        const sq = {
          ...base,
          startX: snappedX - half,
          startY: snappedY - half,
          endX: snappedX + half,
          endY: snappedY + half,
          fill: !!base.fill,
        };
        setLines((prev) => [...prev, sq]);
        return; // no drawing session
      }

      if (base.kind === "free-circle") {
        // CLICK-TO-PLACE: static circle
        const R = base.radius ?? Math.max(4, Math.floor(gridSize));
        const circ = {
          ...base,
          centerX: snappedX,
          centerY: snappedY,
          radius: R / 2,
          startX: snappedX, // harmless for other code
          startY: snappedY,
          fill: !!base.fill,
        };
        setLines((prev) => [...prev, circ]);
        return; // no drawing session
      }

      // fallback to line
      setCurrentLine({
        ...base,
        kind: "free-line",
        startX: snappedX,
        startY: snappedY,
        endX: snappedX,
        endY: snappedY,
      });
      setIsDrawing(true);
      return;
    }

    // Default: start drawing a new GUTTER line (priced)
    setCurrentLine({
      startX: snappedX,
      startY: snappedY,
      endX: snappedX,
      endY: snappedY,
      isVertical: false,
      isHorizontal: false,
      isSelected: false,
      color: "black",
    });
    setIsDrawing(true);
  }

  function handleMouseMove(e) {
    if (isDownspoutModalOpen) return;

    const { x, y } = getCanvasCoords(e);
    const sx = snap(x);
    const sy = snap(y);

    if (
      tool === "select" &&
      dragging.mode !== "none" &&
      selectedIndex !== null
    ) {
      const dx = x - dragging.lastX;
      const dy = y - dragging.lastY;

      setLines((prev) => {
        const next = [...prev];
        const el = next[selectedIndex];
        if (!el) return prev;

        if (el.isNote) {
          // unchanged
          el.startX += dx;
          el.startY += dy;
          el.endX = el.startX;
          el.endY = el.startY;
        } else if (el.isDownspout) {
          if (dragging.mode === "move-box") {
            // Reposition the box by angle around the X
            const angle = Math.atan2(y - el.startY, x - el.startX);
            // optional: snap angle slightly if you want discrete stops
            el.elbowBoxAngle = angle;
            // keep radius stable; or allow CTRL+drag to adjust radius later
            el.elbowBoxRadius =
              typeof el.elbowBoxRadius === "number"
                ? el.elbowBoxRadius
                : gridSize * 4;
          } else {
            // moving the entire downspout (X)
            el.startX += dx;
            el.startY += dy;
            el.endX = el.startX;
            el.endY = el.startY;
          }
        } else if (el.isFreeMark) {
          if (el.kind === "free-line") {
            if (dragging.mode === "move") {
              el.startX += dx;
              el.startY += dy;
              el.endX += dx;
              el.endY += dy;
            } else if (dragging.mode === "drag-end") {
              if (dragging.end === "start") {
                el.startX = sx;
                el.startY = sy;
              } else {
                el.endX = sx;
                el.endY = sy;
              }
            }
          } else if (el.kind === "free-square") {
            el.startX += dx;
            el.startY += dy;
            el.endX += dx;
            el.endY += dy;
          } else if (el.kind === "free-circle") {
            el.centerX += dx;
            el.centerY += dy;
          }
        } else {
          if (dragging.mode === "move") {
            el.startX += dx;
            el.startY += dy;
            el.endX += dx;
            el.endY += dy;
          } else if (dragging.mode === "drag-end") {
            if (dragging.end === "start") {
              el.startX = sx;
              el.startY = sy;
            } else {
              el.endX = sx;
              el.endY = sy;
            }
          }
          updateLineComputedProps(el);
        }
        return next;
      });

      setDragging((prev) => ({ ...prev, lastX: x, lastY: y }));
      return;
    }

    if (
      isDrawing &&
      tool !== "downspout" &&
      tool !== "select" &&
      tool !== "note"
    ) {
      if (tool === "freeLine") {
        // Only lines are drag-updated; circle/square are click-to-place
        if ((currentLine.kind || "free-line") === "free-line") {
          setCurrentLine((prev) => ({ ...prev, endX: sx, endY: sy }));
        }
        return;
      }

      if (
        isLineParallelToSide(
          currentLine.startX,
          currentLine.startY,
          currentLine.endX,
          currentLine.endY
        ) ||
        isLineParallelToTop(
          currentLine.startX,
          currentLine.startY,
          currentLine.endX,
          currentLine.endY
        )
      ) {
        setCurrentLine((prevLine) => ({
          ...prevLine,
          endX: sx,
          endY: sy,
          color: "#14c414",
        }));
      } else {
        setCurrentLine((prevLine) => ({
          ...prevLine,
          endX: sx,
          endY: sy,
          color: "black",
        }));
      }

      const pt1 = [currentLine.startX, currentLine.startY];
      const pt2 = [sx, sy];
      setLineLength(convertToFeet(calculateDistance(pt1, pt2)));
    }
  }

  function handleMouseUp() {
    // open modal if we "clicked" the DS box (not dragged it)
    if (tool === "select" && dragging.mode === "move-box") {
      const { x, y } = boxClickRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      const up = getCanvasCoords({
        nativeEvent: { clientX: dragging.lastX, clientY: dragging.lastY },
      });
      const moved = Math.hypot(up.x - x, up.y - y);
      // threshold ~4px
      if (moved < 4 && selectedIndex !== null) {
        const ds = lines[selectedIndex];
        if (ds?.isDownspout) {
          setEditingDownspoutIndex(selectedIndex);
          setDownspoutCoordinates([ds.startX, ds.startY]);
          setIsDownspoutModalOpen(true);
          setActiveModal("downspout");
        }
      }
      // reset drag state
      setDragging({ mode: "none", end: null, lastX: 0, lastY: 0 });
      setIsDrawing(false);
      return;
    }

    if (isDownspoutModalOpen) return;

    // open AnnotationModal if we "clicked" a note (not dragged it)
    if (tool === "select" && noteClickRef.current.index !== null) {
      const { x: downX, y: downY, index } = noteClickRef.current;
      const upXY = getCanvasCoords({
        nativeEvent: { clientX: dragging.lastX, clientY: dragging.lastY },
      });
      const moved = Math.hypot(upXY.x - downX, upXY.y - downY);
      // small threshold => treat as click
      if (moved < 4) {
        const noteLine = lines[index];
        if (noteLine?.isNote) {
          setEditingNoteIndex(index);
          setActiveModal("note"); // reuse your existing modal slot
        }
      }
      // reset the click ref
      noteClickRef.current = { x: 0, y: 0, index: null };
    }

    if (tool === "select") {
      setDragging({ mode: "none", end: null, lastX: 0, lastY: 0 });
      setIsDrawing(false);
      return;
    }
    if (tool === "note" || tool === "downspout") {
      setIsDrawing(false);
      return;
    }

    // Free tool commit
    // Free tool commit
    if (tool === "freeLine") {
      const c = currentLine;
      if (!c) {
        setIsDrawing(false);
        return;
      }

      // Only commit if we were drawing a line; circle/square are click-to-place
      if ((c.kind || "free-line") !== "free-line") {
        setIsDrawing(false);
        return;
      }

      if (c.startX === c.endX && c.startY === c.endY) {
        setIsDrawing(false);
        return;
      }

      // Ensure dashed/color persist to committed element
      setLines((prev) => [
        ...prev,
        {
          ...c,
          dashed: !!c.dashed,
          color: c.color || "#111111",
          isFreeMark: true,
        },
      ]);
      setIsDrawing(false);
      setLineLength(0);
      return;
    }

    // Commit gutter line (priced)
    if (isDrawing) {
      const prod = currentProductFromTool();
      const committed = { ...currentLine };

      committed.midpoint = [
        (committed.startX + committed.endX) / 2,
        (committed.startY + committed.endY) / 2,
      ];
      committed.measurement = convertToFeet(
        calculateDistance(
          [committed.startX, committed.startY],
          [committed.endX, committed.endY]
        )
      );
      updateLineComputedProps(committed);
      committed.currentProduct = prod || null;
      committed.color = prod ? productColor(prod) : "black";

      if (
        committed.startX === committed.endX &&
        committed.startY === committed.endY
      ) {
        setIsDrawing(false);
        setLineLength(0);
        return;
      }

      setLines((prev) => [...prev, committed]);
      setIsDrawing(false);
      setLineLength(0);
    }
  }

  // ======= Analyze joints (end caps & miters) =======
  function centroidOfLines(all) {
    if (!all.length) return { x: 0, y: 0 };
    let sx = 0,
      sy = 0;
    all.forEach((L) => {
      sx += (L.startX + L.endX) / 2;
      sy += (L.startY + L.endY) / 2;
    });
    return { x: sx / all.length, y: sy / all.length };
  }
  const JOINT_SNAP = 1;
  const keyForPoint = (x, y, tol = JOINT_SNAP) =>
    `${Math.round(x / tol) * tol}|${Math.round(y / tol) * tol}`;
  const len = (v) => Math.hypot(v.x, v.y);
  const norm = (v) => {
    const L = len(v) || 1;
    return { x: v.x / L, y: v.y / L };
  };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const angleBetweenDeg = (a, b) => {
    const A = norm(a),
      B = norm(b);
    const c = Math.min(1, Math.max(-1, dot(A, B)));
    return (Math.acos(c) * 180) / Math.PI;
  };
  const cornerBisector = (vA, vB) => {
    const A = norm(vA),
      B = norm(vB);
    const bx = A.x + B.x,
      by = A.y + B.y;
    const L = Math.hypot(bx, by);
    if (L < 1e-6) return { x: 0, y: 0 };
    return { x: bx / L, y: by / L };
  };
  const isStraight = (ang) => ang > 175;
  const isRight = (ang) => ang >= 80 && ang <= 100;
  const isBay = (ang) => ang >= 130 && ang <= 150;

  function analyzeJoints(allLines) {
    const gutters = allLines
      .filter(
        (L) => !L.isNote && !L.isDownspout && !L.isFreeMark && L.currentProduct
      )
      .map((L) => ({
        L,
        key: gutterProfileKeyFromProductName(L.currentProduct.name),
      }));

    const center = centroidOfLines(gutters.map((g) => g.L));
    const joints = new Map();

    gutters.forEach(({ L, key }, idx) => {
      const sK = keyForPoint(L.startX, L.startY);
      const eK = keyForPoint(L.endX, L.endY);
      if (!joints.has(sK))
        joints.set(sK, { x: L.startX, y: L.startY, members: [] });
      if (!joints.has(eK))
        joints.set(eK, { x: L.endX, y: L.endY, members: [] });
      joints.get(sK).members.push({ lineIndex: idx, end: "start", key });
      joints.get(eK).members.push({ lineIndex: idx, end: "end", key });
    });

    const endCapsByProduct = Object.create(null);
    const miters = Object.create(null);
    const mixed = Object.create(null);

    const ensure = (obj, k) =>
      obj[k] ||
      (obj[k] = { inside90: 0, outside90: 0, bay135: 0, custom: new Map() });

    joints.forEach((joint) => {
      const { x: JX, y: JY, members } = joint;
      const degree = members.length;

      if (degree === 1) {
        const k = members[0].key;
        endCapsByProduct[k] = (endCapsByProduct[k] || 0) + 1;
        return;
      }
      if (degree < 2) return;

      const rays = members
        .map(({ lineIndex, end, key }) => {
          const L = gutters[lineIndex].L;
          const ox = end === "start" ? L.endX : L.startX;
          const oy = end === "start" ? L.endY : L.startY;
          return {
            key,
            v: { x: ox - JX, y: oy - JY },
            angle: Math.atan2(oy - JY, ox - JX),
          };
        })
        .filter((r) => len(r.v) > 0.0001)
        .sort((a, b) => a.angle - b.angle);

      const pairs =
        rays.length === 2
          ? [[rays[0], rays[1]]]
          : rays.map((r, i) => [r, rays[(i + 1) % rays.length]]);
      const toC = { x: center.x - JX, y: center.y - JY };

      pairs.forEach(([A, B]) => {
        const ang = angleBetweenDeg(A.v, B.v);
        if (isStraight(ang)) return;

        const bis = cornerBisector(A.v, B.v);
        const facesCenter = bis.x * toC.x + bis.y * toC.y > 0;
        let label = "custom";
        if (isRight(ang)) label = facesCenter ? "inside90" : "outside90";
        else if (isBay(ang)) label = "bay135";

        if (A.key === B.key) {
          const b = ensure(miters, A.key);
          if (label === "inside90") b.inside90 += 1;
          else if (label === "outside90") b.outside90 += 1;
          else if (label === "bay135") b.bay135 += 1;
          else
            b.custom.set(
              Math.round(ang),
              (b.custom.get(Math.round(ang)) || 0) + 1
            );
        } else {
          const combo = [A.key, B.key].sort().join(" + ");
          const b = ensure(mixed, combo);
          if (label === "inside90") b.inside90 += 1;
          else if (label === "outside90") b.outside90 += 1;
          else if (label === "bay135") b.bay135 += 1;
          else
            b.custom.set(
              Math.round(ang),
              (b.custom.get(Math.round(ang)) || 0) + 1
            );
        }
      });
    });

    const finalize = (obj) => {
      const out = {};
      Object.entries(obj).forEach(([k, v]) => {
        out[k] = {
          inside90: v.inside90,
          outside90: v.outside90,
          bay135: v.bay135,
          custom: [...v.custom.entries()].map(([angle, count]) => ({
            angle,
            count,
          })),
        };
      });
      return out;
    };

    return {
      endCapsByProduct,
      mitersByProduct: finalize(miters),
      mixedMiters: finalize(mixed),
    };
  }

  // --- Touch → Mouse delegators so mobile can draw & commit ---
  function handleTouchStart(e) {
    e.preventDefault(); // keep the page from scrolling
    handleMouseDown(e); // your getCanvasCoords already reads touches
  }
  function handleTouchMove(e) {
    e.preventDefault();
    handleMouseMove(e);
  }
  function handleTouchEnd(e) {
    e.preventDefault();
    handleMouseUp(e);
  }

  // ======= Save diagram =======
  // ⬇️ drop in place of your current saveDiagram
  async function saveDiagram(saveType) {
    setSelectedIndex(null);

    // --- mobile/iOS safety: draw then yield a frame before reading canvas ---
    const raf = () => new Promise((res) => requestAnimationFrame(res));
    async function ensureCanvasPainted(ctx, drawFn) {
      drawFn(ctx);
      await raf(); // let the GPU present before we read pixels / toDataURL
    }

    function foldAccessoryItems(items) {
      const map = new Map();

      (items || []).forEach((it) => {
        const isAccessory =
          it?.meta &&
          ["miter", "endcap", "elbow", "offset"].includes(it.meta.kind);

        // For accessories: do NOT rely on product._id. Use meta to preserve intent.
        // For base rows (gutters/downspouts), product id/name is fine.
        const key = isAccessory
          ? [
              it.meta?.kind || "", // miter | endcap | elbow | offset
              it.meta?.miterType || "", // strip | bay | custom
              it.meta?.degrees ?? "", // number for custom miters
              it.meta?.code || "", // A | B for elbows
              it.meta?.inches || "", // 2 | 4 | 6 for offsets
              it.meta?.size || it.meta?.sizeLabel || "",
              it.meta?.profileKey || it.meta?.profile || "",
              it.name || "", // tie-breaker so renamed customs stay separate
            ].join("|")
          : it.product?._id || it.name || "base";

        const prev = map.get(key);
        if (prev) {
          prev.quantity = Number(prev.quantity || 0) + Number(it.quantity || 0);
        } else {
          map.set(key, { ...it, quantity: Number(it.quantity || 0) });
        }
      });

      return Array.from(map.values());
    }

    // Require content to save
    if (lines.length === 0) {
      alert("Add at least one line before saving.");
      return;
    }

    // Only enforce "no changes" for existing diagrams
    const isExisting = Boolean(selectedDiagram?._id);
    const currentHash = hashLines(lines);
    if (isExisting) {
      const hasChanged = currentHash !== baselineHashRef.current;
      if (!hasChanged) {
        alert("No changes to save.");
        return;
      }
    }

    // Require a project id
    const resolvedProjectId =
      currentProjectId ||
      selectedDiagram?.projectId ||
      originalDiagram?.projectId ||
      null;
    if (!resolvedProjectId) {
      alert("Please select a project before saving a diagram.");
      return;
    }

    // --- thumb bounds for ALL elements (lines, notes, free marks, downspouts) ---
    function boundsUnion(a, b) {
      return {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
      };
    }
    function elementBounds(el, ctx) {
      let box = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };

      if (!el.isFreeMark && !el.isNote && !el.isDownspout) {
        return {
          minX: Math.min(el.startX, el.endX),
          minY: Math.min(el.startY, el.endY),
          maxX: Math.max(el.startX, el.endX),
          maxY: Math.max(el.startY, el.endY),
        };
      }

      if (el.isNote) {
        const text = String(el.note || "");
        ctx.save();
        ctx.font = "1000 12px Arial";
        const width = ctx.measureText(text).width;
        ctx.restore();
        const paddingX = 6;
        const paddingY = 4;
        const height = 12;
        const x1 = el.startX - width / 2 - paddingX;
        const y1 = el.startY - height - paddingY;
        return {
          minX: x1,
          minY: y1,
          maxX: x1 + width + paddingX * 2,
          maxY: y1 + height + paddingY * 2,
        };
      }

      if (el.isDownspout) {
        const r = gridSize;
        const cross = {
          minX: el.startX - r,
          minY: el.startY - r,
          maxX: el.startX + r,
          maxY: el.startY + r,
        };
        const w = 60;
        const h = 28; // keep in sync with draw & hitTest
        const angle =
          typeof el.elbowBoxAngle === "number" ? el.elbowBoxAngle : Math.PI / 4;
        const radius =
          typeof el.elbowBoxRadius === "number"
            ? el.elbowBoxRadius
            : gridSize * 5;
        const cx = el.startX + radius * Math.cos(angle);
        const cy = el.startY + radius * Math.sin(angle);
        const box = {
          minX: cx - w / 2,
          minY: cy - h / 2,
          maxX: cx + w / 2,
          maxY: cy + h / 2,
        };
        return boundsUnion(cross, box);
      }

      if (el.isFreeMark) {
        if (el.kind === "free-line") {
          return {
            minX: Math.min(el.startX, el.endX),
            minY: Math.min(el.startY, el.endY),
            maxX: Math.max(el.startX, el.endX),
            maxY: Math.max(el.startY, el.endY),
          };
        }
        if (el.kind === "free-square") {
          const left = Math.min(el.startX, el.endX);
          const top = Math.min(el.startY, el.endY);
          const w = Math.abs(el.endX - el.startX);
          const h = Math.abs(el.endY - el.startY);
          return { minX: left, minY: top, maxX: left + w, maxY: top + h };
        }
        if (el.kind === "free-circle") {
          const r = Math.max(0, el.radius || 0);
          return {
            minX: el.centerX - r,
            minY: el.centerY - r,
            maxX: el.centerX + r,
            maxY: el.centerY + r,
          };
        }
      }

      const x = el.startX ?? el.centerX ?? 0;
      const y = el.startY ?? el.centerY ?? 0;
      return { minX: x, minY: y, maxX: x, maxY: y };
    }
    function getBoundingBoxForAll(all, ctx, padding = 20) {
      let box = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };
      all.forEach((el) => {
        const b = elementBounds(el, ctx);
        box = boundsUnion(box, b);
      });
      if (box.minX === Infinity)
        box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      return {
        minX: box.minX - padding,
        minY: box.minY - padding,
        maxX: box.maxX + padding,
        maxY: box.maxY + padding,
      };
    }

    const token = localStorage.getItem("jwt");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // ⬇️ draw + yield one frame before reading back pixels (mobile fix)
    await ensureCanvasPainted(ctx, drawAllLines);

    const dpr = window.devicePixelRatio || 1;

    // 1) Compute bounds in CSS units (helper returns CSS units)
    const boundingBox = getBoundingBoxForAll(lines, ctx, 40); // a little more padding

    // 2) Convert CSS -> backing store pixels
    const srcX = Math.max(0, Math.floor(boundingBox.minX * dpr));
    const srcY = Math.max(0, Math.floor(boundingBox.minY * dpr));
    const srcW = Math.min(
      Math.floor((boundingBox.maxX - boundingBox.minX) * dpr),
      canvas.width - srcX
    );
    const srcH = Math.min(
      Math.floor((boundingBox.maxY - boundingBox.minY) * dpr),
      canvas.height - srcY
    );

    // ... setup tempCanvas ...
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    const thumbnailDisplaySize = 180;
    const thumbnailInternalSize = 2 * thumbnailDisplaySize; // 360px square is plenty

    // fixed, crisp thumb regardless of device
    tempCanvas.width = thumbnailInternalSize;
    tempCanvas.height = thumbnailInternalSize;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    // leave some border inside thumb so labels/joins never touch edges
    const pad = 0.05 * thumbnailInternalSize;
    const availW = thumbnailInternalSize - pad * 2;
    const availH = thumbnailInternalSize - pad * 2;

    // destination size computed in CSS pixels first, then mapped 1:1 to thumb
    const cropWidthCss = boundingBox.maxX - boundingBox.minX;
    const cropHeightCss = boundingBox.maxY - boundingBox.minY;
    const scale = Math.min(availW / cropWidthCss, availH / cropHeightCss);
    const destW = cropWidthCss * scale;
    const destH = cropHeightCss * scale;

    const dx = (thumbnailInternalSize - destW) / 2;
    const dy = (thumbnailInternalSize - destH) / 2;

    // white background
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // draw from the hi-DPI source rect
    tempCtx.drawImage(canvas, srcX, srcY, srcW, srcH, dx, dy, destW, destH);

    const thumbnailDataUrl = await canvasToDataURLAsync(
      tempCanvas,
      "image/png",
      0.92
    );

    // --- PRICE + ACCESSORIES ---
    let price = 0;
    let totalFootage = 0;

    lines.forEach((line) => {
      if (line.isDownspout) {
        const p = Number(line.price || 0);
        price += p * Number(line.measurement || 0);
      } else if (line.isNote || line.isFreeMark) {
        // no price
      } else {
        const p = Number(line?.currentProduct?.price || 0);
        price += p * Number(line.measurement || 0);
      }
    });

    const analysis = analyzeJoints(lines);
    const endcapMiterData = {
      endCapsByProduct: analysis.endCapsByProduct,
      mitersByProduct: analysis.mitersByProduct,
      mixedMiters: analysis.mixedMiters,
    };

    const caseIncludes = (hay, needle) =>
      String(hay).toLowerCase().includes(String(needle).toLowerCase());

    // --- local helpers (robust to your seedTemplate.js) ---
    const ci = (s) => String(s || "").toLowerCase();
    const nameHasAny = (n, tokens = []) => {
      const S = ci(n);
      return tokens.some((t) => S.includes(ci(t)));
    };
    const nameTokensForProfile = (profileKey) => {
      const p = ci(profileKey || "");
      if (p.includes("k")) return ["k-style"];
      if (p.includes("straight")) return ["straight face", "straight-face"];
      if (p.includes("half")) return ["half round", "half-round"];
      if (p.includes("box")) return ["box"];
      if (p.includes("round")) return ["round"];
      return [p];
    };
    const inchesToken = (sizeInches) => {
      if (!sizeInches) return null;
      const s = String(sizeInches).replace(/\s+/g, "");
      if (/^\d+"$/.test(s)) return s;
      const m = s.match(/^(\d+)$/);
      return m ? `${m[1]}"` : s;
    };

    // kind: "end cap" | "strip miter" | "bay miter" | "custom miter"
    const findGutterAccessoryTemplate = (
      allProducts,
      { profileKey, sizeInches, kind }
    ) => {
      const sizeTok = inchesToken(sizeInches);
      const profTokens = nameTokensForProfile(profileKey);
      const K = ci(kind);
      const wantEnd = /end/.test(K);
      const wantStrip = /strip/.test(K);
      const wantBay = /bay/.test(K);
      const wantCustom = /custom/.test(K);

      const pass = (requireSize) =>
        (allProducts || []).find((p) => {
          const n = p?.name || "";
          if (!/accessory/i.test(p?.type || "accessory")) return false;
          if (!nameHasAny(n, profTokens)) return false;
          if (requireSize && sizeTok && !n.includes(sizeTok)) return false;
          if (wantEnd && !/end\s*cap|endcap/i.test(n)) return false;
          if (wantStrip && !/strip\s*miter/i.test(n)) return false;
          if (wantBay && !/bay\s*miter/i.test(n)) return false;
          if (wantCustom && !/custom\s*miter/i.test(n)) return false;
          return true;
        });

      return pass(true) || pass(false) || null;
    };

    function calculateEndCapsAndMiters(analysisData) {
      const endCaps = {};
      const miters = {};
      const customMiters = {};
      const accessoryLineItems = [];

      // wrapper so we never forget to include price
      const pushCatalogItem = (product, quantity, meta = {}, nameOverride) => {
        if (!product || !quantity) return;
        accessoryLineItems.push({
          name: nameOverride || product.name,
          quantity: Number(quantity || 0),
          price: Number(product.price || 0),
          product,
          meta,
        });
      };

      // ---------------- End Caps ----------------
      Object.keys(analysisData.endCapsByProduct || {}).forEach((profileKey) => {
        const endCapCount = Number(
          analysisData.endCapsByProduct[profileKey] || 0
        );
        if (!endCapCount) return;

        const sizeInches = null; // pass actual if you can infer

        const endCapTpl = findGutterAccessoryTemplate(allProducts, {
          profileKey,
          sizeInches,
          kind: "end cap",
        });
        if (endCapTpl) {
          (endCaps[profileKey] ||= []).push({
            type: "End Cap",
            price: endCapTpl.price,
            quantity: endCapCount,
            product: endCapTpl,
          });

          pushCatalogItem(endCapTpl, endCapCount, {
            kind: "endcap",
            profileKey,
            inches: sizeInches || undefined,
          });
        }
      });

      // ---------------- Miters ----------------
      Object.keys(analysisData.mitersByProduct || {}).forEach((profileKey) => {
        const m = analysisData.mitersByProduct[profileKey] || {};
        const stripQty = Number(m.inside90 || 0) + Number(m.outside90 || 0);
        const bayQty = Number(m.bay135 || 0);

        const sizeInches = null;

        if (stripQty > 0) {
          const strip = findGutterAccessoryTemplate(allProducts, {
            profileKey,
            sizeInches,
            kind: "strip miter",
          });
          if (strip) {
            (miters[profileKey] ||= []).push({
              type: "Strip Miter",
              price: strip.price,
              quantity: stripQty,
              product: strip,
            });
            pushCatalogItem(strip, stripQty, {
              kind: "miter",
              profileKey,
              miterType: "strip",
            });
          }
        }

        if (bayQty > 0) {
          const bay = findGutterAccessoryTemplate(allProducts, {
            profileKey,
            sizeInches,
            kind: "bay miter",
          });
          if (bay) {
            (miters[profileKey] ||= []).push({
              type: "Bay 135 Miter",
              price: bay.price,
              quantity: bayQty,
              product: bay,
            });
            pushCatalogItem(bay, bayQty, {
              kind: "miter",
              profileKey,
              miterType: "bay",
              degrees: 135,
            });
          }
        }

        (Array.isArray(m.custom) ? m.custom : []).forEach(
          ({ angle, count }) => {
            const qty = Number(count || 0);
            if (!qty) return;

            const custom =
              findGutterAccessoryTemplate(allProducts, {
                profileKey,
                sizeInches,
                kind: "custom miter",
              }) ||
              findGutterAccessoryTemplate(allProducts, {
                profileKey,
                sizeInches: null,
                kind: "custom miter",
              });

            if (custom) {
              (customMiters[profileKey] ||= []).push({
                type: `Custom Miter (${angle}°)`,
                price: custom.price,
                quantity: qty,
                product: custom,
                angle,
              });
              pushCatalogItem(
                custom,
                qty,
                {
                  kind: "miter",
                  profileKey,
                  miterType: "custom",
                  degrees: angle,
                },
                `Custom Miter (${angle}°)`
              );
            }
          }
        );
      });

      return { endCaps, miters, customMiters, accessoryLineItems };
    }

    // --- elbows + offsets (priced) ---
    function collectElbowsAndOffsets(lines, allProducts) {
      // helpers
      const caseIncludes = (hay, needle) =>
        String(hay).toLowerCase().includes(String(needle).toLowerCase());

      function getSizeKeyFromDownspoutLine(line) {
        const fromProp = String(line.downspoutSize || "").trim();
        const rxSize = /(\d+)\s*[xX]\s*(\d+)/;
        const rxQuoted = /(\d+)\s*"?\s*[xX]\s*(\d+)\s*"?/;
        let m = fromProp.match(rxSize) || fromProp.match(rxQuoted);
        if (!m && line.currentProduct?.name) {
          const n = String(line.currentProduct.name || "");
          m = n.match(rxSize) || n.match(rxQuoted);
        }
        if (!m) return "unknown";
        return `${m[1]}x${m[2]}`; // "2x3" / "3x4"
      }

      function inferProfileFromLine(line) {
        const p = String(line.profile || "").toLowerCase();
        if (p) return p;
        const n = String(line.currentProduct?.name || "").toLowerCase();
        if (n.includes("round")) return "round";
        if (n.includes("smooth")) return "smooth";
        if (n.includes("box")) return "box";
        return "corrugated";
      }

      function parseElbowsAndOffsets(seq) {
        const out = { elbows: {}, offsets: {} };
        if (!seq) return out;
        const s = String(seq).trim();

        (s.match(/[A-D]/gi) || []).forEach((ch) => {
          const up = ch.toUpperCase();
          out.elbows[up] = (out.elbows[up] || 0) + 1;
        });

        const consumed = [];
        const unitRe = /(\d+)\s*(?:"|in\b|inch\b|”)/gi;
        let m;
        while ((m = unitRe.exec(s))) {
          const inches = m[1];
          out.offsets[inches] = (out.offsets[inches] || 0) + 1;
          consumed.push([m.index, unitRe.lastIndex]);
        }
        const isConsumed = (idx) =>
          consumed.some(([a, b]) => idx >= a && idx < b);

        for (let i = 0; i < s.length; i++) {
          if (isConsumed(i)) continue;
          const ch = s[i];
          if (/\d/.test(ch)) {
            let j = i;
            let run = "";
            while (j < s.length && /\d/.test(s[j]) && !isConsumed(j)) {
              run += s[j++];
            }
            if (run.length === 1) {
              out.offsets[run] = (out.offsets[run] || 0) + 1;
            } else {
              for (const d of run) {
                out.offsets[d] = (out.offsets[d] || 0) + 1;
              }
            }
            i = j - 1;
          }
        }
        return out;
      }

      const elbowCounts = {};
      const offsetCounts = {};

      lines.forEach((line) => {
        if (!line?.isDownspout) return;

        const sizeKey = getSizeKeyFromDownspoutLine(line);
        const profileKey = inferProfileFromLine(line);
        const mapKey = `${sizeKey}|${profileKey}`;

        const { elbows, offsets } = parseElbowsAndOffsets(
          line.elbowSequence || ""
        );

        if (!elbowCounts[mapKey]) elbowCounts[mapKey] = {};
        Object.entries(elbows).forEach(([code, qty]) => {
          elbowCounts[mapKey][code] =
            (elbowCounts[mapKey][code] || 0) + Number(qty || 0);
        });

        if (!offsetCounts[mapKey]) offsetCounts[mapKey] = {};
        Object.entries(offsets).forEach(([inches, qty]) => {
          offsetCounts[mapKey][inches] =
            (offsetCounts[mapKey][inches] || 0) + Number(qty || 0);
        });
      });

      const items = [];

      // elbows
      Object.entries(elbowCounts).forEach(([key, byCode]) => {
        const [sizeKey, profileKey] = key.split("|");
        Object.entries(byCode).forEach(([code, qty]) => {
          if (!qty) return;

          const prod = findDownspoutFitting(allProducts, {
            profileKey, // corrugated/smooth/box/round
            dsSize: sizeKey, // "2x3" / "3x4" / '3"' ...
            code, // "A" | "B" (ignored for round)
            kind: "elbow",
          });
          if (!prod) return;

          items.push({
            name: `${sizeKey} ${
              /round/i.test(prod.name)
                ? "Round"
                : /smooth/i.test(prod.name)
                ? "Smooth"
                : /box/i.test(prod.name)
                ? "Box"
                : "Corrugated"
            }${/round|box/i.test(prod.name) ? "" : ` ${code}`} Elbow`,
            quantity: Number(qty || 0),
            price: Number(prod.price || 0),
            product: prod,
            meta: {
              kind: "elbow",
              size: sizeKey,
              code, // keep canonical 'code'
              letter: code, // (back-compat if anything still reads 'letter')
              profileKey,
            },
          });
        });
      });

      // offsets
      Object.entries(offsetCounts).forEach(([key, byInches]) => {
        const [sizeKey, profileKey] = key.split("|");
        Object.entries(byInches).forEach(([inches, qty]) => {
          if (!qty) return;

          const prod =
            findDownspoutFitting(allProducts, {
              profileKey,
              dsSize: sizeKey,
              kind: `${inches}" offset`,
            }) ||
            (allProducts || []).find(
              (p) =>
                caseIncludes(p.name, sizeKey) &&
                caseIncludes(p.name, "offset") &&
                (caseIncludes(p.name, `${inches}"`) ||
                  caseIncludes(p.name, ` ${inches} `))
            );

          if (!prod) return;

          items.push({
            name: `${sizeKey} ${
              /round/i.test(prod.name)
                ? "Round"
                : /smooth/i.test(prod.name)
                ? "Smooth"
                : /box/i.test(prod.name)
                ? "Box"
                : "Corrugated"
            } ${inches}" Offset`,
            quantity: Number(qty || 0),
            price: Number(prod.price || 0),
            product: prod,
            meta: {
              kind: "offset",
              size: sizeKey,
              inches: String(inches),
              profileKey,
            },
          });
        });
      });

      return items;
    }

    const { endCaps, miters, customMiters, accessoryLineItems } =
      calculateEndCapsAndMiters(endcapMiterData);

    const elbowOffsetItems = collectElbowsAndOffsets(lines, allProducts);

    // de-duplicate ALL accessories before pricing/rendering
    const allAccessoriesUnfolded = [...accessoryLineItems, ...elbowOffsetItems];
    const allAccessories = foldAccessoryItems(allAccessoriesUnfolded);

    // price from folded list ONLY
    allAccessories.forEach((it) => {
      price += Number(it.price || 0) * Number(it.quantity || 0);
    });

    // right above `const data = { ... }`
    const rect = canvasRef.current.getBoundingClientRect();
    const metaViewport = {
      canvasW: Math.round(rect.width),
      canvasH: Math.round(rect.height),
    };

    function normalizeAccessoriesForAPI(items) {
      return (items || []).map((it) => {
        const out = {
          ...it,
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),
        };
        const m = { ...(out.meta || {}) };

        // Canonicalize server-side keys
        if (m.kind === "endcap") m.kind = "endCap";
        if (m.kind === "miter") {
          if (!m.type && m.miterType) {
            const t = String(m.miterType);
            m.type = t.charAt(0).toUpperCase() + t.slice(1); // Strip/Bay/Custom
          }
          if (m.degrees != null) m.degrees = Number(m.degrees);
        }
        if (!m.size && m.sizeLabel) m.size = m.sizeLabel;
        if (!m.profileKey && m.profile) m.profileKey = m.profile;
        if (m.code) m.code = String(m.code).toUpperCase();
        if (m.inches != null) m.inches = String(m.inches);

        out.meta = m;

        // Defensive: embed discriminators in name so nothing merges even if some meta is lost downstream.
        if (
          m.kind === "miter" &&
          m.type === "Custom" &&
          m.degrees != null &&
          !/Custom Miter\s*\(\d+°\)/i.test(out.name)
        ) {
          out.name = `Custom Miter (${m.degrees}°)`;
        }
        if (
          m.kind === "elbow" &&
          m.code &&
          !/round/i.test(out.name) &&
          !new RegExp(`\\b${m.code}\\b`, "i").test(out.name)
        ) {
          out.name = out.name.replace(/\bElbow\b/i, `${m.code} Elbow`);
        }
        if (
          m.kind === "offset" &&
          m.inches &&
          !new RegExp(`\\b${m.inches}"\\b`).test(out.name)
        ) {
          out.name = out.name.replace(/\bOffset\b/i, `${m.inches}" Offset`);
        }

        return out;
      });
    }

    const data = {
      lines: [...lines],
      imageData: thumbnailDataUrl,
      totalFootage,
      price: parseFloat(price).toFixed(2),
      // legacy fields
      miterSummary: analysis.miters,
      endCaps: analysis.endCaps,
      endCapsByProduct: analysis.endCapsByProduct,
      mitersByProduct: analysis.mitersByProduct,
      mixedMiters: analysis.mixedMiters,
      accessoryData: [endCaps, miters, customMiters],
      // new
      accessories: {
        items: normalizeAccessoriesForAPI(allAccessories), // folded accessories list
      },
      // persist the canvas size this drawing was made on
      meta: {
        ...(selectedDiagram?.meta || {}),
        ...metaViewport,
      },
    };

    function handleAddDiagramToProject() {
      addDiagramToProject(resolvedProjectId, token, data)
        .then((newDiagramData) => {
          handlePassDiagramData(newDiagramData);
          closeModal();
        })
        .then(() => {
          // FULL reset so the next open starts blank
          setSelectedDiagram({});
          setLines([]);
          setSelectedIndex(null);
          setIsDrawing(false);
          if (baselineHashRef && "current" in baselineHashRef) {
            baselineHashRef.current = hashLines([]);
          }
          clearCanvas();
        })
        .catch((err) => {
          console.error("Failed to save diagram:", err);
          closeModal();
        });
    }

    function handleUpdateDiagram() {
      if (!selectedDiagram?._id) {
        handleAddDiagramToProject();
        return;
      }
      updateDiagram(resolvedProjectId, selectedDiagram._id, token, data)
        .then((newDiagramData) => {
          handlePassDiagramData(newDiagramData);
          closeModal();
        })
        .then(() => {
          // FULL reset so the next open starts blank
          setSelectedDiagram({});
          setLines([]);
          setSelectedIndex(null);
          setIsDrawing(false);
          if (baselineHashRef && "current" in baselineHashRef) {
            baselineHashRef.current = hashLines([]);
          }
          clearCanvas();
        })
        .catch((err) => {
          console.error("Failed to save diagram:", err);
        });
    }

    if (saveType === "overwrite") {
      handleUpdateDiagram();
    } else {
      handleAddDiagramToProject();
    }

    // after successful save/add/overwrite:
    baselineHashRef.current = hashLines(lines);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setLines([]);
    setLineLength(0);
  }

  // ======= UI =======
  if (isLoading) return <div className="diagram">Loading products…</div>;
  if (error) return <div className="diagram">Failed to load products.</div>;

  // product dropdown (native select; colored dot prefix for visibility)
  return (
    <>
      <div
        className={
          [
            "diagram",
            "downspout",
            "selectedLine",
            "confirmDiagramOverwrite",
            "note",
          ].includes(activeModal)
            ? "diagram diagram_visible"
            : "diagram"
        }
      >
        <img
          onClick={() => {
            closeModal();
            setSelectedDiagram({});
            setLines([]);
            setSelectedIndex(null);
            setIsDrawing(false);
            if (baselineHashRef && "current" in baselineHashRef) {
              baselineHashRef.current = hashLines([]);
            }
          }}
          src={closeIcon}
          alt="close diagram"
          className="diagram__close diagram__icon"
        />

        <img
          src={saveIcon}
          alt="save diagram"
          className="diagram__icon diagram__save"
          onClick={() => {
            // Defensive: ensure baseline exists
            if (baselineHashRef.current == null) {
              baselineHashRef.current = hashLines(lines);
            }

            const currentHash = hashLines(lines);
            const hasChanged = currentHash !== baselineHashRef.current;

            if (!hasChanged) {
              // Match saveDiagram() behavior: close when nothing changed
              // testing the other branch
              closeModal();
              setSelectedDiagram({});
              setLines([]);
              setSelectedIndex(null);
              setIsDrawing(false);
              if (baselineHashRef && "current" in baselineHashRef) {
                baselineHashRef.current = hashLines([]);
              }
              return;
            }

            const isOverwrite = Boolean(selectedDiagram?._id);
            if (isOverwrite) {
              setActiveModal("confirmDiagramOverwrite");
            } else {
              saveDiagram("add");
            }
          }}
        />

        <img
          src={trashIcon}
          alt="clear or delete"
          className="diagram__icon diagram__trash"
          onClick={() => {
            if (tool === "select" && selectedIndex !== null) deleteSelected();
            else clearCanvas();
          }}
        />

        <img
          src={itemsIcon}
          alt="select product"
          className="diagram__icon diagram__items"
          onClick={() => {}}
        />

        <select
          value={tool}
          onChange={handleToolSelectChange}
          className="diagram__select-product"
          name="select product dropdown"
          id="select-product-dropdown"
        >
          {filteredProducts?.map((p) => {
            const bg = p.colorCode || p.visual || p.color || "#ffffff";
            const label = `● ${p.name}`;
            return (
              <option key={p._id} value={p.name} style={{ color: bg }}>
                {label}
              </option>
            );
          })}
          <option value="downspout">Downspout</option>
          <option value="select">Select</option>
          <option value="note">Notation</option>
          {/* <option value="splashGuard">Splash Guard / Valley Shield</option> */}
          <option value="freeLine">Free Line</option>
        </select>

        <div className="diagram__line-length-display">
          Current line length: {lineLength}'
        </div>

        {(tool === "freeLine" ||
          (selectedIndex !== null && lines[selectedIndex]?.isFreeMark)) && (
          <div
            style={{
              position: "absolute",
              top: 64,
              left: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(18,18,20,0.95)", // dark background
              color: "#eaeaea",
              boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
              zIndex: 10000,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Shape (with filled/hollow choices baked in) */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              <span>Shape</span>
              <select
                value={(() => {
                  const src =
                    selectedIndex !== null && lines[selectedIndex]?.isFreeMark
                      ? lines[selectedIndex]
                      : currentLine;
                  const kind = src.kind || "free-line";
                  const filled = !!src.fill;
                  if (kind === "free-square")
                    return filled ? "free-square:filled" : "free-square:hollow";
                  if (kind === "free-circle")
                    return filled ? "free-circle:filled" : "free-circle:hollow";
                  return "free-line";
                })()}
                onChange={(e) => {
                  const raw = e.target.value; // e.g., "free-circle:filled" | "free-square:hollow" | "free-line"
                  let nextKind = "free-line";
                  let nextFill;

                  if (raw.startsWith("free-circle")) {
                    nextKind = "free-circle";
                    nextFill = raw.endsWith(":filled");
                  } else if (raw.startsWith("free-square")) {
                    nextKind = "free-square";
                    nextFill = raw.endsWith(":filled");
                  } else {
                    nextKind = "free-line";
                  }

                  if (
                    selectedIndex !== null &&
                    lines[selectedIndex]?.isFreeMark
                  ) {
                    setLines((prev) => {
                      const copy = [...prev];
                      const el = { ...copy[selectedIndex] };
                      el.kind = nextKind;
                      if (nextKind !== "free-line") el.fill = !!nextFill;
                      else delete el.fill;
                      if (nextKind === "free-circle" && el.radius == null) {
                        el.radius = 12;
                        el.centerX = el.centerX ?? el.startX ?? 0;
                        el.centerY = el.centerY ?? el.startY ?? 0;
                      }
                      copy[selectedIndex] = el;
                      return copy;
                    });
                  } else {
                    setCurrentLine((prev) => {
                      const el = { ...prev, kind: nextKind };
                      if (nextKind !== "free-line") el.fill = !!nextFill;
                      else delete el.fill;
                      if (nextKind === "free-circle" && el.radius == null) {
                        el.radius = 12;
                        el.centerX = el.centerX ?? el.startX ?? 0;
                        el.centerY = el.centerY ?? el.startY ?? 0;
                      }
                      return el;
                    });
                  }
                }}
                style={{
                  padding: "2px 6px",
                  background: "#1f1f22",
                  color: "#eaeaea",
                  border: "1px solid #333",
                  borderRadius: 6,
                }}
              >
                <option value="free-line">Line</option>
                <option value="free-square:hollow">Square (Hollow)</option>
                <option value="free-square:filled">Square (Filled)</option>
                <option value="free-circle:hollow">Circle (Hollow)</option>
                <option value="free-circle:filled">Circle (Filled)</option>
              </select>
            </label>
            {/* Style (solid / dotted) */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              <span>Style</span>
              <select
                value={
                  selectedIndex !== null && lines[selectedIndex]?.isFreeMark
                    ? lines[selectedIndex].dashed
                      ? "dotted"
                      : "solid"
                    : currentLine.dashed
                    ? "dotted"
                    : "solid"
                }
                onChange={(e) => {
                  const val = e.target.value === "dotted";
                  if (
                    selectedIndex !== null &&
                    lines[selectedIndex]?.isFreeMark
                  ) {
                    setLines((prev) => {
                      const copy = [...prev];
                      copy[selectedIndex] = {
                        ...copy[selectedIndex],
                        dashed: val,
                      };
                      return copy;
                    });
                  } else {
                    setCurrentLine((prev) => ({ ...prev, dashed: val }));
                  }
                }}
                style={{
                  padding: "2px 6px",
                  background: "#1f1f22",
                  color: "#eaeaea",
                  border: "1px solid #333",
                  borderRadius: 6,
                }}
              >
                <option value="solid">Solid</option>
                <option value="dotted">Dotted</option>
              </select>
            </label>

            {/* Color swatches */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>Color</span>
              <div style={{ display: "flex", gap: 6 }}>
                {COMMON_COLORS.map((c) => {
                  const selectedColor =
                    selectedIndex !== null && lines[selectedIndex]?.isFreeMark
                      ? lines[selectedIndex].color || "#111111"
                      : currentLine.color || "#111111";
                  const isSelected =
                    selectedColor.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        if (
                          selectedIndex !== null &&
                          lines[selectedIndex]?.isFreeMark
                        ) {
                          setLines((prev) => {
                            const copy = [...prev];
                            copy[selectedIndex] = {
                              ...copy[selectedIndex],
                              color: c,
                            };
                            return copy;
                          });
                        } else {
                          setCurrentLine((prev) => ({ ...prev, color: c }));
                        }
                      }}
                      title={c}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: isSelected
                          ? "2px solid #eaeaea"
                          : "1px solid #555",
                        background: c,
                        outline: "none",
                        cursor: "pointer",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {(lines?.length ?? 0) === 0 && (
          <div className="diagram__grid-settings">
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Grid square size (px):</span>
              <input
                type="number"
                min={4}
                step={1}
                value={gridSize}
                onChange={(e) => {
                  const v = Math.max(2, Number(e.target.value) || 10);
                  setGridSize(v);
                }}
                style={{ width: 90, padding: "4px 6px", color: "white" }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Feet per square:</span>
              <input
                type="number"
                min={0.01}
                step={0.25}
                value={feetPerSquare}
                onChange={(e) => {
                  const v = Math.max(0.01, Number(e.target.value) || 1);
                  setFeetPerSquare(v);
                }}
                style={{ width: 90, padding: "4px 6px", color: "white" }}
              />
            </label>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="diagram__canvas"
          width={window.innerWidth}
          height={window.innerHeight}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handleMouseDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
        />
      </div>

      <DownspoutModal
        setActiveModal={setActiveModal}
        activeModal={activeModal}
        setTool={setTool}
        setIsDownspoutModalOpen={setIsDownspoutModalOpen}
        addDownspout={handleAddDownspout}
        mode={editingDownspoutIndex !== null ? "edit" : "create"}
        initialData={
          editingDownspoutIndex !== null ? lines[editingDownspoutIndex] : null
        }
      />
      <OverwriteDiagramModal
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        saveDiagram={saveDiagram}
        closeModal={closeModal}
      />
      <AnnotationModal
        activeModal={activeModal}
        setActiveModal={(v) => {
          // if closing the modal, clear edit state
          if (v !== "note") setEditingNoteIndex(null);
          setActiveModal(v);
        }}
        mode={editingNoteIndex !== null ? "edit" : "create"}
        initialText={
          editingNoteIndex !== null ? lines[editingNoteIndex]?.note || "" : ""
        }
        onSubmit={(text) => {
          if (editingNoteIndex !== null) {
            // update existing note text
            setLines((prev) => {
              const next = [...prev];
              if (next[editingNoteIndex]) {
                next[editingNoteIndex] = {
                  ...next[editingNoteIndex],
                  note: text,
                };
              }
              return next;
            });
            setEditingNoteIndex(null);
            setActiveModal("diagram");
          } else {
            // existing create flow
            addNote(text);
            setActiveModal("diagram");
          }
        }}
      />
    </>
  );
};

// ===== SVG Export (additive, non-breaking) =====
export function exportDiagramAsSVG(lines = [], meta = {}) {
  try {
    const W = Number(meta.canvasW || 0) || 0;
    const H = Number(meta.canvasH || 0) || 0;
    const grid = Number(meta.gridSize || 8) || 8;
    const parts = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="geometricPrecision" vector-effect="non-scaling-stroke">`
    );

    (lines || []).forEach((l) => {
      const x1 = Number(l.startX || 0);
      const y1 = Number(l.startY || 0);
      const x2 = Number(l.endX ?? l.startX ?? 0);
      const y2 = Number(l.endY ?? l.startY ?? 0);
      const color = l.color || "#000";
      const sw = Number(l.lineWidth || (l.isDownspout ? 2 : 3));

      if (l.isNote) {
        // (Optional) omit text in SVG for now; notes are rendered elsewhere.
        return;
      }

      if (l.isDownspout) {
        // four lines forming an X centered at (x1, y1)
        const d = grid / 2.75;
        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x1 + d}" y2="${
            y1 + d
          }" stroke="${color}" stroke-width="2" />`
        );
        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x1 - d}" y2="${
            y1 + d
          }" stroke="${color}" stroke-width="2" />`
        );
        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x1 - d}" y2="${
            y1 - d
          }" stroke="${color}" stroke-width="2" />`
        );
        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x1 + d}" y2="${
            y1 - d
          }" stroke="${color}" stroke-width="2" />`
        );
      } else {
        // straight run
        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" />`
        );
      }
    });

    parts.push(`</svg>`);
    return parts.join("");
  } catch (e) {
    return "";
  }
}

export default Diagram;
