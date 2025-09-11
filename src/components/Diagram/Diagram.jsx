import "./Diagram.css";
import closeIcon from "../../assets/icons/close.svg";
import saveIcon from "../../assets/icons/check.svg";
import trashIcon from "../../assets/icons/trash.svg";
import { useEffect, useRef, useState } from "react";
import itemsIcon from "../../assets/icons/items.svg";
import {
  isLineParallelToTop,
  isLineParallelToSide,
  calculateDistance,
  isLineNearPoint,
} from "../../utils/constants";
import { useParams } from "react-router-dom";
import DownspoutModal from "../DownspoutModal/DownspoutModal";
import { capitalizeFirstLetter } from "../../utils/constants";
import { OverwriteDiagramModal } from "../OverwriteDiagramModal/OverwriteDiagramModal";
import { AnnotationModal } from "../AnnotationModal/AnnotationModal";
import { formControlClasses } from "@mui/material";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import { useProducts, useGutterProducts } from "../../hooks/useProducts";
// Stable id generator for lines (works in all browsers)
const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
  const { data: allProducts = [] } = useProducts();
  const { data: gutterProducts = [], isLoading, error } = useGutterProducts();
  const filteredProducts = gutterProducts.filter((p) => p.type === "gutter");
  const unfilteredProducts = allProducts;
  const canvasRef = useRef(null);
  // NEW: unified selection + dragging state
  const [selectedIndex, setSelectedIndex] = useState(null); // which element in `lines` is selected
  const [dragging, setDragging] = useState({
    mode: "none", // "none" | "move" | "drag-end"
    end: null, // "start" | "end" when dragging an endpoint
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    console.log(filteredProducts);
  }, []);

  const [isDrawing, setIsDrawing] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [currentLine, setCurrentLine] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isHorizontal: false,
    isVertical: false,
    isSelected: false,
    color: "black",
  });
  const [lines, setLines] = useState([]); // Array to store all drawn lines
  const [draggingEndpoint, setDraggingEndpoint] = useState(null); // "start" | "end" | null
  const [downspoutCoordinates, setDownspoutCoordinates] = useState([0, 0]);
  const [noteCoordinates, setNoteCoordinates] = useState([0, 0]);
  const [lineLength, setLineLength] = useState(0);
  const canvasBaseMeasurements = {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const [productsVisible, setProductsVisible] = useState(true);
  const [tool, setTool] = useState("");
  const [unitPerTools, setUnitPerTools] = useState([]);
  // const [selectedLine, setSelectedLine] = useState({});
  const [selectedLineId, setSelectedLineId] = useState(null);

  const [isDownspoutModalOpen, setIsDownspoutModalOpen] = useState(false);

  // const selectedLine = lines.find((l) => l.id === selectedLineId); If you still want a selectedLine handy for quick checks:
  useEffect(() => {
    function onKeyDown(e) {
      // Delete or Backspace (avoid deleting while typing inside inputs)
      const tag = (e.target && e.target.tagName) || "";
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable;

      if (!isTyping && (e.key === "Delete" || e.key === "Backspace")) {
        if (tool === "select" && selectedIndex !== null) {
          e.preventDefault();
          deleteSelected();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool, selectedIndex]); // depends on current tool + selection

  useEffect(() => {
    if (!tool && filteredProducts.length > 0) {
      setTool(filteredProducts[0].name);
    }
  }, [filteredProducts, tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    // setTimeout(() => {
    //   selectedDiagram?.lines?.forEach((line) => {
    //     drawLine(ctx, line);
    //   });
    // }, 0);
    /* selectedDiagram?.lines?.forEach((line) => {
      drawLine(ctx, line);
    });

    setLines(selectedDiagram.lines || []);
 */
    const withIds = (selectedDiagram?.lines || []).map((l) => ({
      id: l.id || newId(),
      ...l,
    }));
    withIds.forEach((line) => drawLine(ctx, line));
    setLines(withIds);
  }, [selectedDiagram]);

  useEffect(() => {
    if (activeModal !== "selectedLine") {
      setLines((prevLines) =>
        prevLines.map((line) => ({ ...line, isSelected: false }))
      );
      setSelectedLineId(null);
    }
  }, [activeModal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Set backing store size
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);

    // Set CSS size so the element appears at CSS pixels
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    // Reset transform before (re)scaling to avoid compounding
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    drawGrid(ctx); // Redraw the grid after scaling
  }, [window.innerWidth, window.innerHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawAllLines(ctx); // Redraw all lines whenever currentLine or lines change
  }, [currentLine, lines, isDrawing]);

  useEffect(() => {
    // Deselect all lines when the tool changes
    setLines((prevLines) =>
      prevLines.map((line) => ({ ...line, isSelected: false }))
    );
    setSelectedLineId(null);
  }, [tool]);

  // Treat "unknown" as true to avoid accidentally skipping confirmation.
  // If diagrams is not an array yet (loading), we'll assume there ARE existing diagrams.
  const diagramsKnown = Array.isArray(diagrams);
  const hasExistingDiagrams = diagramsKnown ? diagrams.length > 0 : true;

  // helper functions
  // --- Elbow helpers ---

  // Pulls a normalized size key (e.g. "2x3", "3x4") from a downspout line.
  // Prefers explicit `line.downspoutSize`, falls back to `line.currentProduct.name`.
  function getDownspoutSizeKey(line) {
    // Common cases: "2x3", '2" x 3"', '2 x 3', etc.
    const fromProp = (line.downspoutSize || "").toString().trim();
    const rxSize = /(\d+)\s*[xX]\s*(\d+)/; // 2x3, 3x4
    const rxQuoted = /(\d+)\s*"?\s*[xX]\s*(\d+)\s*"?/; // 2" x 3", etc.

    let m = fromProp.match(rxSize) || fromProp.match(rxQuoted);
    if (!m && line.currentProduct?.name) {
      const n = line.currentProduct.name;
      m = n.match(rxSize) || n.match(rxQuoted);
    }
    if (!m) return "unknown";
    return `${m[1]}x${m[2]}`;
  }

  // Optional: translate elbow letters to friendly names per size.
  // If you want A/B/C to become “2x3 A Elbow” etc., keep this; otherwise you can skip.
  const ELBOW_LABELS = {
    // These are examples; change to match your own naming/SKU language.
    "2x3": {
      A: "2x3 A Elbow",
      B: "2x3 B Elbow",
      C: "2x3 C Elbow",
      D: "2x3 D Elbow",
    },
    "3x4": {
      A: "3x4 A Elbow",
      B: "3x4 B Elbow",
      C: "3x4 C Elbow",
      D: "3x4 D Elbow",
    },
    // Add more sizes if you use them…
  };

  // Given a single elbowSequence string, return a counts object like { A: 2, B: 1 }
  function countElbowsInSequence(seq) {
    const counts = {};
    if (!seq) return counts;

    for (const ch of String(seq)) {
      if (!/[a-z]/i.test(ch)) continue; // ignore digits or misc chars
      const code = ch.toUpperCase(); // 'a' -> 'A'
      counts[code] = (counts[code] || 0) + 1;
    }
    return counts;
  }

  // Merge counts: {A:2} + {A:1,B:3} => {A:3,B:3}
  function mergeCounts(into, add) {
    for (const [k, v] of Object.entries(add || {})) {
      into[k] = (into[k] || 0) + v;
    }
    return into;
  }

  // ----- Product key helpers -----
  // Pull a stable "product key" for gutter lines.
  // Default: use the product's name. Customize if you want to extract just the size/profile.
  function getGutterKey(line) {
    // Only lines that are actual gutters (not notes/downspouts)
    if (line.isNote || line.isDownspout) return null;
    // If your product object has a "type==='gutter'", you can guard it here:
    // if (line.currentProduct?.type !== 'gutter') return null;

    // Basic: use name as key
    const name =
      line.currentProduct?.name ||
      line.currentProduct?.productName ||
      line.productName;
    if (!name) return null;
    return normalizeGutterKey(name);
  }

  const PROFILE_ALIASES = [
    [/k[-\s]?style/i, "K-Style"],
    [/half[-\s]?round/i, "Half Round"],
    [/straight[-\s]?face|straightface/i, "Straight Face"],
    [/fascia/i, "Fascia"],
    [/custom/i, "Custom"],
    [/box/i, "Box"],
    [/og\b|o\.?g\.?/i, "OG"],
    [/euro/i, "Euro"],
    [/square/i, "Square"],
    [/round(?!.*half)/i, "Round"], // "Round" but not "Half-Round"
  ];

  function normalizeGutterKey(name) {
    const trimmed = (name || "").trim();
    const sizeMatch = trimmed.match(/(\d+)\s*"/);
    if (!sizeMatch) return trimmed;

    const size = sizeMatch[1];
    // try to detect a known profile anywhere in the string
    for (const [rx, label] of PROFILE_ALIASES) {
      if (rx.test(trimmed)) return `${size}" ${label}`;
    }

    // Fallback: grab 1–2 words after the size before a dash/comma/paren/material/color tokens
    const after = trimmed.slice(sizeMatch.index + sizeMatch[0].length);
    const stopPunct = /[-–—]|,|\(|\)|\/|\\|\|/;
    const stopIdx = after.search(stopPunct);
    let chunk = stopIdx >= 0 ? after.slice(0, stopIdx) : after;

    // strip common non-profile words
    const junk =
      /\b(alum(?:inum)?|copper|steel|gutter|seamless|paint(?:ed)?|color|finish|white|black|bronze|brown|matte|textured|coil|stock|sku|ft|pcs?)\b/gi;
    chunk = chunk.replace(junk, " ").replace(/\s+/g, " ").trim();

    const words = chunk.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
    return words ? `${size}" ${titleCase(words)}` : `${size}"`;
  }

  function titleCase(s) {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function centroidOfLines(allLines) {
    if (!allLines.length) return { x: 0, y: 0 };
    let sx = 0,
      sy = 0,
      n = 0;
    allLines.forEach((L) => {
      const mx = (L.startX + L.endX) / 2;
      const my = (L.startY + L.endY) / 2;
      sx += mx;
      sy += my;
      n += 1;
    });
    return { x: sx / n, y: sy / n };
  }

  // Return the "inward" corner bisector for rays A and B at a joint (both are vectors from the joint).
  // We choose the smaller-angle bisector by adding the normalized vectors.
  function cornerBisector(vA, vB) {
    const A = norm(vA);
    const B = norm(vB);
    const bx = A.x + B.x;
    const by = A.y + B.y;
    const L = Math.hypot(bx, by);
    if (L < 1e-6) {
      // Rays are opposite (180°) — no corner; return a zero vector
      return { x: 0, y: 0 };
    }
    return { x: bx / L, y: by / L };
  }

  // --- Geometry helpers ---
  function vec(x1, y1, x2, y2) {
    return { x: x2 - x1, y: y2 - y1 };
  }
  function len(v) {
    return Math.hypot(v.x, v.y);
  }
  function norm(v) {
    const L = len(v) || 1;
    return { x: v.x / L, y: v.y / L };
  }
  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }
  function crossZ(a, b) {
    // 2D cross product (z-component)
    return a.x * b.y - a.y * b.x;
  }
  function angleBetweenDeg(a, b) {
    const A = norm(a);
    const B = norm(b);
    const clamped = Math.min(1, Math.max(-1, dot(A, B)));
    return (Math.acos(clamped) * 180) / Math.PI; // 0..180
  }

  // Round to an integer grid/tolerance so nearly-equal endpoints cluster
  const JOINT_SNAP = 1; // you can set this to gridSize (e.g. 10) if you prefer strict snapping
  function keyForPoint(x, y, tol = JOINT_SNAP) {
    // quantize to tolerance so points that are "the same" end up with same key
    return `${Math.round(x / tol) * tol}|${Math.round(y / tol) * tol}`;
  }

  // Buckets for angles
  const isStraight = (ang) => ang > 175; // treat ~180° as no miter
  const isRight = (ang) => ang >= 80 && ang <= 100;
  const isBay = (ang) => ang >= 130 && ang <= 150; // typical bay ~135°

  function analyzeJoints(allLines) {
    // Only consider gutter lines for joints/endcaps/miters
    const gutterLines = allLines
      .map((L, idx) => ({ L, idx, key: getGutterKey(L) }))
      .filter(({ key, L }) => key && !L.isNote && !L.isDownspout);

    const center = centroidOfLines(gutterLines.map((g) => g.L));

    // Build joints map: quantized point -> { x,y, members:[{lineIndex, end, key}] }
    const joints = new Map();
    gutterLines.forEach(({ L, idx, key }) => {
      const sKey = keyForPoint(L.startX, L.startY);
      const eKey = keyForPoint(L.endX, L.endY);

      if (!joints.has(sKey))
        joints.set(sKey, { x: L.startX, y: L.startY, members: [] });
      if (!joints.has(eKey))
        joints.set(eKey, { x: L.endX, y: L.endY, members: [] });

      joints.get(sKey).members.push({ lineIndex: idx, end: "start", key });
      joints.get(eKey).members.push({ lineIndex: idx, end: "end", key });
    });

    // Result buckets
    const endCapsByProduct = Object.create(null);
    const mitersByProduct = Object.create(null); // per product (same on both rays)
    const mixedMiters = Object.create(null); // productA + productB

    // helpers to bump counters
    const bumpEnd = (k) => {
      endCapsByProduct[k] = (endCapsByProduct[k] || 0) + 1;
    };

    const ensureMiterBucket = (k) => {
      if (!mitersByProduct[k]) {
        mitersByProduct[k] = {
          inside90: 0,
          outside90: 0,
          bay135: 0,
          custom: new Map(),
        };
      }
      return mitersByProduct[k];
    };

    const ensureMixedBucket = (keyPair) => {
      if (!mixedMiters[keyPair]) {
        mixedMiters[keyPair] = {
          inside90: 0,
          outside90: 0,
          bay135: 0,
          custom: new Map(),
        };
      }
      return mixedMiters[keyPair];
    };

    const pushCustom = (bucket, ang) => {
      const r = Math.round(ang);
      bucket.custom.set(r, (bucket.custom.get(r) || 0) + 1);
    };

    // Bucketing predicates
    const isStraight = (ang) => ang > 175;
    const isRight = (ang) => ang >= 80 && ang <= 100;
    const isBay = (ang) => ang >= 130 && ang <= 150;

    // For each joint, analyze corners
    joints.forEach((joint) => {
      const { x: JX, y: JY, members } = joint;

      // degree = number of rays (gutter endpoints) at this point
      const degree = members.length;

      // End cap: exactly one gutter line terminates here
      if (degree === 1) {
        bumpEnd(members[0].key);
        return;
      }

      if (degree >= 2) {
        // Build outgoing rays with product keys
        const rays = members
          .map(({ lineIndex, end, key }) => {
            const L = allLines[lineIndex];
            const otherX = end === "start" ? L.endX : L.startX;
            const otherY = end === "start" ? L.endY : L.startY;
            const v = vec(JX, JY, otherX, otherY);
            return { key, v, angle: Math.atan2(v.y, v.x) };
          })
          .filter((r) => len(r.v) > 0.0001);

        if (rays.length < 2) return;

        // Sort by polar angle for stable adjacency pairs
        const sorted = rays.slice().sort((a, b) => a.angle - b.angle);

        // Form pairs: for degree==2 -> one pair; else adjacent + wrap
        const pairs = [];
        if (sorted.length === 2) {
          pairs.push([sorted[0], sorted[1]]);
        } else {
          for (let i = 0; i < sorted.length; i++) {
            const a = sorted[i];
            const b = sorted[(i + 1) % sorted.length];
            pairs.push([a, b]);
          }
        }

        // Bias for “inside vs outside” using centroid (optional but helps)
        const toC = { x: center.x - JX, y: center.y - JY };

        pairs.forEach(([A, B]) => {
          const ang = angleBetweenDeg(A.v, B.v);
          if (isStraight(ang)) return;

          // Inward bisector
          const bis = cornerBisector(A.v, B.v);
          const facesCenter = bis.x * toC.x + bis.y * toC.y > 0;

          // Classify angle label
          let label;
          if (isRight(ang)) {
            label = facesCenter ? "inside90" : "outside90";
          } else if (isBay(ang)) {
            label = "bay135";
          } else {
            label = "custom";
          }

          // Decide which bucket (same product vs mixed)
          if (A.key === B.key) {
            const bucket = ensureMiterBucket(A.key);
            if (label === "inside90") bucket.inside90 += 1;
            else if (label === "outside90") bucket.outside90 += 1;
            else if (label === "bay135") bucket.bay135 += 1;
            else pushCustom(bucket, ang);
          } else {
            // mixed edge: keep a stable combined key (alphabetical)
            const combo = [A.key, B.key].sort().join(" + ");
            const bucket = ensureMixedBucket(combo);
            if (label === "inside90") bucket.inside90 += 1;
            else if (label === "outside90") bucket.outside90 += 1;
            else if (label === "bay135") bucket.bay135 += 1;
            else pushCustom(bucket, ang);
          }
        });
      }
    });

    // Convert custom maps to arrays for JSON
    function finalize(bucketObj) {
      const out = {};
      for (const [k, v] of Object.entries(bucketObj)) {
        out[k] = {
          inside90: v.inside90,
          outside90: v.outside90,
          bay135: v.bay135,
          custom: [...v.custom.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([angle, count]) => ({ angle, count })),
        };
      }
      return out;
    }

    return {
      endCapsByProduct, // { "5\" K-Style": n, "6\" Half-Round": m, ... }
      mitersByProduct: finalize(mitersByProduct),
      mixedMiters: finalize(mixedMiters), // e.g. { '5" K-Style + 6" K-Style': {...} }
    };
  }

  function deleteSelected() {
    if (selectedIndex === null) return;
    setLines((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    setDragging({ mode: "none", end: null, lastX: 0, lastY: 0 });
  }

  function recalcGeometry(line) {
    // Update midpoint
    line.midpoint = [
      (line.startX + line.endX) / 2,
      (line.startY + line.endY) / 2,
    ];
    // Update measurement
    line.measurement = convertToFeet(
      calculateDistance([line.startX, line.startY], [line.endX, line.endY])
    );

    // Update orientation flags + label position
    if (isLineParallelToSide(line.startX, line.startY, line.endX, line.endY)) {
      line.isVertical = true;
      line.isHorizontal = false;
      line.position =
        line.midpoint[0] >= canvasBaseMeasurements.width / 2 ? "right" : "left";
    } else if (
      isLineParallelToTop(line.startX, line.startY, line.endX, line.endY)
    ) {
      line.isHorizontal = true;
      line.isVertical = false;
      line.position =
        line.midpoint[1] <= canvasBaseMeasurements.height / 2
          ? "top"
          : "bottom";
    } else {
      line.isHorizontal = false;
      line.isVertical = false;
      // position for diagonal is just above by default in placeMeasurement
    }
  }
  function getCanvasCoords(e) {
    // Works for mouse/touch/pen via Pointer Events
    const ne = e.nativeEvent;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = ne.clientX;
    const clientY = ne.clientY;
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
        line.midpoint[0] >= canvasBaseMeasurements.width / 2 ? "right" : "left";
    } else if (
      isLineParallelToTop(line.startX, line.startY, line.endX, line.endY)
    ) {
      line.isHorizontal = true;
      line.isVertical = false;
      line.position =
        line.midpoint[1] <= canvasBaseMeasurements.height / 2
          ? "top"
          : "bottom";
    } else {
      line.isVertical = false;
      line.isHorizontal = false;
    }
    return line;
  }

  // --- Hit tests ---

  // (1) Lines: prefer endpoints, then body
  function hitTestLine(line, x, y) {
    const EP = 10; // endpoint radius
    if (calculateDistance([x, y], [line.startX, line.startY]) <= EP)
      return { hit: "start" };
    if (calculateDistance([x, y], [line.endX, line.endY]) <= EP)
      return { hit: "end" };

    // Near the segment? Reuse your helper:
    if (
      isLineNearPoint(line.startX, line.startY, line.endX, line.endY, x, y, 6)
    )
      return { hit: "body" };

    return null;
  }

  // (2) Downspout: near the center mark or inside the elbow box
  function hitTestDownspout(ds, x, y) {
    // Near the "X" center
    const r = gridSize; // lenient
    if (calculateDistance([x, y], [ds.startX, ds.startY]) <= r) return true;

    // Inside the elbow sequence box (same numbers you draw with)
    const boxX = ds.startX + 5;
    const boxY = ds.startY + 5;
    const boxW = 60;
    const boxH = 20;
    if (x >= boxX && x <= boxX + boxW && y >= boxY && y <= boxY + boxH) {
      return true;
    }
    return false;
  }

  // (3) Annotation: inside its text box
  function hitTestAnnotation(note, x, y) {
    const ctx = canvasRef.current.getContext("2d");
    ctx.font = "1000 12px Arial";
    // You draw annotation text centered at startX,startY
    const text = note.note || "";
    const textWidth = ctx.measureText(text).width;
    const paddingX = 6;
    const paddingY = 4;
    // Approx height of 12px font:
    const textHeight = 12;

    const x1 = note.startX - textWidth / 2 - paddingX;
    const y1 = note.startY - textHeight - paddingY; // above baseline
    const w = textWidth + paddingX * 2;
    const h = textHeight + paddingY * 2;

    return x >= x1 && x <= x1 + w && y >= y1 && y <= y1 + h;
  }

  // Utility: mark one selected, others not
  function selectIndex(i) {
    setLines((prev) => prev.map((l, idx) => ({ ...l, isSelected: idx === i })));
    setSelectedIndex(i);
  }

  // OPTIONAL: bring selected element to front for consistent layering
  function bringToFront(i) {
    setLines((prev) => {
      const next = [...prev];
      const [picked] = next.splice(i, 1);
      next.push(picked);
      // Update selectedIndex to the new position (end)
      setSelectedIndex(next.length - 1);
      return next.map((l, idx) => ({
        ...l,
        isSelected: idx === next.length - 1,
      }));
    });
  }

  /* ------------------------------------------------------------------------------------ */
  /*                            tightly coupled grid functions                            */
  /* ------------------------------------------------------------------------------------ */
  function drawGrid(ctx) {
    const { width, height } = ctx.canvas;
    const gridSize = 10; // Adjust grid size as needed

    // ctx.strokeStyle = "#ddd"; // Light gray grid lines
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;

    // Draw vertical grid lines
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function convertToFeet(distance) {
    const feet = Math.round(distance / gridSize);

    return feet;
  }

  function snapNumberToGrid(number) {
    return Math.round(number / gridSize) * gridSize;
  }

  function addNote(note) {
    const formattedNote = {
      id: newId(),
      startX: noteCoordinates[0],
      startY: noteCoordinates[1],
      endX: noteCoordinates[0],
      endY: noteCoordinates[1],
      midpoint: null,
      isSelected: false,
      color: "black",
      isNote: true,
      note,
    };
    setLines([...lines, formattedNote]);
  }

  function handleAddDownspout(downspoutData) {
    const currentDownspout = unfilteredProducts.find((product) => {
      return (
        product.name.includes("ownspout") &&
        product.name
          .toLowerCase()
          .includes(downspoutData.profile.toLowerCase()) &&
        product.name.includes(downspoutData.downspoutSize.split(" ")[0])
      );
    });

    const formattedDownspout = {
      id: newId(),
      startX: downspoutCoordinates[0],
      startY: downspoutCoordinates[1],
      endX: downspoutCoordinates[0],
      endY: downspoutCoordinates[1],
      midpoint: null,
      measurement: parseInt(downspoutData.totalFootage),
      color: currentDownspout.visual,
      isSelected: false,
      isDownspout: true,
      price: currentDownspout.price,
      elbowSequence: downspoutData.elbowSequence,
      downspoutSize: downspoutData.downspoutSize,
      currentProduct: {
        price: currentDownspout.price,
        name:
          downspoutData.downspoutSize.split(" ")[0] +
          downspoutData.downspoutSize.split(" ")[1] +
          " Downspout",
        description: currentDownspout.description,
      },
      rainBarrel: downspoutData.rainBarrel,
      splashBlock: downspoutData.splashBlock,
      undergroundDrainage: downspoutData.undergroundDrainage,
    };
    setLines([...lines, formattedDownspout]);
  }

  /* ------------------------------------------------------------------------------------ */
  /*                               event listeners                                        */
  /* ------------------------------------------------------------------------------------ */

  /* function handleMouseDown(e) {
    if (isDownspoutModalOpen) return;

    let offsetX, offsetY;
    let foundLine = null;

    if (e.nativeEvent?.touches) {
      const touch = e.nativeEvent.touches[0];
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else if (e.nativeEvent) {
      offsetX = e.nativeEvent.offsetX;
      offsetY = e.nativeEvent.offsetY;
    } else {
      console.error("Mouse event missing nativeEvent offsets");
      return;
    }

    if (tool === "downspout") {
      const snappedX = snapNumberToGrid(offsetX);
      const snappedY = snapNumberToGrid(offsetY);

      setDownspoutCoordinates([snappedX, snappedY]);
      console.log("Opening Downspout modal at:", [snappedX, snappedY]);

      setIsDownspoutModalOpen(true);
      setActiveModal("downspout");
      return;
    } else if (tool === "note") {
      const snappedX = snapNumberToGrid(offsetX);
      const snappedY = snapNumberToGrid(offsetY);

      setNoteCoordinates([snappedX, snappedY]);
      console.log("adding note here", [snappedX, snappedY]);
      setActiveModal("note");
      console.log("make a note");
    } else if (tool === "select") {
      if (tool === "select" && selectedLine?._id) {
        if (
          calculateDistance(
            [offsetX, offsetY],
            [selectedLine.startX, selectedLine.startY]
          ) < 10
        ) {
          setDraggingEndpoint("start");
        } else if (
          calculateDistance(
            [offsetX, offsetY],
            [selectedLine.endX, selectedLine.endY]
          ) < 10
        ) {
          setDraggingEndpoint("end");
        } else {
          setDraggingEndpoint(null);
        }
      }

      const updatedLines = lines.map((line) => ({
        ...line,
        isSelected: false,
      }));

      updatedLines.forEach((line) => {
        if (
          isLineNearPoint(
            line.startX,
            line.startY,
            line.endX,
            line.endY,
            snapNumberToGrid(offsetX),
            snapNumberToGrid(offsetY),
            5
          )
        ) {
          foundLine = { ...line, isSelected: true };
        }
      });

      if (foundLine) {
        setLines(
          updatedLines.map((line) =>
            line.startX === foundLine.startX && line.startY === foundLine.startY
              ? foundLine
              : line
          )
        );
        console.log(foundLine);
        setSelectedLine(foundLine);
      } else {
        console.log("No line found near click");
      }
    } else {
      setCurrentLine({
        startX: snapNumberToGrid(offsetX),
        startY: snapNumberToGrid(offsetY),
        endX: snapNumberToGrid(offsetX),
        endY: snapNumberToGrid(offsetY),
        isVertical: false,
        isHorizontal: false,
        isSelected: false,
        color: "black",
      });
      setIsDrawing(true);
    }
  }
 */
  /* function handleMouseDown(e) {
    if (isDownspoutModalOpen) return;

    let offsetX, offsetY;
    let foundLine = null;

    if (e.nativeEvent?.touches) {
      const touch = e.nativeEvent.touches[0];
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else if (e.nativeEvent) {
      offsetX = e.nativeEvent.offsetX;
      offsetY = e.nativeEvent.offsetY;
    } else {
      console.error("Mouse event missing nativeEvent offsets");
      return;
    }

    const snappedX = snapNumberToGrid(offsetX);
    const snappedY = snapNumberToGrid(offsetY);

    // Tool: Downspout
    if (tool === "downspout") {
      setDownspoutCoordinates([snappedX, snappedY]);
      setIsDownspoutModalOpen(true);
      setActiveModal("downspout");
      return;
    }

    // Tool: Note
    if (tool === "note") {
      setNoteCoordinates([snappedX, snappedY]);
      setActiveModal("note");
      return;
    }

    // Tool: Select
    if (tool === "select") {
      // 1) If a line is already selected, check if user clicked an endpoint to start resizing
      if (selectedLineId) {
        const line = lines.find((l) => l.id === selectedLineId);
        if (line) {
          if (
            calculateDistance([offsetX, offsetY], [line.startX, line.startY]) <
            10
          ) {
            setDraggingEndpoint("start");
            return; // begin resize
          }
          if (
            calculateDistance([offsetX, offsetY], [line.endX, line.endY]) < 10
          ) {
            setDraggingEndpoint("end");
            return; // begin resize
          }
        }
      }

      // 2) Otherwise, try to select a line by clicking near it
      const updatedLines = lines.map((line) => ({
        ...line,
        isSelected: false,
      }));
      updatedLines.forEach((line) => {
        if (
          isLineNearPoint(
            line.startX,
            line.startY,
            line.endX,
            line.endY,
            snappedX,
            snappedY,
            5
          )
        ) {
          foundLine = { ...line, isSelected: true };
        }
      });

      if (foundLine) {
        setLines(
          updatedLines.map((line) =>
            line.id === foundLine.id ? foundLine : line
          )
        );
        setSelectedLineId(foundLine.id);
      } else {
        // Clicked empty space: clear selection
        setSelectedLineId(null);
        setLines(updatedLines);
      }
      return;
    }

    // Tool: (default) draw
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
 */
  function handleMouseDown(e) {
    if (isDownspoutModalOpen) return;

    const { x, y } = getCanvasCoords(e);
    const snappedX = snapNumberToGrid(x);
    const snappedY = snapNumberToGrid(y);

    // 3A) TOOL: downspout → start the modal
    if (tool === "downspout") {
      setDownspoutCoordinates([snappedX, snappedY]);
      setIsDownspoutModalOpen(true);
      setActiveModal("downspout");
      return;
    }

    // 3B) TOOL: note → open modal to add a note
    if (tool === "note") {
      setNoteCoordinates([snappedX, snappedY]);
      setActiveModal("note");
      return;
    }

    // 3C) TOOL: select → hit test from top-most
    if (tool === "select") {
      // Try hit-testing in reverse draw order (topmost first)
      let hitIndex = null;
      let dragMode = "none";
      let end = null;

      for (let i = lines.length - 1; i >= 0; i--) {
        const el = lines[i];

        if (el.isNote) {
          if (hitTestAnnotation(el, x, y)) {
            hitIndex = i;
            dragMode = "move";
            break;
          }
        } else if (el.isDownspout) {
          if (hitTestDownspout(el, x, y)) {
            hitIndex = i;
            dragMode = "move";
            break;
          }
        } else {
          // It's a line
          const hit = hitTestLine(el, x, y);
          if (hit) {
            hitIndex = i;
            if (hit.hit === "start" || hit.hit === "end") {
              dragMode = "drag-end";
              end = hit.hit; // "start" | "end"
            } else {
              dragMode = "move"; // drag the whole line
            }
            break;
          }
        }
      }

      if (hitIndex !== null) {
        // Select & (optionally) bring to front
        // selectIndex(hitIndex);
        bringToFront(hitIndex); // use this if you want "selected is on top"

        setDragging({
          mode: dragMode,
          end: end ?? null,
          lastX: x,
          lastY: y,
        });
        return;
      }

      // If nothing hit, clear selection
      setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
      setSelectedIndex(null);
      setDragging({ mode: "none", end: null, lastX: 0, lastY: 0 });
      return;
    }

    // 3D) Default tool (draw a new line)
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

  /* function handleMouseMove(e) {
    if (isDownspoutModalOpen) return;
    if ((!isDrawing || tool === "downspout") && tool !== "select") return;

    let offsetX, offsetY;
    if (e.nativeEvent?.touches) {
      const touch = e.nativeEvent?.touches[0];

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else {
      // Mouse event
      offsetX = e.nativeEvent?.offsetX;
      offsetY = e.nativeEvent?.offsetY;
    }
    if (tool === "select" && draggingEndpoint && selectedLine) {
      const updatedLine = { ...selectedLine };

      if (draggingEndpoint === "start") {
        updatedLine.startX = snapNumberToGrid(offsetX);
        updatedLine.startY = snapNumberToGrid(offsetY);
      } else if (draggingEndpoint === "end") {
        updatedLine.endX = snapNumberToGrid(offsetX);
        updatedLine.endY = snapNumberToGrid(offsetY);
      }

      // Recalculate midpoint + measurement
      updatedLine.midpoint = [
        (updatedLine.startX + updatedLine.endX) / 2,
        (updatedLine.startY + updatedLine.endY) / 2,
      ];
      updatedLine.measurement = convertToFeet(
        calculateDistance(
          [updatedLine.startX, updatedLine.startY],
          [updatedLine.endX, updatedLine.endY]
        )
      );

      setLines((prev) =>
        prev.map((line) =>
          line.startX === selectedLine.startX &&
          line.startY === selectedLine.startY &&
          line.endX === selectedLine.endX &&
          line.endY === selectedLine.endY
            ? updatedLine
            : line
        )
      );
      setSelectedLine(updatedLine);
      return; // exit so it doesn’t fall back to normal draw logic
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
        endX: snapNumberToGrid(offsetX),
        endY: snapNumberToGrid(offsetY),
        color: "#14c414",
      }));
    } else {
      setCurrentLine((prevLine) => ({
        ...prevLine,
        endX: snapNumberToGrid(offsetX),
        endY: snapNumberToGrid(offsetY),
        color: "black",
      }));
    }

    let pt1 = [currentLine.startX, currentLine.startY];
    let pt2 = [currentLine.endX, currentLine.endY];
    setLineLength(convertToFeet(calculateDistance(pt1, pt2)));
  }
 */
  /*   function handleMouseMove(e) {
    if (isDownspoutModalOpen) return;

    let offsetX, offsetY;
    if (e.nativeEvent?.touches) {
      const touch = e.nativeEvent?.touches[0];
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else {
      offsetX = e.nativeEvent?.offsetX;
      offsetY = e.nativeEvent?.offsetY;
    }

    const snappedX = snapNumberToGrid(offsetX);
    const snappedY = snapNumberToGrid(offsetY);

    // === RESIZE MODE (select tool + dragging an endpoint) ===
    if (tool === "select" && draggingEndpoint && selectedLineId) {
      setLines((prev) =>
        prev.map((line) => {
          if (line.id !== selectedLineId) return line;
          const updated = { ...line };
          if (draggingEndpoint === "start") {
            updated.startX = snappedX;
            updated.startY = snappedY;
          } else {
            updated.endX = snappedX;
            updated.endY = snappedY;
          }
          recalcGeometry(updated);
          return updated;
        })
      );
      return; // don’t fall into draw logic
    }

    // === HOVER FEEDBACK IN SELECT MODE (optional cursor) ===
    if (tool === "select" && selectedLineId) {
      const canvas = canvasRef.current;
      const line = lines.find((l) => l.id === selectedLineId);
      if (line) {
        const nearStart =
          calculateDistance([offsetX, offsetY], [line.startX, line.startY]) <
          10;
        const nearEnd =
          calculateDistance([offsetX, offsetY], [line.endX, line.endY]) < 10;
        canvas.style.cursor = nearStart || nearEnd ? "pointer" : "default";
      }
    }

    // === DRAW MODE ===
    if (
      !isDrawing ||
      tool === "downspout" ||
      tool === "select" ||
      tool === "note"
    )
      return;

    // snap and colorize the preview line
    const nextLine = {
      ...currentLine,
      endX: snappedX,
      endY: snappedY,
      color:
        isLineParallelToSide(
          currentLine.startX,
          currentLine.startY,
          snappedX,
          snappedY
        ) ||
        isLineParallelToTop(
          currentLine.startX,
          currentLine.startY,
          snappedX,
          snappedY
        )
          ? "#14c414"
          : "black",
    };
    setCurrentLine(nextLine);

    // live length preview
    const pt1 = [nextLine.startX, nextLine.startY];
    const pt2 = [nextLine.endX, nextLine.endY];
    setLineLength(convertToFeet(calculateDistance(pt1, pt2)));
  } */
  function handleMouseMove(e) {
    if (isDownspoutModalOpen) return;

    const { x, y } = getCanvasCoords(e);
    const snappedX = snapNumberToGrid(x);
    const snappedY = snapNumberToGrid(y);

    // 4A) SELECT mode: dragging something?
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
          // Move note anchor
          el.startX += dx;
          el.startY += dy;
          el.endX = el.startX;
          el.endY = el.startY;
        } else if (el.isDownspout) {
          // Move downspout center
          el.startX += dx;
          el.startY += dy;
          el.endX = el.startX;
          el.endY = el.startY;
        } else {
          // It's a line
          if (dragging.mode === "move") {
            el.startX += dx;
            el.startY += dy;
            el.endX += dx;
            el.endY += dy;
          } else if (dragging.mode === "drag-end") {
            if (dragging.end === "start") {
              el.startX = snappedX;
              el.startY = snappedY;
            } else if (dragging.end === "end") {
              el.endX = snappedX;
              el.endY = snappedY;
            }
          }
          updateLineComputedProps(el);
        }

        return next;
      });

      setDragging((prev) => ({ ...prev, lastX: x, lastY: y }));
      return; // don't fall through to draw logic
    }

    // 4B) DRAW mode: continue your existing line draw logic
    if (
      isDrawing &&
      tool !== "downspout" &&
      tool !== "select" &&
      tool !== "note"
    ) {
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
          endX: snappedX,
          endY: snappedY,
          color: "#14c414",
        }));
      } else {
        setCurrentLine((prevLine) => ({
          ...prevLine,
          endX: snappedX,
          endY: snappedY,
          color: "black",
        }));
      }

      const pt1 = [currentLine.startX, currentLine.startY];
      const pt2 = [snappedX, snappedY];
      setLineLength(convertToFeet(calculateDistance(pt1, pt2)));
    }
  }

  // Stop drawing on mouseup
  /*   function handleMouseUp(e) {
    if (isDownspoutModalOpen) return;
    const currentProduct = filteredProducts?.find(
      (product) => product.name === tool
    );
    if (tool === "select") {
      setIsDrawing(false);
      return;
    }

    if (tool === "note") {
      return;
    }

    if (tool === "downspout") {
      console.log("ds select");
      return;
    }

    if (tool === "select") {
      setDraggingEndpoint(null);
      return;
    }

    if (e.nativeEvent?.touches) {
      let offsetX, offsetY;
      const touch = e.nativeEvent?.touches[0];

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch?.clientX - rect.left;
      offsetY = touch?.clientY - rect.top;
    }

    currentLine.midpoint = [
      (currentLine.startX + currentLine.endX) / 2,
      (currentLine.startY + currentLine.endY) / 2,
    ];
    currentLine.measurement = lineLength;

    if (isDrawing) {
      if (
        isLineParallelToSide(
          currentLine.startX,
          currentLine.startY,
          currentLine.endX,
          currentLine.endY
        )
      ) {
        currentLine.isVertical = true;
        currentLine.isHorizontal = false;
        if (currentLine.midpoint[0] >= canvasBaseMeasurements.width / 2) {
          currentLine.position = "right";
        } else {
          currentLine.position = "left";
        }
      } else if (
        isLineParallelToTop(
          currentLine.startX,
          currentLine.startY,
          currentLine.endX,
          currentLine.endY
        )
      ) {
        currentLine.isHorizontal = true;
        currentLine.isVertical = false;
        if (currentLine.midpoint[1] <= canvasBaseMeasurements.height / 2) {
          currentLine.position = "top";
        } else {
          currentLine.position = "bottom";
        }
      } else {
        currentLine.isVertical = false;
        currentLine.isHorizontal = false;
      }

      currentLine.color = currentProduct?.colorCode;
      const updatedLine = { ...currentLine };
      updatedLine.currentProduct = currentProduct;
      updatedLine.id = newId();

      if (
        currentLine.startX === currentLine.endX &&
        currentLine.startY === currentLine.endY
      ) {
        return;
      } else {
        setLines([...lines, updatedLine]); // Save the current line
      }
    }

    setIsDrawing(false);
    setLineLength(0);
  }
 */
  /* function handleMouseUp(e) {
    if (isDownspoutModalOpen) return;

    // Finish resizing in select mode
    if (tool === "select") {
      setDraggingEndpoint(null);
      return;
    }

    if (tool === "note" || tool === "downspout") return;

    // Commit the newly drawn line
    if (isDrawing) {
      const currentProduct = filteredProducts?.find((p) => p.name === tool);
      const committed = { ...currentLine };
      recalcGeometry(committed);
      committed.color = currentProduct?.colorCode;
      committed.currentProduct = currentProduct;
      committed.id = newId();

      if (
        committed.startX !== committed.endX ||
        committed.startY !== committed.endY
      ) {
        setLines((prev) => [...prev, committed]);
      }
    }

    setIsDrawing(false);
    setLineLength(0);
  }
 */
  function handleMouseUp(e) {
    if (isDownspoutModalOpen) return;

    // Finish any drag in select mode
    if (tool === "select") {
      setDragging({ mode: "none", end: null, lastX: 0, lastY: 0 });
      setIsDrawing(false);
      return;
    }

    // Notes / downspouts don't draw here (handled by modal)
    if (tool === "note" || tool === "downspout") {
      setIsDrawing(false);
      return;
    }

    // Finish drawing a new line
    const currentProduct = filteredProducts?.find(
      (product) => product.name === tool
    );

    const updated = { ...currentLine };
    updated.midpoint = [
      (updated.startX + updated.endX) / 2,
      (updated.startY + updated.endY) / 2,
    ];
    updated.measurement = convertToFeet(
      calculateDistance(
        [updated.startX, updated.startY],
        [updated.endX, updated.endY]
      )
    );

    updateLineComputedProps(updated);
    updated.currentProduct = currentProduct;
    const productColor =
      currentProduct?.colorCode ?? currentProduct?.visual ?? "black";
    updated.color = productColor;
    // ignore zero-length
    if (updated.startX === updated.endX && updated.startY === updated.endY) {
      setIsDrawing(false);
      setLineLength(0);
      return;
    }

    setLines((prev) => [...prev, updated]);
    setIsDrawing(false);
    setLineLength(0);
  }

  function placeMeasurement(line, measurement, x, y) {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.font = "900 12px Arial";
    context.textAlign = "center";
    context.fillStyle = "black";

    if (line.isHorizontal) {
      if (line.position === "top") {
        context.fillText(measurement.toString() + "'", x, y - gridSize / 1.5);
      } else if (line.position === "bottom") {
        context.fillText(measurement.toString() + "'", x, y + gridSize * 1.5);
      }
    }

    if (line.isVertical) {
      if (line.position === "left") {
        context.fillText(measurement.toString() + "'", x - gridSize / 0.75, y);
      } else if (line.position === "right") {
        context.fillText(measurement.toString() + "'", x + gridSize * 1.25, y);
      }
    }

    if (!line.isVertical && !line.isHorizontal) {
      context.fillText(measurement.toString() + "'", x, y - gridSize / 1.5);
    }
  }

  function renderSelectedDiagram(ctx, diagram) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear canvas
    drawGrid(ctx);
    diagram?.forEach((line) => {
      drawLine(ctx, line);
    });
  }

  function drawAllLines(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear canvas
    drawGrid(ctx);
    // Draw each saved line or product using its own properties
    lines.forEach((line) => {
      drawLine(ctx, line);
    });

    // Draw the current line if it's being drawn
    if (isDrawing) {
      drawLine(ctx, currentLine); // Draw current line in-progress
    }
  }
  function drawLine(ctx, line) {
    const {
      startX,
      startY,
      endX,
      endY,
      midpoint,
      measurement,
      color,
      isSelected,
      isDownspout,
    } = line;

    const x1 = Math.round(startX / gridSize) * gridSize;
    const y1 = Math.round(startY / gridSize) * gridSize;
    const x2 = Math.round(endX / gridSize) * gridSize;
    const y2 = Math.round(endY / gridSize) * gridSize;

    // --- Annotation ---
    if (line.isNote) {
      // draw the text (as you already do)
      ctx.font = "1000 12px Arial";
      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.fillText(line.note, startX, startY);

      // If selected, draw a highlight box around text
      if (isSelected) {
        const text = line.note || "";
        const textWidth = ctx.measureText(text).width;
        const paddingX = 6;
        const paddingY = 4;
        const textHeight = 12;

        const bx = startX - textWidth / 2 - paddingX;
        const by = startY - textHeight - paddingY;
        const bw = textWidth + paddingX * 2;
        const bh = textHeight + paddingY * 2;

        ctx.save();
        ctx.strokeStyle = "orange";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();
      }
      return;
    }

    // --- Downspout ---
    if (isDownspout) {
      // your "X" shape
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + gridSize / 2.75, y1 + gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - gridSize / 2.75, y1 + gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - gridSize / 2.75, y1 - gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + gridSize / 2.75, y1 - gridSize / 2.75);
      ctx.strokeStyle = line.color;
      ctx.stroke();

      // elbow box
      const boxX = startX + 5;
      const boxY = startY + 5;
      const boxWidth = 60;
      const boxHeight = 20;

      ctx.fillStyle = "grey";
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(line.elbowSequence, boxX + boxWidth / 2, boxY + 15);

      // selection highlight
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = "orange";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(boxX - 4, boxY - 4, boxWidth + 8, boxHeight + 8);

        // small handle at the center "X"
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(startX, startY, gridSize * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    // --- Line (gutter) ---
    // Draw the segment
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    if (isSelected) {
      ctx.strokeStyle = "orange";
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
    }
    ctx.stroke();
    ctx.closePath();

    // When selected, always show endpoint handles
    if (isSelected) {
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(x1, y1, gridSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, gridSize / 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // measurement
    if (midpoint && measurement) {
      placeMeasurement(line, measurement, midpoint[0], midpoint[1]);
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    setLines([]);
    setLineLength(0);
  }

  function handleToolSelectChange(e) {
    const selectedTool = e.target.value;
    setTool(selectedTool);
    // const currentProduct = products.find(product => product.name === selectedTool)
    // setSelectedProduct(currentProduct)
  }

  function calculateEndCapsAndMiters(analysisData) {
    // analysisData shape:
    // {
    //   endCapsByProduct: { '<profileKey>': qty, ... },
    //   mitersByProduct: {
    //     '<profileKey>': { inside90, outside90, bay135, custom: [{angle,count}, ...] },
    //     ...
    //   },
    //   mixedMiters: { ... } // (not priced here unless you want to handle it)
    // }

    const endCaps = {}; // { profileKey: { price, quantity, product } }
    const miters = {}; // { profileKey: [ { type, price, quantity, product }, ... ] }
    const customMiters = {}; // { profileKey: [ { type, price, quantity, product, angle }, ... ] }

    const accessoryLineItems = []; // <- flat list for PDF: {name, quantity, price, product, meta}

    // ---- helpers ----
    const caseIncludes = (hay, needle) =>
      String(hay).toLowerCase().includes(String(needle).toLowerCase());

    function pushLineItem({ name, quantity, price, product, meta }) {
      accessoryLineItems.push({ name, quantity, price, product, meta });
    }

    // -------- End Caps --------
    Object.keys(analysisData.endCapsByProduct || {}).forEach((profileKey) => {
      const qty = analysisData.endCapsByProduct[profileKey] || 0;
      if (!qty) return;

      // Find a matching product: "<profileKey> ... End Cap"
      // e.g. profileKey: 5" K-Style → product name like `5" K-Style End Cap Left/Right`
      const match = unfilteredProducts.find(
        (p) =>
          caseIncludes(p.name, profileKey) && caseIncludes(p.name, "end cap")
      );

      if (match) {
        endCaps[profileKey] = {
          price: match.price,
          quantity: qty,
          product: match,
        };

        pushLineItem({
          name: match.name,
          quantity: qty,
          price: match.price,
          product: match,
          meta: { kind: "endCap", profileKey },
        });
      }
    });

    // -------- Miters (per product) --------
    Object.keys(analysisData.mitersByProduct || {}).forEach((profileKey) => {
      const m = analysisData.mitersByProduct[profileKey] || {};
      const stripQty = (m.inside90 || 0) + (m.outside90 || 0);
      const bayQty = m.bay135 || 0;

      // Strip Miter
      if (stripQty > 0) {
        const strip = unfilteredProducts.find(
          (p) =>
            caseIncludes(p.name, profileKey) &&
            caseIncludes(p.name, "strip") &&
            caseIncludes(p.name, "miter")
        );
        if (strip) {
          (miters[profileKey] ||= []).push({
            type: "Strip Miter",
            price: strip.price,
            quantity: stripQty,
            product: strip,
          });
          pushLineItem({
            name: strip.name,
            quantity: stripQty,
            price: strip.price,
            product: strip,
            meta: { kind: "miter", profileKey, type: "Strip Miter" },
          });
        }
      }

      // Bay 135 Miter
      if (bayQty > 0) {
        const bay = unfilteredProducts.find(
          (p) =>
            caseIncludes(p.name, profileKey) &&
            caseIncludes(p.name, "bay") &&
            caseIncludes(p.name, "miter")
        );
        if (bay) {
          (miters[profileKey] ||= []).push({
            type: "Bay 135 Miter",
            price: bay.price,
            quantity: bayQty,
            product: bay,
          });
          pushLineItem({
            name: bay.name,
            quantity: bayQty,
            price: bay.price,
            product: bay,
            meta: { kind: "miter", profileKey, type: "Bay 135 Miter" },
          });
        }
      }

      // Custom Miters
      (m.custom || []).forEach(({ angle, count }) => {
        if (!count) return;
        const custom = unfilteredProducts.find(
          (p) =>
            caseIncludes(p.name, profileKey) &&
            caseIncludes(p.name, "custom") &&
            caseIncludes(p.name, "miter")
        );
        if (custom) {
          (customMiters[profileKey] ||= []).push({
            type: `Custom Miter (${angle}°)`,
            price: custom.price,
            quantity: count,
            product: custom,
            angle,
          });
          pushLineItem({
            name: custom.name,
            quantity: count,
            price: custom.price,
            product: custom,
            meta: { kind: "miter", profileKey, type: "Custom", angle },
          });
        }
      });
    });

    // Mixed miters (different profiles at one corner) — optional handling.
    // If you want to price these, add similar find() logic using the combo key.
    // Object.keys(analysisData.mixedMiters || {}).forEach((comboKey) => { ... });

    return {
      endCaps,
      miters,
      customMiters,
      accessoryLineItems, // <- use this in your PDF
    };
  }

  function saveDiagram(saveType) {
    setSelectedLineId(null);

    if (lines.length === 0) {
      closeModal();
      return;
    }

    // Check if diagram actually changed

    const original = originalDiagram?.lines || [];
    const hasChanged = JSON.stringify(lines) !== JSON.stringify(original);
    if (!hasChanged) {
      closeModal();
      return;
    }

    // Only trigger the confirm modal *here* for overwrite,
    // or for adds when caller explicitly wanted a confirm.
    if (saveType !== "add") {
      setActiveModal("confirmDiagramOverwrite");
    }

    function getBoundingBox(lines, padding = 20) {
      // <-- 🔥 add a default padding value
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      lines.forEach((line) => {
        minX = Math.min(minX, line.startX, line.endX);
        minY = Math.min(minY, line.startY, line.endY);
        maxX = Math.max(maxX, line.startX, line.endX);
        maxY = Math.max(maxY, line.startY, line.endY);
      });

      // Expand the box by padding
      return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
      };
    }

    const token = localStorage.getItem("jwt");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    drawAllLines(ctx);

    const boundingBox = getBoundingBox(lines, 30);
    const cropWidth = boundingBox.maxX - boundingBox.minX;
    const cropHeight = boundingBox.maxY - boundingBox.minY;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    const thumbnailDisplaySize = 200; // what you want it to *look* like
    const thumbnailInternalSize = 3 * thumbnailDisplaySize; // 2x pixel density for crispness

    tempCanvas.width = thumbnailInternalSize;
    tempCanvas.height = thumbnailInternalSize;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    const padding = 0.05 * thumbnailInternalSize; // padding based on bigger internal size

    const availableWidth = thumbnailInternalSize - padding * 2;
    const availableHeight = thumbnailInternalSize - padding * 2;

    const scale = Math.min(
      availableWidth / cropWidth,
      availableHeight / cropHeight
    );

    const destWidth = cropWidth * scale;
    const destHeight = cropHeight * scale;

    const dx = (thumbnailInternalSize - destWidth) / 2;
    const dy = (thumbnailInternalSize - destHeight) / 2;

    tempCtx.fillStyle = "#ffffff"; // optional background
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage(
      canvas,
      boundingBox.minX,
      boundingBox.minY,
      cropWidth,
      cropHeight,
      dx,
      dy,
      destWidth,
      destHeight
    );

    const thumbnailDataUrl = tempCanvas.toDataURL("image/png");
    let totalFootage = 0;
    let price = 0;
    let downspoutCentsPrice;

    lines.forEach((line) => {
      if (line.isDownspout) {
        const downspoutPrice = parseFloat(line.price).toFixed(2);

        price += downspoutPrice * line.measurement;
      } else if (line.isNote) {
        price += 0;
      } else {
        price += parseFloat(line.currentProduct.price) * line.measurement;
      }
    });

    const analysis = analyzeJoints(lines);
    const endcapMiterData = {
      // New per-product/mixed output:
      endCapsByProduct: analysis.endCapsByProduct,
      mitersByProduct: analysis.mitersByProduct,
      mixedMiters: analysis.mixedMiters,
    };

    const { endCaps, miters, customMiters, accessoryLineItems } =
      calculateEndCapsAndMiters(endcapMiterData);

    // Add accessory costs to price
    for (const item of accessoryLineItems) {
      // unit price * qty
      price += Number(item.price) * Number(item.quantity || 0);
    }
    // --- aggregate elbow counts by size ---
    const elbowCountsBySize = {}; // e.g. { "2x3": { A: 3, B: 2 }, "3x4": { A: 1 } }

    lines.forEach((line) => {
      if (!line.isDownspout || !line.elbowSequence) return;

      const sizeKey = getDownspoutSizeKey(line); // "2x3", "3x4", "unknown"
      if (!elbowCountsBySize[sizeKey]) elbowCountsBySize[sizeKey] = {};

      const seqCounts = countElbowsInSequence(line.elbowSequence);
      mergeCounts(elbowCountsBySize[sizeKey], seqCounts);
    });

    // If you want a flat array of line items (useful for your estimate modal/PDF):
    const elbowLineItems = [];
    for (const [sizeKey, counts] of Object.entries(elbowCountsBySize)) {
      for (const [code, qty] of Object.entries(counts)) {
        // Prefer a human label from ELBOW_LABELS; otherwise fall back to "<size> <code> Elbow"
        const label =
          ELBOW_LABELS[sizeKey]?.[code] || `${sizeKey} ${code} Elbow`;

        elbowLineItems.push({
          key: `${sizeKey}:${code}`, // stable key if you render lists
          size: sizeKey,
          code, // A/B/C…
          quantity: qty,
          description: label, // what you’ll show in your PDF
        });
      }
    }

    // (Optional) sort for stable output
    elbowLineItems.sort((a, b) =>
      a.size === b.size
        ? a.code.localeCompare(b.code)
        : a.size.localeCompare(b.size)
    );

    const accessoryDataArray = [endCaps, miters, customMiters]; // legacy shape

    const data = {
      lines: [...lines],
      imageData: thumbnailDataUrl,
      totalFootage,
      price: parseFloat(price).toFixed(2),
      miterSummary: analysis.miters,
      endCaps: analysis.endCaps,
      endCapsByProduct: analysis.endCapsByProduct,
      mitersByProduct: analysis.mitersByProduct,
      mixedMiters: analysis.mixedMiters,
      accessoryData: accessoryDataArray,
      accessories: {
        endCaps,
        miters,
        customMiters,
        accessoryLineItems, // <- iterate this in the PDF
      },

      // NEW:
      elbowsBySize: elbowCountsBySize, // grouped object map
      elbowLineItems, // flat array for rendering
    };

    function handleAddDiagramToProject() {
      addDiagramToProject(currentProjectId, token, data)
        .then((newDiagramData) => {
          handlePassDiagramData(newDiagramData);
          // ✅ Optional: Update selected diagram if needed
          // setSelectedDiagram(newDiagramData);
          // clearCanvas();
          closeModal();
        })
        .then(() => {
          clearCanvas();
        })
        .catch((err) => {
          console.error("Failed to save diagram:", err);
          closeModal();
        });
    }

    function handleUpdateDiagram() {
      updateDiagram(currentProjectId, selectedDiagram._id, token, data)
        .then((newDiagramData) => {
          handlePassDiagramData(newDiagramData);
          // ✅ Optional: Update selected diagram if needed
          // setSelectedDiagram(newDiagramData);
          // clearCanvas();
          closeModal();
        })
        .then(() => {
          clearCanvas();
        })
        .catch((err) => {
          console.error("Failed to save diagram:", err);
          closeModal();
        });
    }

    if (saveType === "overwrite") {
      handleUpdateDiagram();
    } else {
      handleAddDiagramToProject();
    }
  }
  if (isLoading) {
    return <div className="diagram">Loading products…</div>;
  }
  if (error) {
    return <div className="diagram">Failed to load products.</div>;
  }

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
            setSelectedDiagram({});
            closeModal();
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
            const original = originalDiagram?.lines || [];
            const hasChanged =
              JSON.stringify(lines) !== JSON.stringify(original);

            if (!hasChanged) return;

            // If we are overwriting an existing diagram, always confirm.
            const isOverwrite = Boolean(selectedDiagram?._id);

            // If adding a brand-new diagram: confirm only when there are existing ones.
            const mustConfirm = isOverwrite || hasExistingDiagrams;

            if (mustConfirm) {
              setActiveModal("confirmDiagramOverwrite");
            } else {
              // First ever diagram for this project: save immediately (no modal)
              saveDiagram("add");
            }
          }}
        />

        <img
          src={trashIcon}
          alt="clear or delete"
          className="diagram__icon diagram__trash"
          onClick={() => {
            if (tool === "select" && selectedIndex !== null) {
              deleteSelected();
            } else {
              clearCanvas();
            }
          }}
        />

        <img
          src={itemsIcon}
          alt="select product"
          className="diagram__icon diagram__items"
          onClick={() => {
            setProductsVisible(true);
          }}
        />
        <select
          value={tool}
          onChange={handleToolSelectChange}
          className="diagram__select-product"
          name="select product dropdown"
          id="select-product-dropdown"
        >
          {filteredProducts?.map((product) => {
            return (
              <option
                style={{
                  backgroundColor: `${product.colorCode}`,
                }}
                value={product.name}
                key={product._id}
              >
                {product.name}
              </option>
            );
          })}
          <option value="downspout">Downspout</option>
          <option value="select">Select</option>
          <option value="note">Notation</option>
          <option value="splashGuard">Splash Guard/Valley Shield</option>
          <option value="freeLine">Free Line</option>
        </select>

        <div className="diagram__line-length-display">
          Current line length: {lineLength}'
        </div>

        <canvas
          ref={canvasRef}
          className="diagram__canvas"
          width={window.innerWidth}
          height={window.innerHeight}
          onPointerDown={handleMouseDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
      </div>
      <DownspoutModal
        setActiveModal={setActiveModal}
        activeModal={activeModal}
        setTool={setTool}
        setIsDownspoutModalOpen={setIsDownspoutModalOpen}
        addDownspout={handleAddDownspout}
      />
      <OverwriteDiagramModal
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        saveDiagram={saveDiagram}
      />
      <AnnotationModal
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        addNote={addNote}
      />
    </>
  );
};

export default Diagram;
