import Modal from "react-modal";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchProjectPhotoBlob,
  getProjectPhotoMeta,
  updateProjectPhotoAnnotations,
} from "../../utils/api";

Modal.setAppElement("#root");

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function deepClone(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}

function cryptoRandomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/**
 * INTERNAL render model (frontend-only):
 * { id, kind, a:{x,y}, b:{x,y}, stroke, fill?, filled?, text?, fontSize? }
 *
 * SERVER model (already existing in your backend schema):
 * { id, type, p1, p2, stroke, strokeWidth, fill, opacity, text, fontSize, ... }
 */

function isRecognizedItem(it) {
  const k = (it && it.kind) || "";
  return (
    k === "line" || k === "rect" || k === "circle" || k === "x" || k === "text"
  );
}

function isRecognizedServerItem(it) {
  const t = (it && it.type) || "";
  return (
    t === "line" || t === "rect" || t === "circle" || t === "x" || t === "text"
  );
}

// Convert server schema -> INTERNAL render schema
function fromServerItem(it) {
  const type = it?.type;
  const stroke = it?.stroke || "#00ff66";
  const strokeWidth = Number(it?.strokeWidth || 3);

  // Prefer p1/p2 (normalized); fallback to x/y/w/h or cx/cy/r
  let a = it?.p1;
  let b = it?.p2;

  if ((!a || !b) && type === "rect" && it && typeof it.x === "number") {
    a = { x: it.x, y: it.y };
    b = { x: (it.x || 0) + (it.w || 0), y: (it.y || 0) + (it.h || 0) };
  }

  if ((!a || !b) && type === "circle" && it && typeof it.cx === "number") {
    const r = Number(it.r || 0);
    a = { x: (it.cx || 0) - r, y: (it.cy || 0) - r };
    b = { x: (it.cx || 0) + r, y: (it.cy || 0) + r };
  }

  if ((!a || !b) && type === "text" && it && typeof it.x === "number") {
    a = { x: it.x, y: it.y };
    b = { x: it.x, y: it.y };
  }

  const fill = it?.fill ?? null;

  return {
    id: it?.id || cryptoRandomId(),
    kind: type,
    a: a || { x: 0, y: 0 },
    b: b || { x: 0, y: 0 },
    stroke,
    strokeWidth,
    fill,
    filled: !!fill,
    opacity: typeof it?.opacity === "number" ? it.opacity : 1,
    text: it?.text,
    fontSize: it?.fontSize,
  };
}

// Convert INTERNAL -> server schema (exact fields backend validates)
function toServerItem(it) {
  const fill = it?.filled ? it?.fill || "rgba(0,255,102,0.18)" : null;

  return {
    id: it?.id || cryptoRandomId(),
    type: it?.kind, // REQUIRED by schema
    stroke: it?.stroke || "#00ff66",
    strokeWidth: Number(it?.strokeWidth || 3),
    fill: fill,
    opacity: typeof it?.opacity === "number" ? it.opacity : 1,
    // Send p1/p2 always (normalized 0..1)
    p1: it?.a || { x: 0, y: 0 },
    p2: it?.b || { x: 0, y: 0 },
    text: it?.kind === "text" ? it?.text || "" : undefined,
    fontSize: it?.kind === "text" ? Number(it?.fontSize || 20) : undefined,
  };
}

export default function FullscreenPhotoAnnotatorModal({
  isOpen,
  onClose,
  projectId,
  photoId,
  token,
  onSaved, // optional callback
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [photoMeta, setPhotoMeta] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);

  // INTERNAL items only (kind/a/b)
  const [items, setItems] = useState([]);
  const initialItemsRef = useRef([]);
  const unknownServerItemsRef = useRef([]); // server items we don’t recognize/render
  const initialUnknownServerItemsRef = useRef([]);

  // history
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  // tool state
  const [tool, setTool] = useState("line"); // line|rectH|rectF|circH|circF|x|text
  const [stroke, setStroke] = useState("#00ff66");

  // canvas + layout
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // rect of the image as displayed inside the container (object-fit: contain)
  const imgRectRef = useRef({
    // client* = viewport coords (for pointer mapping)
    clientLeft: 0,
    clientTop: 0,
    // left/top = local coords relative to container (for canvas drawing)
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  });

  // drawing draft
  const isPointerDownRef = useRef(false);
  const draftRef = useRef(null); // {kind, a, b, ...}

  const canUndo = useMemo(() => undoStackRef.current.length > 0, [items]);
  const canRedo = useMemo(() => redoStackRef.current.length > 0, [items]);

  // Re-draw whenever items/stroke changes
  useEffect(() => {
    if (!isOpen) return;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, stroke, isOpen]);

  function pushUndo(nextItems) {
    undoStackRef.current.push(deepClone(nextItems));
    redoStackRef.current = [];
  }

  function commitItems(next) {
    setItems(next);
  }

  function handleUndo() {
    if (!undoStackRef.current.length) return;
    const prev = undoStackRef.current.pop();
    redoStackRef.current.push(deepClone(items));
    commitItems(prev);
  }

  function handleRedo() {
    if (!redoStackRef.current.length) return;
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(deepClone(items));
    commitItems(next);
  }

  function handleClear() {
    pushUndo(items);
    commitItems([]);
  }

  function toolToItemKind(t) {
    if (t === "line") return "line";
    if (t === "x") return "x";
    if (t === "text") return "text";
    if (t === "rectH" || t === "rectF") return "rect";
    if (t === "circH" || t === "circF") return "circle";
    return "line";
  }

  function isFilledTool(t) {
    return t === "rectF" || t === "circF";
  }

  // Map client (pixel) -> normalized coords in the contained image box
  function clientToNorm(clientX, clientY) {
    const r = imgRectRef.current;
    const x = (clientX - r.clientLeft) / (r.width || 1);
    const y = (clientY - r.clientTop) / (r.height || 1);
    return { x: clamp01(x), y: clamp01(y) };
  }

  // Draw everything
  function draw() {
    const c = canvasRef.current;
    const ctx = c?.getContext?.("2d");
    if (!ctx) return;

    const r = imgRectRef.current;

    // clear full canvas (safe even with DPR transform)
    ctx.clearRect(0, 0, c.width, c.height);

    // helper: norm -> pixel (LOCAL to container/canvas)
    const nx = (p) => r.left + p.x * r.width;
    const ny = (p) => r.top + p.y * r.height;

    function drawItem(it) {
      if (!isRecognizedItem(it)) return;

      const a = it.a || { x: 0, y: 0 };
      const b = it.b || { x: 0, y: 0 };
      const x1 = nx(a);
      const y1 = ny(a);
      const x2 = nx(b);
      const y2 = ny(b);

      ctx.lineWidth = Number(it.strokeWidth || 3);
      ctx.strokeStyle = it.stroke || stroke;
      ctx.fillStyle = it.fill || "rgba(0,255,102,0.18)";

      if (it.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return;
      }

      if (it.kind === "x") {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.moveTo(x1, y2);
        ctx.lineTo(x2, y1);
        ctx.stroke();
        return;
      }

      if (it.kind === "rect") {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);

        if (it.filled) ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);
        return;
      }

      if (it.kind === "circle") {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (it.filled) ctx.fill();
        ctx.stroke();
        return;
      }

      if (it.kind === "text") {
        const txt = (it.text || "").toString();
        if (!txt) return;
        const fs = Number(it.fontSize || 18);
        ctx.font = `${fs}px sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillStyle = it.stroke || stroke;
        ctx.fillText(txt, x1, y1);
      }
    }

    for (const it of items) drawItem(it);
    if (draftRef.current) drawItem(draftRef.current);
  }

  // recompute contained rect + canvas size
  function recomputeLayout() {
    const container = containerRef.current;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!container || !img || !canvas) return;

    const containerBox = container.getBoundingClientRect();

    // canvas = full container in device pixels
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${containerBox.width}px`;
    canvas.style.height = `${containerBox.height}px`;
    canvas.width = Math.max(1, Math.floor(containerBox.width * dpr));
    canvas.height = Math.max(1, Math.floor(containerBox.height * dpr));

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // objectFit: contain math
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const cw = containerBox.width;
    const ch = containerBox.height;

    const imgAspect = iw / ih;
    const boxAspect = cw / ch;

    let drawW, drawH, left, top;
    if (imgAspect > boxAspect) {
      drawW = cw;
      drawH = cw / imgAspect;
      left = containerBox.left;
      top = containerBox.top + (ch - drawH) / 2;
    } else {
      drawH = ch;
      drawW = ch * imgAspect;
      left = containerBox.left + (cw - drawW) / 2;
      top = containerBox.top;
    }

    imgRectRef.current = {
      clientLeft: left,
      clientTop: top,
      left: left - containerBox.left, // LOCAL
      top: top - containerBox.top, // LOCAL
      width: drawW,
      height: drawH,
    };

    draw();
  }

  function startDraft(p) {
    const kind = toolToItemKind(tool);

    draftRef.current = {
      id: cryptoRandomId(),
      kind,
      a: p,
      b: p,
      stroke,
      strokeWidth: 3,
      fill: isFilledTool(tool) ? "rgba(0,255,102,0.18)" : null,
      filled: isFilledTool(tool),
      opacity: 1,
      fontSize: 20,
    };

    draw();
  }

  function updateDraft(p) {
    if (!draftRef.current) return;
    draftRef.current = { ...draftRef.current, b: p };
    draw();
  }

  function commitDraft() {
    const d = draftRef.current;
    draftRef.current = null;
    if (!d) return;

    if (d.kind === "text") {
      const txt = window.prompt("Text:", "");
      if (!txt) {
        draw();
        return;
      }
      const nextItem = { ...d, text: txt, fontSize: 20 };
      pushUndo(items);
      commitItems([...items, nextItem]);
      return;
    }

    pushUndo(items);
    commitItems([...items, d]);
  }

  function onPointerDown(e) {
    const p = clientToNorm(e.clientX, e.clientY);

    const r = imgRectRef.current;
    const inside =
      e.clientX >= r.clientLeft &&
      e.clientX <= r.clientLeft + r.width &&
      e.clientY >= r.clientTop &&
      e.clientY <= r.clientTop + r.height;
    if (!inside) return;

    isPointerDownRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    startDraft(p);
  }

  function onPointerMove(e) {
    if (!isPointerDownRef.current) return;
    const p = clientToNorm(e.clientX, e.clientY);
    updateDraft(p);
  }

  function onPointerUp(e) {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    commitDraft();
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save SERVER schema (type required) + keep unknown items unchanged
      const payloadItems = [
        ...(unknownServerItemsRef.current || []),
        ...(Array.isArray(items) ? items.map(toServerItem) : []),
      ];

      await updateProjectPhotoAnnotations(
        projectId,
        photoId,
        token,
        payloadItems
      );

      // Update initial snapshots so close doesn't revert after saving
      initialItemsRef.current = deepClone(items);
      initialUnknownServerItemsRef.current = deepClone(
        unknownServerItemsRef.current || []
      );

      if (typeof onSaved === "function") onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to save annotations");
    } finally {
      setSaving(false);
    }
  }

  function handleCloseNoSave() {
    setItems(deepClone(initialItemsRef.current || []));
    unknownServerItemsRef.current = deepClone(
      initialUnknownServerItemsRef.current || []
    );
    undoStackRef.current = [];
    redoStackRef.current = [];
    draftRef.current = null;
    onClose();
  }

  // load meta + image when opened
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function boot() {
      setLoading(true);
      try {
        const metaRes = await getProjectPhotoMeta(projectId, photoId, token);
        const photo = metaRes?.photo || metaRes || null;
        if (cancelled) return;

        setPhotoMeta(photo);

        const serverItems = photo?.annotations?.items || [];
        const unknown = serverItems.filter((it) => !isRecognizedServerItem(it));
        const knownInternal = serverItems
          .filter((it) => isRecognizedServerItem(it))
          .map(fromServerItem);

        unknownServerItemsRef.current = deepClone(unknown);
        initialUnknownServerItemsRef.current = deepClone(unknown);

        initialItemsRef.current = deepClone(knownInternal);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setItems(knownInternal);

        const blob = await fetchProjectPhotoBlob(
          projectId,
          photoId,
          token,
          "original"
        );
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        setImgUrl(url);
      } catch (e) {
        console.error(e);
        alert(e?.message || "Failed to open photo");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, photoId, token, onClose]);

  // cleanup object URL on close / replace
  useEffect(() => {
    return () => {
      if (imgUrl) {
        try {
          URL.revokeObjectURL(imgUrl);
        } catch {}
      }
    };
  }, [imgUrl]);

  // recompute on image load + resize
  useEffect(() => {
    if (!isOpen) return;

    function onResize() {
      recomputeLayout();
    }

    window.addEventListener("resize", onResize);

    const ro = new ResizeObserver(() => recomputeLayout());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", onResize);
      try {
        ro.disconnect();
      } catch {}
    };
  }, [isOpen]);

  const modalStyle = {
    overlay: {
      zIndex: 9999,
      backgroundColor: "rgba(0,0,0,0.80)",
    },
    content: {
      inset: "0px",
      padding: 0,
      border: "none",
      borderRadius: 0,
      background: "#0b0b0b",
    },
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleCloseNoSave}
      style={modalStyle}
    >
      <div
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          color: "white",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxSizing: "border-box",
        }}
      >
        {/* top bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "calc(10px + env(safe-area-inset-top)) 12px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <button
            onClick={handleCloseNoSave}
            disabled={saving}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Close
          </button>

          <div style={{ flex: 1, opacity: 0.85, fontSize: 13 }}>
            {photoMeta?.originalMeta?.filename || photoId}
          </div>

          <button
            onClick={handleUndo}
            disabled={!canUndo || saving}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "white",
              cursor: canUndo ? "pointer" : "not-allowed",
              opacity: canUndo ? 1 : 0.5,
            }}
          >
            Undo
          </button>

          <button
            onClick={handleRedo}
            disabled={!canRedo || saving}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "white",
              cursor: canRedo ? "pointer" : "not-allowed",
              opacity: canRedo ? 1 : 0.5,
            }}
          >
            Redo
          </button>

          <button
            onClick={handleClear}
            disabled={saving}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Clear
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: saving ? "#1f4" : "#00cc55",
              border: "1px solid rgba(0,0,0,0.3)",
              color: "black",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* tool bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "10px 12px",
            minHeight: 52,
            boxSizing: "border-box",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            flexWrap: "wrap",
          }}
        >
          <ToolBtn
            label="Line"
            active={tool === "line"}
            onClick={() => setTool("line")}
          />
          <ToolBtn
            label="Rect"
            active={tool === "rectH"}
            onClick={() => setTool("rectH")}
          />
          <ToolBtn
            label="Rect Fill"
            active={tool === "rectF"}
            onClick={() => setTool("rectF")}
          />
          <ToolBtn
            label="Circle"
            active={tool === "circH"}
            onClick={() => setTool("circH")}
          />
          <ToolBtn
            label="Circle Fill"
            active={tool === "circF"}
            onClick={() => setTool("circF")}
          />
          <ToolBtn
            label="X"
            active={tool === "x"}
            onClick={() => setTool("x")}
          />
          <ToolBtn
            label="Text"
            active={tool === "text"}
            onClick={() => setTool("text")}
          />

          <div style={{ width: 12 }} />

          <label style={{ fontSize: 12, opacity: 0.85 }}>
            Color{" "}
            <input
              type="color"
              value={stroke}
              onChange={(e) => setStroke(e.target.value)}
              style={{ verticalAlign: "middle" }}
            />
          </label>
        </div>

        {/* image + overlay */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            flex: 1,
            background: "#0b0b0b",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ padding: 16 }}>Loading...</div>
          ) : !imgUrl ? (
            <div style={{ padding: 16 }}>No image</div>
          ) : (
            <>
              <img
                ref={imgRef}
                src={imgUrl}
                alt="photo"
                onLoad={() => recomputeLayout()}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
                draggable={false}
              />

              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                  position: "absolute",
                  inset: 0,
                  touchAction: "none",
                  cursor: "crosshair",
                }}
              />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ToolBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 10px",
        borderRadius: 10,
        background: active ? "rgba(255,255,255,0.18)" : "transparent",
        border: "1px solid rgba(255,255,255,0.25)",
        color: "white",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}
