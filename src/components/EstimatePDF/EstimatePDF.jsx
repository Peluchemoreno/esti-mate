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
  row: { flexDirection: "row", justifyContent: "space-between" },
  billTo: { flex: 1, marginRight: 20 },
  jobSite: { marginLeft: "auto" },

  // table (no grid lines – only header band + row separators)
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  th: { fontSize: 10, fontWeight: "bold" },
  colItem: { width: "50%" },
  colQty: { width: "15%", textAlign: "right" },
  colUnit: { width: "15%", textAlign: "right" }, // retained, not rendered
  colAmount: { width: "20%", textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: "1pt solid #e6e6e6",
  },
  cell: { fontSize: 10 },

  notes: { marginTop: 14, padding: 10, border: "1pt solid #ccc", fontSize: 10 },

  amountDueWrap: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  amountBox: { border: "1pt solid #000", padding: 10, width: 220 },
  amountText: { fontSize: 12, fontWeight: "bold", textAlign: "right" },

  keySection: { marginTop: 16 },
  keyRow: { flexDirection: "row", gap: 12 },
  keyItem: { flexDirection: "row", alignItems: "center" },
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
        it.meta?.code || "", // A/B/C elbows
        it.meta?.inches || "", // offsets
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

export default function EstimatePDF({
  estimate,
  selectedDiagram,
  currentUser,
  logoUrl,
  estimateData,
  project,
  products,
  showPrices = true, // now controls visibility of Amount column
  extraItems = [],
  items = [], // saved items (viewer mode)
}) {
  // Base rows from diagram
  const lines = selectedDiagram?.lines || [];
  const baseRows = [];

  // capture first seen colors for the legend (prefer drawn color)
  let gutterColor = null;
  let downspoutColor = null;

  lines.forEach((l) => {
    if (l.isDownspout) {
      baseRows.push({
        name: `${prettyDs(l.downspoutSize)} Downspout`,
        quantity: l.measurement || 0,
        unitPrice: Number(l.price || 0),
        meta: { kind: "downspout" },
      });
      if (!downspoutColor) downspoutColor = l.color || "#000";
    } else if (l.currentProduct) {
      baseRows.push({
        name: l.currentProduct.name,
        quantity: l.measurement || 0,
        unitPrice: Number(l.currentProduct.price || 0),
        meta: { kind: "gutter" },
      });
      if (!gutterColor)
        gutterColor =
          l.color ||
          l.currentProduct?.colorCode ||
          l.currentProduct?.visual ||
          l.currentProduct?.color ||
          "#000";
    }
  });

  // Accessories (elbows/offsets/etc.)
  const accessoryItems =
    selectedDiagram?.accessories?.items ||
    selectedDiagram?.accessoryItems ||
    [];

  // Prefer saved items if provided; else build from diagram + accessories
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

  // Legend squares (we’ll render these under the diagram on page 2)
  const legend = [];
  if (gutterColor) legend.push({ label: "Gutter", color: gutterColor });
  if (downspoutColor)
    legend.push({ label: "Downspout", color: downspoutColor });

  const diagramImage =
    selectedDiagram?.imageDataLarge || selectedDiagram?.imageData || null;

  // Widths when Amount is hidden vs shown
  const itemHeaderWidth = showPrices ? "70%" : "85%";
  const qtyHeaderWidth = showPrices ? "10%" : "15%";
  const amtHeaderWidth = "20%";

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
              <Text>Payment Due: {estimateData?.paymentDue || ""}</Text>
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
            <Text>{project?.billingName}</Text>
            <Text>{project?.billingAddress}</Text>
            <Text>{project?.billingPrimaryPhone}</Text>
          </View>
          <View style={styles.jobSite}>
            <Text style={styles.sectionTitle}>JOB SITE</Text>
            <Text>{project?.name}</Text>
            <Text>{project?.address}</Text>
          </View>
        </View>

        {/* Items table (Unit column removed; Amount shown only when showPrices) */}
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

      {/* PAGE 2 — Big diagram and notes, with legend under the diagram */}
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

        {/* Legend under the diagram, using actual drawn colors */}
        {legend.length ? (
          <View style={[styles.keySection, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>Key</Text>
            <View style={styles.keyRow}>
              {legend.map((k, idx) => (
                <View key={idx} style={styles.keyItem}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: k.color || "#000" },
                    ]}
                  />
                  <Text>{k.label}</Text>
                </View>
              ))}
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
