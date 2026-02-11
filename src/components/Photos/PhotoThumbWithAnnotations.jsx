// src/components/Photos/PhotoThumbWithAnnotations.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { computeContainRect } from "../../utils/computeContainRect";

function normItems(annotationsOrItems) {
  const entry = annotationsOrItems;
  const items = Array.isArray(entry?.items)
    ? entry.items
    : Array.isArray(entry)
      ? entry
      : [];
  return items;
}

export default function PhotoThumbWithAnnotations({
  src,
  alt,
  annotations,
  style,
}) {
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });

  const items = useMemo(() => normItems(annotations), [annotations]);

  // Observe box size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function measure() {
      setBox({ w: el.clientWidth || 0, h: el.clientHeight || 0 });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Load natural image size (from src blob/object-url)
  useEffect(() => {
    if (!src) {
      setNat({ w: 0, h: 0 });
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setNat({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
    };
    img.onerror = () => {
      if (cancelled) return;
      setNat({ w: 0, h: 0 });
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  const r = useMemo(() => {
    return computeContainRect(box.w, box.h, nat.w, nat.h);
  }, [box.w, box.h, nat.w, nat.h]);

  const showOverlay = Boolean(
    src && items.length && r.width > 0 && r.height > 0,
  );

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || "photo"}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            userSelect: "none",
            pointerEvents: "none",
            background: "#111",
          }}
          draggable={false}
        />
      ) : null}

      {showOverlay ? (
        <svg
          width={r.width}
          height={r.height}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: r.left,
            top: r.top,
            pointerEvents: "none",
          }}
        >
          {items.map((it, idx) => {
            const type = it?.type || it?.kind;
            const p1 = it?.p1 || it?.a || { x: 0, y: 0 };
            const p2 = it?.p2 || it?.b || { x: 0, y: 0 };
            const stroke = it?.stroke || "#00ff66";
            const fill = it?.fill || "transparent";
            const sw = Number(it?.strokeWidth || 3);
            const opacity = typeof it?.opacity === "number" ? it.opacity : 1;

            if (type === "line") {
              return (
                <line
                  key={it?.id || idx}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={stroke}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                  opacity={opacity}
                />
              );
            }

            if (type === "x") {
              return (
                <g key={it?.id || idx} opacity={opacity}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={stroke}
                    strokeWidth={sw}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={p1.x}
                    y1={p2.y}
                    x2={p2.x}
                    y2={p1.y}
                    stroke={stroke}
                    strokeWidth={sw}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            }

            if (type === "rect") {
              const x = Math.min(p1.x, p2.x);
              const y = Math.min(p1.y, p2.y);
              const w = Math.abs(p2.x - p1.x);
              const h = Math.abs(p2.y - p1.y);

              return (
                <rect
                  key={it?.id || idx}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                  opacity={opacity}
                />
              );
            }

            if (type === "circle") {
              const cx = (p1.x + p2.x) / 2;
              const cy = (p1.y + p2.y) / 2;
              const rx = Math.abs(p2.x - p1.x) / 2;
              const ry = Math.abs(p2.y - p1.y) / 2;

              return (
                <ellipse
                  key={it?.id || idx}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                  opacity={opacity}
                />
              );
            }

            if (type === "text") {
              const txt = (it?.text || "").toString();
              if (!txt) return null;
              const fs = Number(it?.fontSize || 20);

              return (
                <text
                  key={it?.id || idx}
                  x={p1.x}
                  y={p1.y}
                  fill={stroke}
                  opacity={opacity}
                  style={{ fontSize: `${fs}px` }}
                >
                  {txt}
                </text>
              );
            }

            return null;
          })}
        </svg>
      ) : null}
    </div>
  );
}
