import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Line,
  Circle,
  G,
  Rect,
} from "@react-pdf/renderer";
import { useMemo, useEffect } from "react";
// ---------- tiny helpers ----------

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(url, jwt) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

function normBase(base) {
  if (!base) return "";
  return base.endsWith("/") ? base : `${base}/`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const t = (v) => (v == null ? "" : String(v)); // safe text for <Text>

// Build legend entries with { label, color } from lines.
// label = product name; color = product/color actually used to draw.
// Build legend entries with { label, color, shape } from lines.
// label = product name (prettified for gutters/DS); color = product/color actually used.
// shape = "circle" for Splash Guard, "square" otherwise (for legend rendering).
function legendEntriesFromLines(selectedDiagram, products = []) {
  const uniq = new Map(); // key by label
  const lines = selectedDiagram?.lines || [];

  for (const l of lines) {
    if (!l || l.isNote) continue;

    // Splash Guard (priced mark, rendered as a filled circle)
    if (l.isSplashGuard) {
      const label =
        (l.currentProduct?.name && String(l.currentProduct.name)) ||
        "Splash Guard";
      const col = normalizeColor(
        l.color ||
          l.currentProduct?.color ||
          l.currentProduct?.colorCode ||
          // fallback: try to find the Splash Guard product by name
          ((Array.isArray(products) ? products : []).find((p) =>
            /splash\s*guard/i.test(String(p?.name || ""))
          ) &&
            productColor(
              (products || []).find((p) =>
                /splash\s*guard/i.test(String(p?.name || ""))
              )
            )) ||
          "#111"
      );

      if (!uniq.has(label))
        uniq.set(label, { label, color: col, shape: "circle" });
      continue;
    }

    // Downspout
    if (l.isDownspout) {
      const rawLabel =
        (l.currentProduct?.name && String(l.currentProduct.name)) ||
        `${prettyDs(l.downspoutSize)} Downspout`;
      const label = prettifyLineItemName(rawLabel);
      const color = resolveDiagramLineColor(products, l);

      if (!uniq.has(label)) uniq.set(label, { label, color, shape: "square" });
      continue;
    }

    // Gutter run
    if (l.currentProduct) {
      console.log(l);
      const raw = String(l.currentProduct.name);
      const label = prettyGutter(raw);
      const fallbackColor =
        l.currentProduct?.colorCode ||
        l.currentProduct?.visual ||
        l.currentProduct?.color ||
        l.color;

      const color = resolveDiagramLineColor(products, l);

      if (!uniq.has(label)) uniq.set(label, { label, color, shape: "square" });
    }
  }

  // strings only for label/color to keep React-PDF happy
  return Array.from(uniq.values()).map((e) => ({
    label: String(e.label || ""),
    color: normalizeColor(e.color || "#000"),
    shape: e.shape === "circle" ? "circle" : "square",
  }));
}

function resolveDiagramLineColor(products = [], l) {
  if (!l || l.isNote) return "#000";

  // Splash Guard
  if (l.isSplashGuard) {
    // If line has a product id/name, try that first
    const hit = findCatalogProductForLine(products, l);
    if (hit) return productColor(hit);

    // Fallback: search catalog by "splash guard" name
    const sg = (Array.isArray(products) ? products : []).find((p) =>
      /splash\s*guard/i.test(String(p?.name || ""))
    );
    return normalizeColor(sg ? productColor(sg) : l.color || "#000");
  }

  // Downspouts
  if (l.isDownspout) {
    // ID-first if available
    const hit = findCatalogProductForLine(products, l);
    if (hit) return productColor(hit);

    // fallback to your existing tokenizer matcher
    return normalizeColor(findDownspoutProductColor(products, l));
  }

  // Gutters / priced lines
  if (l.currentProduct?.name || l.currentProduct?._id || l.productId) {
    // ID-first
    const hit = findCatalogProductForLine(products, l);
    if (hit) return productColor(hit);

    // fallback: use your existing name-based matcher
    const raw = String(l.currentProduct?.name || "");
    const fallbackColor =
      l.currentProduct?.colorCode ||
      l.currentProduct?.visual ||
      l.currentProduct?.color ||
      l.gutterColor ||
      l.color ||
      "#000";

    return normalizeColor(findGutterProductColor(products, raw, fallbackColor));
  }

  // Free marks / anything else uses stored color
  return normalizeColor(l.color || "#000");
}

function normalizeColor(c) {
  if (!c) return "#000";
  if (typeof c === "object") {
    if (c && typeof c.color !== "undefined") return normalizeColor(c.color);
    return "#000";
  }
  const s = String(c).trim();

  // hex
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;

  // rgb/rgba(...)
  const m = s.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const toHex = (n) =>
      Math.max(0, Math.min(255, parseInt(n, 10)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  }
  return s; // named or other supported strings
}

function getVisualColor(p) {
  return normalizeColor(
    p?.visual ?? p?.colorCode ?? p?.color ?? p?.defaultColor ?? "#000"
  );
}

const fmt = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n || 0));

function prettifyLineItemName(raw) {
  if (!raw) return "";
  let name = String(raw);

  name = name.replace(/\b(corrugated|smooth|box|round)\b\s+\1\b/gi, "$1");
  name = name.replace(/\b(corrugated|smooth|box|round)\b/gi, (m) => {
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  });
  name = name.replace(/(\d+)\s*[xX]\s*(\d+)/g, (_, a, b) => `${a}x${b}`);
  name = name.replace(/(\b\d+)"\s+\1"\b/g, `$1"`);
  name = name.replace(/\s{2,}/g, " ").trim();
  return name;
}

// Normalize DS label to '3" Round' or '3x4 Corrugated'
// Normalize DS label to '3" Round' or '3x4 Corrugated'
// and never duplicate the style token.
const STYLE_RX = /(corrugated|smooth|box|round)/i;

function prettyDs(raw = "") {
  const s = String(raw || "").trim();

  // detect common shapes
  const mCorr = s.match(/(\d+\s*x\s*\d+)\s*(corrugated)?/i); // 2x3 / 3x4
  const mRound = s.match(/(\d+)\s*"?\s*(?:inch|")\s*(round)?/i); // 3" Round

  let label;
  if (mCorr) {
    const size = mCorr[1].replace(/\s*/g, "");
    label = `${size} Corrugated`;
  } else if (mRound) {
    const inches = mRound[1];
    label = `${inches}" Round`;
  } else {
    // fallback to the given string
    label = s;
  }

  // 1) collapse duplicated style tokens like "corrugated corrugated"
  label = label.replace(
    /\b(corrugated|smooth|box|round)\b\s+\1\b/gi,
    (_, w) => w
  );

  // 2) Title-case the single style word
  label = label.replace(
    STYLE_RX,
    (m) => m[0].toUpperCase() + m.slice(1).toLowerCase()
  );

  return label.replace(/\s{2,}/g, " ").trim();
}

function productColor(p) {
  return getVisualColor(p);
}

function findCatalogProductForLine(products = [], line) {
  const list = Array.isArray(products) ? products : [];

  // 1) ID match (most reliable)
  const lineProdId =
    line?.currentProduct?._id ||
    line?.currentProduct?.id ||
    line?.productId ||
    line?.currentProductId;

  if (lineProdId) {
    const hitById = list.find(
      (p) => String(p?._id || p?.id) === String(lineProdId)
    );
    if (hitById) return hitById;
  }

  // 2) Exact name match (case-insensitive)
  const rawName =
    line?.currentProduct?.name || line?.productName || line?.name || "";
  const name = String(rawName).trim().toLowerCase();

  if (name) {
    const hitExact = list.find(
      (p) =>
        String(p?.name || "")
          .trim()
          .toLowerCase() === name
    );
    if (hitExact) return hitExact;

    // 3) Loose "includes" match as a last resort (guarded)
    if (name.length > 3) {
      const hitLoose = list.find((p) => {
        const pn = String(p?.name || "")
          .trim()
          .toLowerCase();
        return pn && pn.includes(name);
      });
      if (hitLoose) return hitLoose;
    }
  }

  return null;
}

function parseDownspoutTokens(line) {
  const rawSize = String(line.downspoutSize || "").trim();
  const rawName = String(line.currentProduct?.name || "");
  let sizeKey = (
    rawSize.match(/(\d+)\s*[xX]\s*(\d+)/) ||
    rawName.match(/(\d+)\s*[xX]\s*(\d+)/)
  )?.slice(1, 3);
  if (sizeKey) sizeKey = `${sizeKey[0]}x${sizeKey[1]}`;
  if (!sizeKey) {
    const m = rawSize.match(/(\d+)\s*"?/) || rawName.match(/(\d+)\s*"?/);
    if (m) sizeKey = `${m[1]}"`;
  }
  const pname = `${line.profile || ""} ${rawName}`.toLowerCase();
  let profileKey = "corrugated";
  if (pname.includes("round")) profileKey = "round";
  else if (pname.includes("smooth")) profileKey = "smooth";
  else if (pname.includes("box")) profileKey = "box";
  return { sizeKey: sizeKey || "unknown", profileKey };
}

function findDownspoutProductColor(products = [], line) {
  const { sizeKey, profileKey } = parseDownspoutTokens(line);
  const list = Array.isArray(products) ? products : [];
  const hit =
    list.find((p) => {
      const n = String(p.name || "").toLowerCase();
      const isDs =
        (p.type || "").toLowerCase() === "downspout" || n.includes("downspout");
      if (!isDs) return false;

      const s = n;
      const hasSize = /^\d+x\d+$/i.test(sizeKey)
        ? new RegExp(`\\b${sizeKey.replace("x", "\\s*[xX]\\s*")}\\b`, "i").test(
            n
          )
        : sizeKey.endsWith(`"`)
        ? s.includes(`${sizeKey}`)
        : true;

      const profOk =
        profileKey === "round"
          ? /round/.test(n)
          : profileKey === "smooth"
          ? /smooth/.test(n)
          : profileKey === "box"
          ? /box/.test(n)
          : /corrug/.test(n);

      return hasSize && profOk;
    }) ||
    list.find((p) => {
      const n = String(p.name || "").toLowerCase();
      const isDs =
        (p.type || "").toLowerCase() === "downspout" || n.includes("downspout");
      return isDs;
    });

  return hit ? productColor(hit) : "#000";
}

function findGutterProductColor(products = [], name, fallbackColor) {
  const list = Array.isArray(products) ? products : [];
  const n0 = String(name || "").toLowerCase();
  const hit =
    list.find((p) => String(p.name || "").toLowerCase() === n0) ||
    list.find((p) => {
      const n = String(p.name || "").toLowerCase();
      return n && n0 && n0.length > 3 && n.includes(n0);
    });
  return hit ? productColor(hit) : normalizeColor(fallbackColor || "#000");
}

function prettyGutter(raw = "") {
  const s = String(raw).trim();
  if (!s) return "Gutter";
  const m = s.match(/(\d+)\s*"/);
  const size = m ? `${m[1]}"` : null;
  const PROFILE_ALIASES = [
    [/k[-\s]?style/i, "K-Style"],
    [/half[-\s]?round/i, "Half Round"],
    [/straight[-\s]?face|straightface/i, "Straight Face"],
    [/box/i, "Box"],
    [/round(?!.*half)/i, "Round"],
    [/custom/i, "Custom"],
  ];
  if (size) {
    for (const [rx, label] of PROFILE_ALIASES) {
      if (rx.test(s)) return `${size} ${label}`;
    }
  }
  return s;
}

// Small swatch for legend/key: circle for Splash Guard, square otherwise
const KeySwatch = ({ color = "#111", size = 10, shape = "square" }) => {
  if (shape === "circle") {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          marginRight: 6,
          borderWidth: 1,
          borderColor: "#333",
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        marginRight: 6,
        borderWidth: 1,
        borderColor: "#333",
      }}
    />
  );
};

// ---------- styles (React-PDF friendly; no CSS shorthands) ----------
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    alignItems: "flex-start",
  },
  logo: { width: 80, height: 80, objectFit: "contain" },
  rightMeta: { alignItems: "flex-end" },

  amountPillRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  amountPill: {
    backgroundColor: "#e5e5e5",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 3,
  },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, marginBottom: 6, fontWeight: "bold" },
  billTo: { flex: 1, marginRight: 20 },
  jobSite: { marginLeft: "auto" },

  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  th: { fontSize: 10, fontWeight: "bold" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e6e6",
  },
  cell: { fontSize: 10 },

  amountDueWrap: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  amountBox: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 10,
    width: 220,
  },
  amountText: { fontSize: 12, fontWeight: "bold", textAlign: "right" },

  keySection: { marginTop: 20 },
  keyRow: { flexDirection: "row", flexWrap: "wrap" },
  keyItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
    marginBottom: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#333",
  },

  photo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },

  bigDiagramWrap: { marginTop: 10, alignItems: "center" },

  // Border lives on a View wrapper; the <Svg> itself will be sized numerically
  bigDiagramFrame: {
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  page2Notes: { marginTop: 10, fontSize: 10 },
  photoPageTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  photoGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  photoCell: {
    width: "48%",
    marginBottom: 12,
  },
  photoImage: {
    width: "100%",
    height: "100%", // big enough for clients
    objectFit: "contain",
    borderRadius: 6,
  },
  photoCaption: {
    fontSize: 10,
    marginTop: 4,
    color: "#444",
  },
});

// ---------- vector diagram (crisp) ----------
// ---------- vector diagram (crisp + fit-to-box) ----------
function DiagramGraphic({
  selectedDiagram,
  products = [],
  maxWidth,
  maxHeight,
}) {
  try {
    const dev =
      typeof import.meta !== "undefined" &&
      import.meta?.env &&
      import.meta.env.DEV;

    const lines = Array.isArray(selectedDiagram?.lines)
      ? selectedDiagram.lines
      : null;
    const svgStr = selectedDiagram?.svg || null;
    let meta = selectedDiagram?.meta || null;

    // DEV visibility
    if (dev) {
      console.info(
        `[PDF] DiagramGraphic: lines=${lines?.length || 0}, meta=${
          meta ? "yes" : "no"
        }, rawSVG=${svgStr ? "yes" : "no"}, max=${maxWidth}x${maxHeight}`
      );
    }

    // --- VECTOR PATH ---
    if (lines && lines.length > 0) {
      // Derive bounds if meta missing
      // Derive bounds if meta missing (MUST include notes + ds boxes or they'll get clipped)
      if (!meta) {
        // Derive bounds if meta missing (MUST include notes + ds boxes or they'll get clipped)
        // ALSO: if meta exists, expand it to include notes + elbow-sequence boxes.
        // --- helpers ---
        const pushPt = (bounds, x, y) => {
          x = Number(x);
          y = Number(y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          if (x < bounds.minX) bounds.minX = x;
          if (y < bounds.minY) bounds.minY = y;
          if (x > bounds.maxX) bounds.maxX = x;
          if (y > bounds.maxY) bounds.maxY = y;
        };

        const pushRect = (bounds, x, y, w, h) => {
          x = Number(x);
          y = Number(y);
          w = Number(w);
          h = Number(h);
          if (![x, y, w, h].every(Number.isFinite)) return;
          pushPt(bounds, x, y);
          pushPt(bounds, x + w, y);
          pushPt(bounds, x, y + h);
          pushPt(bounds, x + w, y + h);
        };

        // 1) Start from existing meta bounds if present, else empty bounds.
        const b = meta
          ? {
              minX: Number(meta.offsetX || 0),
              minY: Number(meta.offsetY || 0),
              maxX: Number(meta.offsetX || 0) + Number(meta.canvasW || 0),
              maxY: Number(meta.offsetY || 0) + Number(meta.canvasH || 0),
            }
          : {
              minX: Infinity,
              minY: Infinity,
              maxX: -Infinity,
              maxY: -Infinity,
            };

        // 2) Expand bounds with ALL geometry (endpoints + notes + elbow boxes)
        for (const l of lines) {
          if (!l) continue;

          const xA = Math.round(Number(l.startX || 0));
          const yA = Math.round(Number(l.startY || 0));
          const xB = Math.round(Number((l.endX ?? l.startX) || 0));
          const yB = Math.round(Number((l.endY ?? l.startY) || 0));

          // Always include endpoints
          pushPt(b, xA, yA);
          pushPt(b, xB, yB);

          // Notes / annotations: include rough text extents
          if (l.isNote && (l.note || l.text)) {
            const text = String(l.note || l.text || "");
            const fs = Number(l.fontSize || 14);

            // width ~ 0.6em per char, height ~ 1.2em (crude but effective)
            const w = Math.max(10, text.length * fs * 0.6);
            const h = Math.max(10, fs * 1.2);

            // your PDF note render uses y + fs baseline; include a generous box
            pushRect(b, xA, yA - h, w, h * 2);
          }

          // Downspout elbow-sequence box: include its derived rect in ABSOLUTE coords
          if (l.isDownspout) {
            const seq = String(l.elbowSequence || "").trim();
            if (!seq) continue;

            const ang = Number(l.elbowBoxAngle || 0);
            const r = Number(l.elbowBoxRadius || 0);

            const fontSize = 12;
            const padX = Math.max(4, fontSize * 0.35);
            const padY = Math.max(2, fontSize * 0.25);
            const textW = Math.max(1, seq.length * fontSize * 0.62);
            const boxW = Math.ceil(textW + padX * 2);
            const boxH = Math.ceil(fontSize + padY * 2);

            // center point (absolute coords)
            const cx = xA + Math.cos(ang) * r;
            const cy = yA + Math.sin(ang) * r;

            // We use the unrotated rect for bounds (rotation doesn't change needed extent much).
            const boxX = cx - boxW / 2;
            const boxY = cy - boxH / 2;

            pushRect(b, boxX, boxY, boxW, boxH);
          }
        }

        // 3) Apply padding + normalize meta
        const pad = 48;
        const minX = Number.isFinite(b.minX) ? b.minX : 0;
        const minY = Number.isFinite(b.minY) ? b.minY : 0;
        const maxX = Number.isFinite(b.maxX) ? b.maxX : 1;
        const maxY = Number.isFinite(b.maxY) ? b.maxY : 1;

        const W = Math.max(1, Math.round(maxX - minX + pad * 2));
        const H = Math.max(1, Math.round(maxY - minY + pad * 2));

        meta = {
          canvasW: W,
          canvasH: H,
          offsetX: Math.round(minX - pad),
          offsetY: Math.round(minY - pad),
          // preserve any existing meta fields you rely on
          ...(meta || {}),
        };
      }

      const W = Number(meta.canvasW || 0) || 1;
      const H = Number(meta.canvasH || 0) || 1;
      const grid = Number(meta.gridSize || 8) || 8;
      const offX = Number(meta.offsetX || 0);
      const offY = Number(meta.offsetY || 0);

      // Fit-to-box sizing (prevents React-PDF from doing a second rescale -> blur)
      const boxW = Math.max(1, Number(maxWidth || 1));
      const boxH = Math.max(1, Number(maxHeight || 1));
      const scale = Math.min(boxW / W, boxH / H);
      const outW = Math.max(1, Math.floor(W * scale));
      const outH = Math.max(1, Math.floor(H * scale));

      if (dev) {
        console.info(
          `[PDF] VECTOR fit: canvas=${W}x${H} box=${boxW}x${boxH} -> out=${outW}x${outH} scale=${scale.toFixed(
            4
          )}`
        );
      }

      return (
        <Svg
          width={outW}
          height={outH}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {lines.map((l, i) => {
            const round = (n) => Math.round(Number(n || 0));

            // translate from "absolute canvas coords" -> "cropped viewBox coords"
            const x1 = round(l.startX) - offX;
            const y1 = round(l.startY) - offY;
            const x2 = round(l.endX ?? l.startX) - offX;
            const y2 = round(l.endY ?? l.startY) - offY;

            const color = resolveDiagramLineColor(products, l);

            const base = l.isDownspout ? 2 : 3;
            let sw = Math.max(1, Math.round(Number(l.lineWidth || base)));

            // ✅ Splash Guards are rendered as a "dot" via a zero-length Line with round caps.
            // Make them ~20% bigger by increasing strokeWidth.
            if (l.isSplashGuard) {
              sw = Math.max(1, Math.round(sw * 2));
            }

            // ---------- 1) NOTES / ANNOTATIONS ----------
            // Your Diagram.jsx stores notes as { isNote: true, note, startX, startY, fontSize, color }
            if (l.isNote && (l.note || l.text)) {
              const text = String(l.note || l.text || "");
              const fs = Number(l.fontSize || 10);

              // NOTE: SVG text baseline differs; push down slightly so it matches canvas feel
              return (
                <Text
                  key={`note-${i}`}
                  x={x1}
                  y={y1 + fs}
                  fontSize={fs}
                  fill={color}
                >
                  {text}
                </Text>
              );
            }

            // ---------- FREE MARKS (square/circle) — match canvas behavior ----------
            // NOTE: do NOT include priced Splash Guard here; keep its current dot behavior.
            if (l.isFreeMark && !l.isSplashGuard) {
              const stroke = color;
              const strokeWidth = Math.max(1, Number(l.strokeWidth ?? sw));
              const dashed = !!l.dashed;

              // React-PDF SVG expects strokeDasharray as a string like "6 4"
              const dashLen = Math.max(2, strokeWidth * 3);
              const dashGap = Math.max(2, strokeWidth * 2);
              const dashProps = dashed
                ? { strokeDasharray: `${dashLen} ${dashGap}` }
                : {};

              // ---- Square ----
              if (l.kind === "free-square") {
                const left =
                  Math.min(Number(l.startX || 0), Number(l.endX || 0)) - offX;
                const top =
                  Math.min(Number(l.startY || 0), Number(l.endY || 0)) - offY;
                const w = Math.abs(Number(l.endX || 0) - Number(l.startX || 0));
                const h = Math.abs(Number(l.endY || 0) - Number(l.startY || 0));

                // filled vs hollow
                const fill = l.fill ? stroke : "none";

                return (
                  <Rect
                    key={`fm-sq-${i}`}
                    x={Math.round(left)}
                    y={Math.round(top)}
                    width={Math.round(w)}
                    height={Math.round(h)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    {...dashProps}
                  />
                );
              }

              // ---- Circle ----
              if (l.kind === "free-circle") {
                const cx = Math.round(
                  Number(l.centerX ?? l.startX ?? 0) - offX
                );
                const cy = Math.round(
                  Number(l.centerY ?? l.startY ?? 0) - offY
                );

                // radius is stored on the object (you set defaults in Diagram.jsx)
                const r = Math.max(1, Number(l.radius ?? grid * 0.8));

                const fill = l.fill ? stroke : "none";

                return (
                  <Circle
                    key={`fm-ci-${i}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    {...dashProps}
                  />
                );
              }

              // free-line stays handled by the normal line renderer (with your dash fix)
            }

            // ---------- 2) DOWNSPOUT BOX + TEXT (and still draw the X marker) ----------
            // Supports TWO shapes of data:
            // A) legacy explicit box coords: boxX/boxY/boxW/boxH (+ boxText etc)
            // B) elbow box: elbowSequence + elbowBoxAngle (radians) + elbowBoxRadius (px)
            if (l.isDownspout) {
              const color = resolveDiagramLineColor(products, l);

              // X marker size
              const d = grid / 2.75;

              // TEXT: elbow sequence ONLY
              const seq = String(l.elbowSequence || "").trim();
              if (!seq) {
                // still draw the X even if no sequence
                return (
                  <>
                    <Line
                      key={`dsx-a-${i}`}
                      x1={x1 - d}
                      y1={y1 - d}
                      x2={x1 + d}
                      y2={y1 + d}
                      stroke={color}
                      strokeWidth={2}
                    />
                    <Line
                      key={`dsx-b-${i}`}
                      x1={x1 + d}
                      y1={y1 - d}
                      x2={x1 - d}
                      y2={y1 + d}
                      stroke={color}
                      strokeWidth={2}
                    />
                  </>
                );
              }

              // Angle + radius from your object (radians)
              const ang = Number(l.elbowBoxAngle || 0);
              const deg = (ang * 180) / Math.PI;
              const r = Number(l.elbowBoxRadius || 0);

              // Auto-size box to JUST fit the text
              const fontSize = 12;
              const padX = Math.max(4, fontSize * 0.35);
              const padY = Math.max(2, fontSize * 0.25);

              // crude text width approximation (works well enough in PDFs)
              const textW = Math.max(1, seq.length * fontSize * 0.62);
              const boxW = Math.ceil(textW + padX * 2);
              const boxH = Math.ceil(fontSize + padY * 2);

              // Box center is offset from the downspout anchor by radius at angle
              const cx = x1 + Math.cos(ang) * r;
              const cy = y1 + Math.sin(ang) * r;

              const boxX = cx - boxW / 2;
              const boxY = cy - boxH / 2;

              const fill = "#e6e6e6";
              const stroke = color;
              const textColor = "#000";

              return (
                <G key={`ds-${i}`}>
                  {/* X marker */}
                  <Line
                    key={`dsx-a-${i}`}
                    x1={x1 - d}
                    y1={y1 - d}
                    x2={x1 + d}
                    y2={y1 + d}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <Line
                    key={`dsx-b-${i}`}
                    x1={x1 + d}
                    y1={y1 - d}
                    x2={x1 - d}
                    y2={y1 + d}
                    stroke={color}
                    strokeWidth={2}
                  />

                  {/* Rotated elbow sequence box */}
                  <Rect
                    key={`dsbox-${i}`}
                    x={boxX}
                    y={boxY}
                    width={boxW}
                    height={boxH}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1}
                    rx={2}
                    ry={2}
                  />
                  <Text
                    key={`dsboxtext-${i}`}
                    x={cx}
                    y={cy + fontSize * 0.35}
                    fontSize={fontSize}
                    fill={textColor}
                    textAnchor="middle"
                  >
                    {seq}
                  </Text>
                </G>
              );
            }

            // ---------- 3) NORMAL LINE ----------
            // ---------- 3) NORMAL LINE (including FreeMark dashed rendering) ----------
            console.log(l);
            const isFreeLine =
              !!l.isFreeMark &&
              (l.kind === "free-line" || l.freeType === "line");

            const isDashed = !!(l.dashed ?? l.isDashed); // support both shapes
            const dash = Math.max(2, sw * 2);

            const lineEl = (
              <Line
                key={`ln-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeLinejoin="round"
                // only apply dashes to the free-line tool (so gutters stay untouched)
                {...(isFreeLine && isDashed
                  ? { strokeDasharray: `${dash},${dash}` }
                  : {})}
              />
            );
            // ---------- 4) MEASUREMENT LABELS ----------
            // Your Diagram.jsx stores measurement on the line (often: measurement or runFeet/totalFeet)
            // and orientation info (often: isHorizontal/isVertical + position).
            const rawMeasure =
              l.measurement != null
                ? l.measurement
                : l.runFeet != null
                ? l.runFeet
                : l.totalFeet != null
                ? l.totalFeet
                : null;

            // only label real measured segments (gutters & DS runs), skip misc marks
            const showMeasure =
              rawMeasure != null &&
              !Number.isNaN(Number(rawMeasure)) &&
              Number(rawMeasure) > 0 &&
              !l.isFreeMark;

            if (!showMeasure) return lineEl;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            const isH =
              l.isHorizontal != null
                ? !!l.isHorizontal
                : Math.abs(y2 - y1) < Math.abs(x2 - x1);
            const isV =
              l.isVertical != null
                ? !!l.isVertical
                : Math.abs(x2 - x1) < Math.abs(y2 - y1);

            // mimic your canvas offsets: labels sit just outside the line
            const pos = String(l.position || "").toLowerCase(); // "top" | "bottom" | "left" | "right"
            const pad = Math.max(10, grid * 0.9);

            let lx = midX;
            let ly = midY;

            if (isH) {
              ly = pos === "bottom" ? midY + pad : midY - pad;
            } else if (isV) {
              lx = pos === "right" ? midX + pad : midX - pad;
            } else {
              // diagonal: lift slightly
              ly = midY - pad;
            }

            const measureText = `${Math.round(Number(rawMeasure))}'`;
            const fs = 10;

            // background pill (helps readability and makes it “match” canvas)
            const bgW = Math.max(34, measureText.length * 6.2);
            const bgH = 14;

            return (
              <>
                {lineEl}
                {/* <Rect
                  key={`m-bg-${i}`}
                  x={lx - bgW / 2}
                  y={ly - bgH + 2}
                  width={bgW}
                  height={bgH}
                  fill="#ffffff"
                  stroke="#000000"
                  strokeWidth={0.5}
                  rx={2}
                  ry={2}
                /> */}
                <Text
                  key={`m-t-${i}`}
                  x={lx}
                  y={ly}
                  fontSize={fs}
                  fill="#000"
                  textAnchor="middle"
                >
                  {measureText}
                </Text>
              </>
            );
          })}
        </Svg>
      );
    }

    // --- RASTER FALLBACK (only if no lines, but you have raw SVG) ---
    if (svgStr) {
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
      return <Image src={dataUrl} />;
    }
  } catch (e) {
    // fall through
  }

  return null;
}

// ---------- main ----------
export default function EstimatePDF({
  estimate,
  selectedDiagram,
  currentUser,
  logoUrl,
  estimateData,
  project,
  products,
  showPrices = true,
  extraItems = [],
  items = [],
  apiBaseUrl,
  includedPhotoDataUrls: includedPhotoDataUrlsProp = [],
  jwt,
}) {
  // ✅ Works in Vite, still supports older env style as fallback
  const resolvedApiBaseUrl =
    apiBaseUrl ||
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_API_URL
      : "") ||
    (typeof process !== "undefined" && process.env
      ? process.env.REACT_APP_API_URL
      : "") ||
    "";

  const apiBase = resolvedApiBaseUrl.endsWith("/")
    ? resolvedApiBaseUrl
    : `${resolvedApiBaseUrl}/`;
  const lines = selectedDiagram?.lines || [];
  const baseRows = [];

  const gutterColorByLabel = new Map();
  const dsColorByLabel = new Map();

  lines.forEach((l) => {
    if (l.isDownspout) {
      const label = `${prettyDs(l.downspoutSize)} Downspout`;
      baseRows.push({
        name: label,
        quantity: Number(l.measurement || 0),
        unitPrice: Number(l.price || 0),
        meta: { kind: "downspout" },
      });

      if (!dsColorByLabel.has(label)) {
        const col = resolveDiagramLineColor(products, l);

        dsColorByLabel.set(label, col);
      }
    } else if (l.currentProduct) {
      const name = String(l.currentProduct.name || "Gutter");
      const qty = Math.ceil(Number(l.measurement || 0));
      const unit = Number(l.currentProduct.price || 0);
      baseRows.push({
        name,
        quantity: qty,
        unitPrice: unit,
        meta: { kind: "gutter" },
      });

      const gLabel = prettyGutter(name);
      if (!gutterColorByLabel.has(gLabel)) {
        const col = normalizeColor(
          l.color ||
            findGutterProductColor(
              products,
              name,
              l.currentProduct?.colorCode ||
                l.currentProduct?.visual ||
                l.currentProduct?.color
            )
        );
        gutterColorByLabel.set(gLabel, col);
      }
    }
  });

  // accessories (kept as-is, if present)
  const accessoryItems =
    selectedDiagram?.accessories?.items ||
    selectedDiagram?.accessoryItems ||
    [];

  const hasDiagram = !!selectedDiagram;
  const presetRows =
    !hasDiagram && Array.isArray(items) && items.length
      ? items.map((it) => ({
          name: it.name,
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),
        }))
      : null;

  // Quantities must ALWAYS be whole numbers in the PDF.
  const qInt = (q) => {
    const n = Number(q || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n); // change to Math.ceil if you prefer "always round up"
  };

  // final rows for the items table (we respect what caller passes in)
  const rowsRaw =
    Array.isArray(items) && items.length
      ? items
      : Array.isArray(extraItems) && extraItems.length
      ? extraItems
      : [];

  // Normalize quantities to whole numbers (display + math)
  const rows = (rowsRaw || []).map((r) => ({
    ...r,
    quantity: qInt(r.quantity),
  }));

  const total = rows.reduce(
    (sum, r) => sum + Number(r.price || 0) * Number(r.quantity || 0),
    0
  );

  const diagramImage =
    selectedDiagram?.imageDataLarge || selectedDiagram?.imageData || null;

  useEffect(() => {}, [selectedDiagram]);
  const itemHeaderWidth = showPrices ? "70%" : "85%";
  const qtyHeaderWidth = showPrices ? "10%" : "15%";
  const amtHeaderWidth = "20%";

  const paymentDueText = estimateData?.paymentDue || "Upon completion.";

  const billToName = t(project?.billingName);
  const billToAddress = t(project?.billingAddress);
  const billToPhone = t(project?.billingPrimaryPhone);

  const jobName = t(
    project?.projectName || estimate?.projectSnapshot?.name || project?.name
  );
  const jobAddress = t(
    project?.projectAddress ||
      estimate?.projectSnapshot?.address ||
      project?.address
  );

  // Photo data-urls must be prepared in the browser. When this component is rendered
  // via `pdf(<EstimatePDF />).toBlob()`, the React-PDF renderer does NOT have DOM APIs
  // like FileReader/localStorage, so we accept pre-fetched data URLs from the caller.
  // ✅ Build photo sources for <Image> using uri + headers (no base64, no FileReader)
  // src/components/EstimatePDF/EstimatePDF.jsx

  const includedPhotoSources = useMemo(() => {
    const ids = Array.isArray(selectedDiagram?.includedPhotoIds)
      ? selectedDiagram.includedPhotoIds
      : [];

    if (!ids.length) return [];

    // ✅ Prefer data URLs if the caller provided them (most reliable for mobile blob renders)
    // Supports:
    //  - array aligned with includedPhotoIds (same order/length)
    //  - object map keyed by photoId -> dataUrl
    const dataUrls = includedPhotoDataUrlsProp;
    if (Array.isArray(dataUrls) && dataUrls.length === ids.length) {
      const allOk = dataUrls.every(
        (u) => typeof u === "string" && u.startsWith("data:")
      );
      if (allOk) return dataUrls.map((u) => ({ uri: u }));
    } else if (
      dataUrls &&
      typeof dataUrls === "object" &&
      !Array.isArray(dataUrls)
    ) {
      const mapped = ids
        .map((pid) => dataUrls[pid])
        .filter((u) => typeof u === "string" && u.startsWith("data:"));
      if (mapped.length === ids.length) return mapped.map((u) => ({ uri: u }));
    }

    const projectId = project?._id || project?.id;
    if (!projectId) return [];

    const token =
      jwt ||
      (typeof window !== "undefined"
        ? localStorage.getItem("jwt") || localStorage.jwt || ""
        : "");

    if (!token) return [];

    return ids.map((pid) => ({
      uri: `${apiBase}dashboard/projects/${projectId}/photos/${pid}/image?variant=preview`,
      headers: { Authorization: `Bearer ${token}` },
    }));
  }, [
    apiBase,
    jwt,
    project?._id,
    project?.id,
    selectedDiagram?.includedPhotoIds,
    includedPhotoDataUrlsProp,
  ]);

  function DiagramPdf({ lines, meta, maxHeight = 300 }) {
    const width = meta?.canvasW || 1100;
    const height = meta?.canvasH || 900;

    // scale canvas → fit maxHeight
    const scale = maxHeight / height;
    const scaledWidth = width * scale;

    return (
      <Svg
        width={scaledWidth}
        height={maxHeight}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {lines.map((l, i) => {
          // NOTES / TEXT
          if (l.isNote && l.text) {
            return (
              <Text
                key={i}
                x={l.x}
                y={l.y}
                fontSize={l.fontSize || 14}
                fill={l.color || "#000"}
              >
                {l.text}
              </Text>
            );
          }

          // DOWNPOUT MARKER (example)
          if (l.isDownspout && l.x != null && l.y != null) {
            return (
              <Rect
                key={i}
                x={l.x - 6}
                y={l.y - 6}
                width={12}
                height={12}
                stroke={l.color || "#000"}
                strokeWidth={2}
                fill="none"
              />
            );
          }

          // STANDARD LINES (gutters, arrows, fascia, etc)
          if (l.x1 != null && l.y1 != null && l.x2 != null && l.y2 != null) {
            return (
              <Line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.color || "#000"}
                strokeWidth={l.width || 3}
              />
            );
          }

          return null;
        })}
      </Svg>
    );
  }

  return (
    <Document>
      {/* PAGE 1 */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* <Text style={{ fontSize: 22, fontWeight: "bold" }}>ESTIMATE</Text> */}
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <Text style={{ marginTop: 6 }}>
              {t(currentUser?.company || currentUser?.name)}
            </Text>
            <Text>{t(currentUser?.address)}</Text>
            <Text>{t(currentUser?.phone)}</Text>
          </View>

          <View style={styles.rightMeta}>
            {/* {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null} */}
            <Text
              style={{ fontSize: 22, fontWeight: "bold", marginBottom: 24 }}
            >
              ESTIMATE
            </Text>
            <View style={{ marginTop: 8, alignItems: "flex-end" }}>
              <Text>
                Estimate Number: {t(estimateData?.estimateNumber || "—")}
              </Text>
              <Text>Estimate Date: {t(estimateData?.estimateDate || "")}</Text>
              <Text>Payment Due: {t(paymentDueText)}</Text>
            </View>

            <View style={styles.amountPillRow}>
              <View style={styles.amountPill}>
                <Text>Amount Due (USD): {fmt(total)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bill To / Job Site */}
        <View style={[styles.section, { flexDirection: "row" }]}>
          <View style={styles.billTo}>
            <Text style={styles.sectionTitle}>BILL TO</Text>
            <Text>{billToName}</Text>
            <Text>{billToAddress}</Text>
            <Text>{billToPhone}</Text>
          </View>

          <View style={styles.jobSite}>
            <Text style={styles.sectionTitle}>JOB SITE</Text>
            <Text>{jobName}</Text>
            <Text>{jobAddress}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={{ width: itemHeaderWidth }}>
              <Text style={styles.th}>Item / Description</Text>
            </View>
            <View style={{ width: qtyHeaderWidth, textAlign: "right" }}>
              <Text style={styles.th}>Quantity</Text>
            </View>
            {showPrices && (
              <View style={{ width: amtHeaderWidth, textAlign: "right" }}>
                <Text style={styles.th}>Amount</Text>
              </View>
            )}
          </View>

          {rows.map((r, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={{ width: itemHeaderWidth }}>
                <Text style={styles.cell}>
                  {t(prettifyLineItemName(r.name))}
                </Text>
              </View>
              <View style={{ width: qtyHeaderWidth, textAlign: "right" }}>
                <Text style={styles.cell}>{t(qInt(r.quantity))}</Text>
              </View>
              {showPrices && (
                <View style={{ width: amtHeaderWidth, textAlign: "right" }}>
                  <Text style={styles.cell}>
                    {fmt(Number(r.price || 0) * qInt(r.quantity))}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Amount Due */}
        <View style={styles.amountDueWrap}>
          <View style={styles.amountBox}>
            <Text style={styles.amountText}>Total Amount Due (USD)</Text>
            <Text style={styles.amountText}>{fmt(total)}</Text>
          </View>
        </View>
      </Page>

      {/* PAGE 2 — Diagram + Legend + Notes */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>
              Project Diagram
            </Text>
          </View>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>

        {selectedDiagram?.lines?.length ? (
          <View style={styles.bigDiagramWrap}>
            <View style={styles.bigDiagramFrame} wrap={false}>
              <DiagramGraphic
                selectedDiagram={selectedDiagram}
                products={products}
                // Letter page width = 612pt; you have 40pt padding left + 40pt right => ~532pt usable
                maxWidth={532}
                // Keep room for legend/notes under it
                maxHeight={500}
              />
            </View>
          </View>
        ) : diagramImage ? (
          <View style={styles.bigDiagramWrap}>
            {selectedDiagram?.lines?.length && selectedDiagram?.meta ? (
              <View wrap={false} style={{ marginBottom: 12 }}>
                <DiagramGraphic
                  selectedDiagram={selectedDiagram}
                  products={products}
                  style={styles.bigDiagram}
                />
              </View>
            ) : selectedDiagram?.imageData ? (
              <Image
                src={selectedDiagram.imageData}
                style={styles.bigDiagram}
              />
            ) : null}
          </View>
        ) : (
          <Text>(No diagram image)</Text>
        )}

        {/* Legend */}
        {legendEntriesFromLines(selectedDiagram, products).length > 0 && (
          <View style={styles.keySection}>
            <Text style={styles.sectionTitle}>Key</Text>
            <View style={styles.keyRow}>
              {legendEntriesFromLines(selectedDiagram, products).map((e, i) => (
                <View key={i} style={styles.keyItem}>
                  <KeySwatch color={e.color} shape={e.shape} />
                  <Text style={styles.cell}>{e.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {estimateData?.notes ? (
          <View style={styles.page2Notes}>
            <Text>Notes: {t(estimateData.notes)}</Text>
          </View>
        ) : null}
        {(selectedDiagram?.includedPhotoIds || []).length > 0 &&
        includedPhotoSources.length === 0 &&
        jwt ? ( // ✅ only show if we actually had auth available
          <Text style={{ fontSize: 10, color: "#888" }}>
            Photos selected but failed to load for PDF.
          </Text>
        ) : null}
      </Page>
      {/* PHOTO PAGES (2x2 grid per page) */}
      {includedPhotoSources?.length
        ? chunk(includedPhotoSources, 4).map((pagePhotos, pageIdx) => (
            <Page key={`photos-${pageIdx}`} size="LETTER" style={styles.page}>
              <View style={styles.headerRow}>
                <Text style={styles.photoPageTitle}>
                  Photos (Page {pageIdx + 1})
                </Text>
                {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
              </View>

              <View style={styles.photoGrid}>
                {pagePhotos.map((src, idx) => (
                  <View key={`ph-${pageIdx}-${idx}`} style={styles.photoCell}>
                    <Image src={src} style={styles.photoImage} />
                    <Text style={styles.photoCaption}>
                      Photo {pageIdx * 4 + idx + 1}
                    </Text>
                  </View>
                ))}
              </View>
            </Page>
          ))
        : null}

      {/* add a page for the installer diagram here*/}
      {/* add more pages as needed */}
    </Document>
  );
}
