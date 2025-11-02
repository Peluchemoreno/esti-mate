import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Line,
} from "@react-pdf/renderer";

// ---------- tiny helpers ----------
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
      const color = normalizeColor(
        l.color || findDownspoutProductColor(products, l)
      );

      if (!uniq.has(label)) uniq.set(label, { label, color, shape: "square" });
      continue;
    }

    // Gutter run
    if (l.currentProduct) {
      const raw = String(l.currentProduct.name);
      const label = prettyGutter(raw);
      const fallbackColor =
        l.currentProduct?.colorCode ||
        l.currentProduct?.visual ||
        l.currentProduct?.color ||
        l.color;

      const color = normalizeColor(
        l.color || findGutterProductColor(products, raw, fallbackColor)
      );

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
  return normalizeColor(
    p?.colorCode ?? p?.visual ?? p?.color ?? p?.defaultColor ?? "#000"
  );
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

  keySection: { marginTop: 16 },
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

  bigDiagramWrap: { marginTop: 10, alignItems: "center" },
  bigDiagram: {
    width: 500,
    height: 500,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: "#dddddd",
  },
  page2Notes: { marginTop: 10, fontSize: 10 },
});

// ---------- vector diagram (crisp) ----------
function DiagramGraphic({ selectedDiagram, style }) {
  try {
    const lines = Array.isArray(selectedDiagram?.lines)
      ? selectedDiagram.lines
      : null;
    const svgStr = selectedDiagram?.svg || null;
    let meta = selectedDiagram?.meta || null;

    if (lines && lines.length > 0) {
      // Derive canvas bounds if meta missing, so we can still render vector
      if (!meta) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const l of lines) {
          const xs = [l.startX, l.endX ?? l.startX].map((n) =>
            Math.round(Number(n || 0))
          );
          const ys = [l.startY, l.endY ?? l.startY].map((n) =>
            Math.round(Number(n || 0))
          );
          xs.forEach((x) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          });
          ys.forEach((y) => {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
        }
        const pad = 12; // small padding so strokes aren't clipped
        const W = Math.max(
          1,
          (isFinite(maxX) ? maxX : 0) - (isFinite(minX) ? minX : 0) + pad * 2
        );
        const H = Math.max(
          1,
          (isFinite(maxY) ? maxY : 0) - (isFinite(minY) ? minY : 0) + pad * 2
        );
        meta = {
          canvasW: W,
          canvasH: H,
          gridSize: 8,
          offsetX: (isFinite(minX) ? minX : 0) - pad,
          offsetY: (isFinite(minY) ? minY : 0) - pad,
        };
      }

      const W = Number(meta.canvasW || 0) || 0;
      const H = Number(meta.canvasH || 0) || 0;
      const grid = Number(meta.gridSize || 8) || 8;
      const offX = Number(meta.offsetX || 0);
      const offY = Number(meta.offsetY || 0);

      return (
        <Svg
          style={style}
          viewBox={`0 0 ${Math.max(1, W)} ${Math.max(1, H)}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {lines.map((l, i) => {
            const round = (n) => Math.round(Number(n || 0));
            const x1 = round(l.startX) - offX;
            const y1 = round(l.startY) - offY;
            const x2 = round(l.endX ?? l.startX) - offX;
            const y2 = round(l.endY ?? l.startY) - offY;
            const color = normalizeColor(l.color || "#000");
            const base = l.isDownspout ? 2 : 3;
            const sw = Math.max(1, Math.round(Number(l.lineWidth || base)));

            if (l.isDownspout) {
              const d = grid / 2.75;
              return (
                <Svg key={i}>
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x1 + d}
                    y2={y1 + d}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x1 - d}
                    y2={y1 + d}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x1 - d}
                    y2={y1 - d}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x1 + d}
                    y2={y1 - d}
                    stroke={color}
                    strokeWidth={2}
                  />
                </Svg>
              );
            }

            return (
              <Line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </Svg>
      );
    }

    // Fallback if only an SVG string is present
    if (svgStr) {
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
      return <Image src={dataUrl} style={style} />;
    }
  } catch {
    // fall through to raster
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
}) {
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
        const col = normalizeColor(
          l.color || findDownspoutProductColor(products, l)
        );
        dsColorByLabel.set(label, col);
      }
    } else if (l.currentProduct) {
      const name = String(l.currentProduct.name || "Gutter");
      const qty = Number(l.measurement || 0);
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

  // final rows for the items table (we respect what caller passes in)
  const rows =
    Array.isArray(items) && items.length
      ? items
      : Array.isArray(extraItems) && extraItems.length
      ? extraItems
      : [];
  const total = rows.reduce(
    (sum, r) => sum + Number(r.price || 0) * Number(r.quantity || 0),
    0
  );

  const diagramImage =
    selectedDiagram?.imageDataLarge || selectedDiagram?.imageData || null;

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

  return (
    <Document>
      {/* PAGE 1 */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "bold" }}>ESTIMATE</Text>
            <Text style={{ marginTop: 6 }}>
              {t(currentUser?.company || currentUser?.name)}
            </Text>
            <Text>{t(currentUser?.address)}</Text>
            <Text>{t(currentUser?.phone)}</Text>
          </View>

          <View style={styles.rightMeta}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
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
                <Text style={styles.cell}>{t(r.quantity)}</Text>
              </View>
              {showPrices && (
                <View style={{ width: amtHeaderWidth, textAlign: "right" }}>
                  <Text style={styles.cell}>
                    {fmt(Number(r.price || 0) * Number(r.quantity || 0))}
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

        {selectedDiagram?.lines?.length && selectedDiagram?.meta ? (
          <View style={styles.bigDiagramWrap}>
            <DiagramGraphic
              selectedDiagram={selectedDiagram}
              style={styles.bigDiagram}
            />
          </View>
        ) : diagramImage ? (
          <View style={styles.bigDiagramWrap}>
            <Image src={diagramImage} style={styles.bigDiagram} />
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
      </Page>
    </Document>
  );
}
