// src/components/EstimatePDF/EstimatePDF.jsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { useEffect } from "react";

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
  keyItem: { flexDirection: "row", alignItems: "center", marginRight: 24 },
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
function prettifyLineItemName(raw) {
  if (!raw) return "";

  let name = String(raw);

  // collapse duplicate profile tokens: "smooth smooth", "box box", "corrugated corrugated", "round round"
  name = name.replace(/\b(corrugated|smooth|box|round)\b\s+\1\b/gi, "$1");

  // normalize case for profiles
  name = name.replace(/\b(corrugated|smooth|box|round)\b/gi, (m) => {
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  });

  // normalize size token 3x4 / 2x3 to lowercase x and no spaces
  name = name.replace(/(\d+)\s*[xX]\s*(\d+)/g, (_, a, b) => `${a}x${b}`);

  // avoid accidental double-quoted inches like 3" 3" Offset
  name = name.replace(/(\b\d+)"\s+\1"\b/g, `$1"`);

  // compress extra whitespace
  name = name.replace(/\s{2,}/g, " ").trim();

  return name;
}

// normalize DS label
// Normalize DS label to "3\" Round" or "3x4 Corrugated"
const prettyDs = (raw = "") => {
  const s = String(raw || "").trim();

  // Try to extract size:
  const mCorr = s.match(/(\d+\s*x\s*\d+)\s*(corrugated)?/i); // 2x3 / 3x4
  const mRound = s.match(/(\d+)\s*"?\s*(?:inch|")\s*(round)?/i); // 3" Round, 3 inch Round

  if (mCorr) {
    const size = mCorr[1].replace(/\s*/g, "").toLowerCase(); // "3x4"
    return `${size} Corrugated`.replace(
      /^(\d+)x(\d+) Corrugated$/i,
      (_, a, b) => `${a}x${b} Corrugated`
    );
  }
  if (mRound) {
    const inches = mRound[1]; // "3"
    return `${inches}" Round`;
  }

  // Fallbacks/cleanup: collapse repeated tokens and odd quoting
  return s
    .replace(/"\s*round\s*"?\s*round/i, `" Round`) // ... "Round" Round -> " Round
    .replace(/\s+/g, " ")
    .trim();
};

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

// prefer explicit color fields; fall back to template default-ish fields
function productColor(p) {
  return normalizeColor(
    p?.colorCode ?? p?.visual ?? p?.color ?? p?.defaultColor ?? "#000"
  );
}

// From a downspout line, normalize size/profile to match catalog names
function parseDownspoutTokens(line) {
  const rawSize = String(line.downspoutSize || "").trim();
  const rawName = String(line.currentProduct?.name || "");
  // Try 2x3 / 3x4 first
  let sizeKey = (
    rawSize.match(/(\d+)\s*[xX]\s*(\d+)/) ||
    rawName.match(/(\d+)\s*[xX]\s*(\d+)/)
  )?.slice(1, 3);
  if (sizeKey) sizeKey = `${sizeKey[0]}x${sizeKey[1]}`;
  // Try 3" / 4"
  if (!sizeKey) {
    const m = rawSize.match(/(\d+)\s*"?/) || rawName.match(/(\d+)\s*"?/);
    if (m) sizeKey = `${m[1]}"`;
  }
  // profile from line or product name
  const pname = `${line.profile || ""} ${rawName}`.toLowerCase();
  let profileKey = "corrugated";
  if (pname.includes("round")) profileKey = "round";
  else if (pname.includes("smooth")) profileKey = "smooth";
  else if (pname.includes("box")) profileKey = "box";
  return { sizeKey: sizeKey || "unknown", profileKey };
}

// Find the matching downspout product in the catalog by size/profile
function findDownspoutProductColor(products = [], line) {
  const { sizeKey, profileKey } = parseDownspoutTokens(line);
  const list = Array.isArray(products) ? products : [];
  // prefer explicit downspout products
  const hit =
    list.find((p) => {
      const n = String(p.name || "").toLowerCase();
      const isDs =
        (p.type || "").toLowerCase() === "downspout" || n.includes("downspout");
      if (!isDs) return false;

      // size test
      const s = n;
      const hasSize = /^\d+x\d+$/i.test(sizeKey)
        ? new RegExp(`\\b${sizeKey.replace("x", "\\s*[xX]\\s*")}\\b`, "i").test(
            n
          )
        : sizeKey.endsWith(`"`)
        ? s.includes(`${sizeKey}`)
        : true;

      // profile token test
      const profOk =
        profileKey === "round"
          ? /round/.test(n)
          : profileKey === "smooth"
          ? /smooth/.test(n)
          : profileKey === "box"
          ? /box/.test(n)
          : /corrug/.test(n); // corrugated default

      return hasSize && profOk;
    }) ||
    // fallback: any downspout
    list.find((p) => {
      const n = String(p.name || "").toLowerCase();
      const isDs =
        (p.type || "").toLowerCase() === "downspout" || n.includes("downspout");
      return isDs;
    });

  return hit ? productColor(hit) : "#000";
}

// For gutters: just read from the bound product if present; else match by name
function findGutterProductColor(products = [], name, fallbackColor) {
  const list = Array.isArray(products) ? products : [];
  const n0 = String(name || "").toLowerCase();
  const hit =
    list.find((p) => String(p.name || "").toLowerCase() === n0) ||
    list.find((p) => {
      const n = String(p.name || "").toLowerCase();
      // loose contains if exact not found/
      return n && n0 && n0.length > 3 && n.includes(n0);
    });
  return hit ? productColor(hit) : normalizeColor(fallbackColor || "#000");
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

  // Legend needs label -> color, not a single color
  const gutterColorByLabel = new Map(); // label => color
  const dsColorByLabel = new Map(); // label => color

  lines.forEach((l) => {
    if (l.isDownspout) {
      const label = `${prettyDs(l.downspoutSize)} Downspout`;

      baseRows.push({
        name: label,
        quantity: Number(l.measurement || 0),
        unitPrice: Number(l.price || 0),
        meta: { kind: "downspout" },
      });

      // color: prefer drawn color, else resolve from catalog by size/profile
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

  // accessories
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

  // If `items` prop is present (saved estimate), use as-is (no folding).
  // Otherwise (live preview without explicit items), fall back to whatever you computed locally.
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
                <Text style={styles.cell}>{prettifyLineItemName(r.name)}</Text>
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

        {/* --- Legend --- */}
        {(gutterColorByLabel.size > 0 || dsColorByLabel.size > 0) && (
          <View style={styles.keySection}>
            <Text style={styles.sectionTitle}>Key</Text>

            {/* Gutters */}
            {gutterColorByLabel.size > 0 && (
              <View style={styles.keyRow}>
                {[...gutterColorByLabel.entries()].map(([label, color]) => (
                  <View key={`g-${label}`} style={styles.keyItem}>
                    <View style={[styles.swatch, { backgroundColor: color }]} />
                    <Text style={styles.cell}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Downspouts */}
            {dsColorByLabel.size > 0 && (
              <View style={[styles.keyRow, { marginTop: 6 }]}>
                {[...dsColorByLabel.entries()].map(([label, color]) => (
                  <View key={`ds-${label}`} style={styles.keyItem}>
                    <View style={[styles.swatch, { backgroundColor: color }]} />
                    <Text style={styles.cell}>{label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {estimateData?.notes ? (
          <View style={styles.page2Notes}>
            <Text>Notes: {estimateData.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
