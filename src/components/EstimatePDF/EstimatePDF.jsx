// src/components/EstimatePDF/EstimatePDF.jsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// ---- styles ----
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

  // table (no grid)
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
    borderBottom: "1pt solid #e6e6e6",
  },
  cell: { fontSize: 10 },

  amountDueWrap: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  amountBox: { border: "1pt solid #000", padding: 10, width: 220 },
  amountText: { fontSize: 12, fontWeight: "bold", textAlign: "right" },

  keySection: { marginTop: 16 },
  keyRow: { flexDirection: "row" },
  keyItem: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  swatch: { width: 10, height: 10, marginRight: 6, border: "1pt solid #333" },

  // page 2
  bigDiagramWrap: { marginTop: 10, alignItems: "center" },
  bigDiagram: {
    width: 500, // reverted
    height: 500, // reverted
    objectFit: "contain",
    border: "1pt solid #ddd",
  },
  page2Notes: { marginTop: 10, fontSize: 10 },
});

// ---- helpers ----
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n || 0)
  );

// fold duplicates (prefer product identity)
function fold(items) {
  const map = new Map();
  (items || []).forEach((it) => {
    const key =
      it.product?._id ||
      [
        it.name,
        it.meta?.kind || "",
        it.meta?.miterType || "",
        it.meta?.code || "",
        it.meta?.inches || "",
        it.meta?.side || "",
        it.meta?.size || it.meta?.sizeKey || "",
        it.meta?.profile || "",
      ].join("|");

    const prev = map.get(key);
    if (prev) {
      prev.quantity += Number(it.quantity || 0);
    } else {
      map.set(key, { ...it, quantity: Number(it.quantity || 0) });
    }
  });
  return Array.from(map.values());
}

// normalize DS label
const prettyDs = (raw = "") =>
  String(raw)
    .replace(
      /(\d+\s*x\s*\d+)\s*corrugated/i,
      (_m, size) => `${size.replace(/\s*/g, "")} Corrugated`
    )
    .replace(/\s+/g, " ")
    .trim();

// normalize CSS color -> hex for @react-pdf
function normalizeColor(c) {
  if (!c) return "#000";
  const s = String(c).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
  const m = s.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const toHex = (n) =>
      Math.max(0, Math.min(255, parseInt(n, 10)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  }
  const NAMED = {
    red: "#ff0000",
    blue: "#0000ff",
    green: "#008000",
    black: "#000000",
    white: "#ffffff",
    gray: "#808080",
    grey: "#808080",
    orange: "#ffa500",
    yellow: "#ffff00",
    purple: "#800080",
    pink: "#ffc0cb",
    brown: "#a52a2a",
  };
  const lower = s.toLowerCase();
  return NAMED[lower] || s;
}

// NEW: lightweight gutter name normalizer (uses size + a couple words)
// No renames; local to this file.
function prettyGutter(raw = "") {
  const s = String(raw).trim();
  if (!s) return "Gutter";
  // Try to capture leading size like 5" or 6"
  const m = s.match(/(\d+)\s*"/);
  const size = m ? `${m[1]}"` : null;

  // Extract a short descriptor after size (e.g., K-Style, Half Round)
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
  // Fallback: keep the original product name (safe & accurate)
  return s;
}

export default function EstimatePDF({
  estimate,
  selectedDiagram,
  currentUser,
  logoUrl,
  estimateData,
  project,
  products,
  showPrices = true, // controls visibility of Amount column
  extraItems = [],
  items = [], // saved items
}) {
  // ---- rows from diagram ----
  const lines = selectedDiagram?.lines || [];
  const baseRows = [];

  // legend colors (prefer drawn color)
  let gutterColor = null;
  let downspoutColor = null;

  let gutterLabel = null;
  let downspoutLabel = null;

  lines.forEach((l) => {
    if (l.isDownspout) {
      baseRows.push({
        name: `${prettyDs(l.downspoutSize)} Downspout`,
        quantity: l.measurement || 0,
        unitPrice: Number(l.price || 0),
        meta: { kind: "downspout" },
      });
      if (!downspoutColor) downspoutColor = normalizeColor(l.color || "#000");
      if (!downspoutLabel) {
        const label = l.downspoutSize
          ? `${prettyDs(l.downspoutSize)} Downspout`
          : "Downspout";
        downspoutLabel = label;
      }
    } else if (l.currentProduct) {
      baseRows.push({
        name: l.currentProduct.name,
        quantity: l.measurement || 0,
        unitPrice: Number(l.currentProduct.price || 0),
        meta: { kind: "gutter" },
      });
      if (!gutterColor)
        gutterColor = normalizeColor(
          l.color ||
            l.currentProduct?.colorCode ||
            l.currentProduct?.visual ||
            l.currentProduct?.color ||
            "#000"
        );
      if (!gutterLabel) {
        gutterLabel = prettyGutter(l.currentProduct.name || "Gutter");
      }
    }
  });

  // accessories
  const accessoryItems =
    selectedDiagram?.accessories?.items ||
    selectedDiagram?.accessoryItems ||
    [];

  // prefer saved items (viewer/download) else build from diagram+accessories
  const presetRows =
    Array.isArray(items) && items.length
      ? items.map((it) => ({
          name: it.name,
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),
        }))
      : null;

  const rows = presetRows
    ? presetRows
    : fold(
        [...baseRows, ...accessoryItems, ...extraItems].map((r) => ({
          ...r,
          price: Number(r.unitPrice ?? r.price ?? 0),
          quantity: Number(r.quantity || 0),
        }))
      );

  const total = rows.reduce(
    (sum, r) => sum + Number(r.price || 0) * Number(r.quantity || 0),
    0
  );

  // diagram image
  const diagramImage =
    selectedDiagram?.imageDataLarge || selectedDiagram?.imageData || null;

  // widths when Amount hidden vs shown
  const itemHeaderWidth = showPrices ? "70%" : "85%";
  const qtyHeaderWidth = showPrices ? "10%" : "15%";
  const amtHeaderWidth = "20%";

  // Payment due default
  const paymentDueText = estimateData?.paymentDue || "Upon completion.";

  // pull Bill To / Job Site exactly as requested, with safe fallbacks
  const billToName = project?.billingName || "";
  const billToAddress = project?.billingAddress || "";
  const billToPhone = project?.billingPrimaryPhone || "";

  const jobName =
    project?.projectName ||
    estimate?.projectSnapshot?.name ||
    project?.name ||
    "";
  const jobAddress =
    project?.projectAddress ||
    estimate?.projectSnapshot?.address ||
    project?.address ||
    "";

  return (
    <Document>
      {/* PAGE 1 — Header / Items */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "bold" }}>ESTIMATE</Text>
            <Text style={{ marginTop: 6 }}>
              {currentUser?.company || currentUser?.name}
            </Text>
            <Text>{currentUser?.address}</Text>
            <Text>{currentUser?.phone}</Text>
          </View>

          <View style={styles.rightMeta}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <View style={{ marginTop: 8, alignItems: "flex-end" }}>
              <Text>
                Estimate Number: {estimateData?.estimateNumber || "—"}
              </Text>
              <Text>Estimate Date: {estimateData?.estimateDate || ""}</Text>
              <Text>Payment Due: {paymentDueText}</Text>
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
          {/* BILL TO — exact fields */}
          <View style={styles.billTo}>
            <Text style={styles.sectionTitle}>BILL TO</Text>
            <Text>{billToName}</Text>
            <Text>{billToAddress}</Text>
            <Text>{billToPhone}</Text>
          </View>

          {/* JOB SITE — exact fields with fallbacks */}
          <View style={styles.jobSite}>
            <Text style={styles.sectionTitle}>JOB SITE</Text>
            <Text>{jobName}</Text>
            <Text>{jobAddress}</Text>
          </View>
        </View>

        {/* Items table (Unit Price removed; Amount shown only when showPrices) */}
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
                <Text style={styles.cell}>{r.name}</Text>
              </View>
              <View style={{ width: qtyHeaderWidth, textAlign: "right" }}>
                <Text style={styles.cell}>{r.quantity}</Text>
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

        {/* Amount Due box (right aligned) */}
        <View style={styles.amountDueWrap}>
          <View style={styles.amountBox}>
            <Text style={styles.amountText}>Total Amount Due (USD)</Text>
            <Text style={styles.amountText}>{fmt(total)}</Text>
          </View>
        </View>
      </Page>

      {/* PAGE 2 — Big diagram, legend under image, notes */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>
              Project Diagram
            </Text>
          </View>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>

        {diagramImage ? (
          <View style={styles.bigDiagramWrap}>
            <Image src={diagramImage} style={styles.bigDiagram} />
          </View>
        ) : (
          <Text>(No diagram image)</Text>
        )}

        {/* Legend under the diagram with real draw colors */}
        {gutterColor || downspoutColor ? (
          <View style={styles.keySection}>
            <Text style={styles.sectionTitle}>Key</Text>
            <View style={styles.keyRow}>
              {gutterColor && gutterLabel ? (
                <View style={styles.keyItem}>
                  <View
                    style={[styles.swatch, { backgroundColor: gutterColor }]}
                  />
                  <Text>{gutterLabel}</Text>
                </View>
              ) : null}
              {downspoutColor && downspoutLabel ? (
                <View style={styles.keyItem}>
                  <View
                    style={[styles.swatch, { backgroundColor: downspoutColor }]}
                  />
                  <Text>{downspoutLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {estimateData?.notes ? (
          <View style={styles.page2Notes}>
            <Text>Notes: {estimateData.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
