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
  // Products (context first, then API)
  // ✅ Call hooks once at top-level, never conditionally
  const { data: pricingProducts = [], isLoading, error } = useProductsPricing(); // ALL items
  const { data: listedProducts = [] } = useProductsListed(); // fallback (optional)

  const productsCtx = useProductsCatalog();

  const allProducts =
    pricingProducts && pricingProducts.length
      ? pricingProducts
      : listedProducts;

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
  useEffect(() => {
    // console.log("diagram loading refreshing products");
  }, []);
  // canvas + state
  const canvasRef = useRef(null);

  const [tool, setTool] = useState(""); // dropdown selection
  const [isDrawing, setIsDrawing] = useState(false);
  const [gridSize, setGridSize] = useState(10);

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

  const [downspoutCoordinates, setDownspoutCoordinates] = useState([0, 0]);
  const [noteCoordinates, setNoteCoordinates] = useState([0, 0]);
  const [lineLength, setLineLength] = useState(0);
  const [isDownspoutModalOpen, setIsDownspoutModalOpen] = useState(false);

  useEffect(() => {
    console.log(tool);
  }, [tool]);

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

  // default tool -> first gutter
  useEffect(() => {
    if (!tool && filteredProducts.length > 0) {
      setTool(filteredProducts[0].name);
    }
  }, [filteredProducts, tool]);

  // hydrate lines when a diagram is selected
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const withIds = (selectedDiagram?.lines || []).map((l) => ({
      id: l.id || newId(),
      ...l,
    }));
    withIds.forEach((line) => drawLine(ctx, line));
    setLines(withIds);
    baselineHashRef.current = hashLines(withIds);
  }, [selectedDiagram?._id, selectedDiagram]);

  // clean up selection when modal changes
  useEffect(() => {
    if (activeModal !== "selectedLine") {
      setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
      setSelectedIndex(null);
    }
  }, [activeModal]);

  // scale canvas for DPR + redraw grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawGrid(ctx);
  }, [window.innerWidth, window.innerHeight]);

  // redraw everything on state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawAllLines(ctx);
  }, [currentLine, lines, isDrawing]);

  // --- stable diagram hashing (only fields that define "meaningful change") ---
  const baselineHashRef = useRef(null);

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
    const size = 10;
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
  const convertToFeet = (dist) => Math.round(dist / gridSize);
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
    const EP = 10;
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
  function hitTestDownspout(ds, x, y) {
    const r = gridSize;
    if (calculateDistance([x, y], [ds.startX, ds.startY]) <= r) return true;
    const boxX = ds.startX + 5;
    const boxY = ds.startY + 5;
    const boxW = 60;
    const boxH = 20;
    return x >= boxX && x <= boxX + boxW && y >= boxY && y <= boxY + boxH;
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
    return p?.colorCode ?? p?.visual ?? p?.color ?? "#000000";
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
    // console.log(line);
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

      const boxX = x1 + 5;
      const boxY = y1 + 5;
      const w = 60;
      const h = 20;
      ctx.fillStyle = "grey";
      ctx.fillRect(boxX, boxY, w, h);
      ctx.strokeStyle = line.color || "#000";
      ctx.strokeRect(boxX, boxY, w, h);
      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(line.elbowSequence || "", boxX + w / 2, boxY + 15);

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
    if (line.isFreeMark) {
      ctx.save();
      ctx.lineWidth = line.strokeWidth || 2;
      ctx.strokeStyle = line.color || "#111";
      if (line.dashed) ctx.setLineDash([6, 4]);
      ctx.setLineDash(line.dashed ? [6, 4] : []); // ← force style every time

      if (line.kind === "free-line") {
        ctx.beginPath();
        ctx.moveTo(line.startX, line.startY);
        ctx.lineTo(line.endX, line.endY);
        ctx.stroke();
      } else if (line.kind === "free-square") {
        const left = Math.min(line.startX, line.endX);
        const top = Math.min(line.startY, line.endY);
        const w = Math.abs(line.endX - line.startX);
        const h = Math.abs(line.endY - line.startY);
        if (line.fill) {
          ctx.fillStyle = line.color || "#111";
          ctx.fillRect(left, top, w, h);
        } else {
          ctx.strokeRect(left, top, w, h);
        }
      } else if (line.kind === "free-circle") {
        ctx.beginPath();
        ctx.arc(line.centerX, line.centerY, line.radius || 0, 0, Math.PI * 2);
        if (line.fill) {
          ctx.fillStyle = line.color || "#111";
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
      ctx.arc(x1, y1, gridSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, gridSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (line.midpoint && line.measurement) {
      placeMeasurement(
        line,
        line.measurement,
        line.midpoint[0],
        line.midpoint[1]
      );
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

    const formatted = {
      id: newId(),
      startX: downspoutCoordinates[0],
      startY: downspoutCoordinates[1],
      endX: downspoutCoordinates[0],
      endY: downspoutCoordinates[1],
      midpoint: null,
      measurement: parseInt(downspoutData.totalFootage, 10),
      color: currentDownspout?.visual || "#000",
      isSelected: false,
      isDownspout: true,
      price: currentDownspout?.price || 0,
      elbowSequence: downspoutData.elbowSequence,
      downspoutSize: downspoutData.downspoutSize,
      currentProduct: {
        price: currentDownspout?.price || 0,
        name:
          downspoutData.downspoutSize.split(" ")[0] +
          " " +
          downspoutData.downspoutSize.split(" ")[1] +
          " Downspout",
        description: currentDownspout?.description || "",
      },
      rainBarrel: downspoutData.rainBarrel,
      splashBlock: downspoutData.splashBlock,
      undergroundDrainage: downspoutData.undergroundDrainage,
    };
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
      console.log("opening downspout");
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
        } else if (el.isFreeMark) {
          // refined hit-testing for free shapes
          let hit = false;
          if (el.kind === "free-line") {
            const h = hitTestLine(
              {
                startX: el.startX,
                startY: el.startY,
                endX: el.endX,
                endY: el.endY,
              },
              x,
              y
            );
            if (h) {
              hitIndex = i;
              dragMode =
                h.hit === "start" || h.hit === "end" ? "drag-end" : "move";
              end =
                h.hit === "start" ? "start" : h.hit === "end" ? "end" : null;
              break;
            }
          } else if (base.kind === "free-square") {
            // CLICK-TO-PLACE: 1 grid cell square
            const size = gridSize;
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
          } else if (base.kind === "free-circle") {
            // CLICK-TO-PLACE: diameter = 1 grid cell
            const R = Math.max(1, Math.floor(gridSize / 2));
            const circ = {
              ...base,
              centerX: snappedX,
              centerY: snappedY,
              radius: R,
              startX: snappedX, // keep these for any code that reads startX/Y
              startY: snappedY,
              fill: !!base.fill,
            };
            setLines((prev) => [...prev, circ]);
            return; // no drawing session
          }

          if (hit) {
            hitIndex = i;
            dragMode = "move";
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
        const size = Math.max(16, gridSize * 4);
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
        const R = base.radius ?? Math.max(4, Math.floor(gridSize * 2));
        const circ = {
          ...base,
          centerX: snappedX,
          centerY: snappedY,
          radius: R,
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

        if (el.isNote || el.isDownspout) {
          el.startX += dx;
          el.startY += dy;
          el.endX = el.startX;
          el.endY = el.startY;
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
    if (isDownspoutModalOpen) return;

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

  // ======= Save diagram =======
  function saveDiagram(saveType) {
    setSelectedIndex(null);

    function foldAccessoryItems(items) {
      const map = new Map();
      items.forEach((it) => {
        const keyParts = [
          it.product?._id || it.name || it.meta?.profileKey || "unknown",
          it.meta?.kind || "generic",
          it.meta?.type || "",
          it.meta?.angle ?? "",
          it.meta?.inches ?? "",
        ];
        const key = keyParts.join("|");
        const prev = map.get(key);
        if (prev) {
          prev.quantity = Number(prev.quantity || 0) + Number(it.quantity || 0);
        } else {
          map.set(key, { ...it, quantity: Number(it.quantity || 0) });
        }
      });
      return Array.from(map.values());
    }

    if (lines.length === 0) {
      closeModal();
      return;
    }

    // If nothing changed, don't interrupt
    const currentHash = hashLines(lines);
    const hasChanged = currentHash !== baselineHashRef.current;
    if (!hasChanged) {
      closeModal();
      return;
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
        const cx = el.startX;
        const cy = el.startY;
        const cross = {
          minX: cx - r,
          minY: cy - r,
          maxX: cx + r,
          maxY: cy + r,
        };

        const boxX = el.startX + 5;
        const boxY = el.startY + 5;
        const boxWidth = 60;
        const boxHeight = 20;
        const seq = {
          minX: boxX,
          minY: boxY,
          maxX: boxX + boxWidth,
          maxY: boxY + boxHeight,
        };

        return boundsUnion(cross, seq);
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
    drawAllLines(ctx);

    const boundingBox = getBoundingBoxForAll(lines, ctx, 30);
    const cropWidth = boundingBox.maxX - boundingBox.minX;
    const cropHeight = boundingBox.maxY - boundingBox.minY;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    const thumbnailDisplaySize = 200;
    const thumbnailInternalSize = 3 * thumbnailDisplaySize;

    tempCanvas.width = thumbnailInternalSize;
    tempCanvas.height = thumbnailInternalSize;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    const pad = 0.05 * thumbnailInternalSize;

    const availableWidth = thumbnailInternalSize - pad * 2;
    const availableHeight = thumbnailInternalSize - pad * 2;

    const scale = Math.min(
      availableWidth / cropWidth,
      availableHeight / cropHeight
    );

    const destWidth = cropWidth * scale;
    const destHeight = cropHeight * scale;

    const dx = (thumbnailInternalSize - destWidth) / 2;
    const dy = (thumbnailInternalSize - destHeight) / 2;

    tempCtx.fillStyle = "#ffffff";
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

    function calculateEndCapsAndMiters(analysisData) {
      const endCaps = {};
      const miters = {};
      const customMiters = {};
      const accessoryLineItems = [];

      const pushItem = (o) => accessoryLineItems.push(o);

      // End Caps
      Object.keys(analysisData.endCapsByProduct || {}).forEach((profileKey) => {
        const qty = analysisData.endCapsByProduct[profileKey] || 0;
        if (!qty) return;
        const match = allProducts.find(
          (p) =>
            caseIncludes(p.name, profileKey) && caseIncludes(p.name, "end cap")
        );
        if (match) {
          endCaps[profileKey] = {
            price: match.price,
            quantity: qty,
            product: match,
          };
          pushItem({
            name: match.name,
            quantity: qty,
            price: match.price,
            product: match,
            meta: { kind: "endCap", profileKey },
          });
        }
      });

      // Miters
      Object.keys(analysisData.mitersByProduct || {}).forEach((profileKey) => {
        const m = analysisData.mitersByProduct[profileKey] || {};
        const stripQty = (m.inside90 || 0) + (m.outside90 || 0);
        const bayQty = m.bay135 || 0;

        if (stripQty > 0) {
          const strip = allProducts.find(
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
            pushItem({
              name: strip.name,
              quantity: stripQty,
              price: strip.price,
              product: strip,
              meta: { kind: "miter", profileKey, type: "Strip Miter" },
            });
          }
        }

        if (bayQty > 0) {
          const bay = allProducts.find(
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
            pushItem({
              name: bay.name,
              quantity: bayQty,
              price: bay.price,
              product: bay,
              meta: { kind: "miter", profileKey, type: "Bay 135 Miter" },
            });
          }
        }

        (m.custom || []).forEach(({ angle, count }) => {
          if (!count) return;
          const custom = allProducts.find(
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
            pushItem({
              name: custom.name,
              quantity: count,
              price: custom.price,
              product: custom,
              meta: { kind: "miter", profileKey, type: "Custom", angle },
            });
          }
        });
      });

      return { endCaps, miters, customMiters, accessoryLineItems };
    }

    // --- elbows + offsets (priced) ---
    // Replace your existing collectElbowsAndOffsets() with this version
    function collectElbowsAndOffsets(lines, allProducts) {
      // --- helpers ---
      const caseIncludes = (hay, needle) =>
        String(hay).toLowerCase().includes(String(needle).toLowerCase());

      function getSizeKeyFromDownspoutLine(line) {
        // Prefer explicit property (e.g., "2x3 Corrugated") but we just need "2x3"
        const fromProp = String(line.downspoutSize || "").trim();
        // Try "2x3" with or without quotes/spaces
        const rxSize = /(\d+)\s*[xX]\s*(\d+)/;
        const rxQuoted = /(\d+)\s*"?\s*[xX]\s*(\d+)\s*"?/;
        let m = fromProp.match(rxSize) || fromProp.match(rxQuoted);
        if (!m && line.currentProduct?.name) {
          const n = String(line.currentProduct.name || "");
          m = n.match(rxSize) || n.match(rxQuoted);
        }
        if (!m) return "unknown";
        return `${m[1]}x${m[2]}`; // e.g., "2x3" or "3x4"
      }

      // Tokenize the elbow sequence into elbow codes (A/B/C/D) and numeric offsets (2, 4, 6, etc.)
      // Examples that will parse correctly:
      // "AAB2\"C4\"B"  => elbows: A:2, B:2, C:1 ; offsets: 2:1, 4:1
      // "a b c 2\" 6\"" => elbows: A:1,B:1,C:1 ; offsets: 2:1, 6:1
      function parseElbowsAndOffsets(seq) {
        const out = { elbows: {}, offsets: {} };
        if (!seq) return out;

        // This regex captures either a letter A-D (case-insensitive) *or* a number (offset) optionally followed by a double-quote
        const tokenRe = /([A-Da-d])|(\d+)\s*"?/g;
        let m;
        while ((m = tokenRe.exec(String(seq)))) {
          if (m[1]) {
            // Elbow letter
            const code = m[1].toUpperCase();
            out.elbows[code] = (out.elbows[code] || 0) + 1;
          } else if (m[2]) {
            // Numeric offset (inches)
            const inches = String(m[2]);
            out.offsets[inches] = (out.offsets[inches] || 0) + 1;
          }
        }
        return out;
      }

      const items = [];

      // Walk all downspout lines and accumulate elbows/offsets by size
      const elbowCountsBySize = {}; // { "2x3": { A: 3, B: 1, ... }, ... }
      const offsetCountsBySize = {}; // { "2x3": { "2": 2, "4": 1, ... }, ... }

      lines.forEach((line) => {
        if (!line?.isDownspout) return;

        const sizeKey = getSizeKeyFromDownspoutLine(line); // "2x3" / "3x4" / "unknown"
        const { elbows, offsets } = parseElbowsAndOffsets(
          line.elbowSequence || ""
        );

        // Accumulate elbows
        if (!elbowCountsBySize[sizeKey]) elbowCountsBySize[sizeKey] = {};
        Object.entries(elbows).forEach(([code, qty]) => {
          elbowCountsBySize[sizeKey][code] =
            (elbowCountsBySize[sizeKey][code] || 0) + Number(qty || 0);
        });

        // Accumulate offsets
        if (!offsetCountsBySize[sizeKey]) offsetCountsBySize[sizeKey] = {};
        Object.entries(offsets).forEach(([inches, qty]) => {
          offsetCountsBySize[sizeKey][inches] =
            (offsetCountsBySize[sizeKey][inches] || 0) + Number(qty || 0);
        });
      });

      // Turn elbow counts into priced line items via product lookup
      Object.entries(elbowCountsBySize).forEach(([sizeKey, byCode]) => {
        Object.entries(byCode).forEach(([code, qty]) => {
          if (!qty) return;
          const prod = (allProducts || []).find(
            (p) =>
              caseIncludes(p.name, sizeKey) &&
              caseIncludes(p.name, "elbow") &&
              // look for " A " or "-A " etc.; safer to just includes code
              caseIncludes(p.name, ` ${String(code).toUpperCase()} `)
          );
          if (prod) {
            items.push({
              name: prod.name,
              quantity: Number(qty),
              price: prod.price,
              product: prod,
              meta: {
                kind: "elbow",
                sizeKey,
                code: String(code).toUpperCase(),
              },
            });
          }
        });
      });

      // Turn offset counts into priced line items via product lookup
      Object.entries(offsetCountsBySize).forEach(([sizeKey, byInches]) => {
        Object.entries(byInches).forEach(([inches, qty]) => {
          if (!qty) return;
          const prod = (allProducts || []).find(
            (p) =>
              caseIncludes(p.name, sizeKey) &&
              caseIncludes(p.name, "offset") &&
              // match 2", 4", etc. (allow both with or without the quote in DB naming)
              (caseIncludes(p.name, `${inches}"`) ||
                caseIncludes(p.name, ` ${inches} `))
          );
          if (prod) {
            items.push({
              name: prod.name,
              quantity: Number(qty),
              price: prod.price,
              product: prod,
              meta: { kind: "offset", sizeKey, inches: String(inches) },
            });
          }
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

    const data = {
      lines: [...lines],
      imageData: thumbnailDataUrl,
      totalFootage,
      price: parseFloat(price).toFixed(2),
      // legacy fields (ok to keep; not used by new pdf)
      miterSummary: analysis.miters,
      endCaps: analysis.endCaps,
      endCapsByProduct: analysis.endCapsByProduct,
      mitersByProduct: analysis.mitersByProduct,
      mixedMiters: analysis.mixedMiters,
      accessoryData: [endCaps, miters, customMiters],
      // new
      accessories: {
        items: allAccessories, // folded accessories list
      },
    };

    function handleAddDiagramToProject() {
      addDiagramToProject(resolvedProjectId, token, data)
        .then((newDiagramData) => {
          handlePassDiagramData(newDiagramData);
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
