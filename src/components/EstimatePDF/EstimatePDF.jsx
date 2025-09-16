// src/components/EstimatePDF/EstimatePDF.jsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Image,
} from "@react-pdf/renderer";
import { useEffect, useMemo, useState } from "react";
import { getCurrentDate, capitalizeFirstLetter } from "../../utils/constants";
import { makePriceResolver } from "../../utils/priceResolver";

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 100 },
  section: { marginBottom: 15, borderBottom: "1px solid grey" },
  header: { fontSize: 28, marginBottom: 15, textAlign: "right" },
  text: { fontSize: 14, marginBottom: 5 },
  smallerText: { fontSize: 12, marginBottom: 5 },
  bold: { fontWeight: "bold" },
  itemsHeader: { display: "flex", flexDirection: "row" },
});

// --- tiny helpers ---
const toNum = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();
const slugOf = (obj) => {
  // stable identity without depending on display name
  const type = norm(obj?.type);
  const profile = norm(obj?.profile);
  const size = norm(obj?.size);
  return `${type}|${profile}|${size}`.replace(/\s+/g, "-");
};
const capWords = (str) =>
  String(str || "")
    .split(" ")
    .map((w) => capitalizeFirstLetter(w))
    .join(" ");

function EstimatePDF({
  project,
  selectedDiagram,
  activeModal,
  currentUser,
  logoUrl,
  estimateData,
  products,
  estimate, // fallback name
}) {
  const [itemizedArray, setItemizedArray] = useState([]);
  const estimateDataResolved = estimateData || estimate || {};

  // Build a resolver that can answer: given {productId/templateId/slug/name/...} → user product with price
  const resolveProduct = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return makePriceResolver(list);
  }, [products]);

  // ---- Build itemized rows from the diagram, resolving prices robustly ----
  const buildItemized = useMemo(() => {
    return function buildItemizedInner(diagram) {
      if (!diagram) return [];
      const items = [];
      const lines = Array.isArray(diagram.lines) ? diagram.lines : [];

      // 1) Combine linear items (gutters, fascia wrap, etc.)
      const combined = new Map(); // key -> { quantity, refLine }
      for (const line of lines) {
        if (!line || line.isNote) continue;

        // Prefer using the product identity carried by the line when available
        const cp = line.currentProduct || {};
        const key =
          cp._id || cp.id || cp.templateId || cp.slug
            ? // identity key (not display name)
              `${cp._id || ""}|${cp.templateId || ""}|${cp.slug || ""}`
            : // fall back to a display label that won't explode totals if names vary
            line.isDownspout
            ? `DOWN-${line.downspoutSize || ""}-${line.downspoutMaterial || ""}`
            : `ITEM-${norm(cp.type)}|${norm(cp.profile)}|${norm(
                cp.size
              )}|${norm(cp.name)}`;

        const qty = toNum(line.measurement || 0);
        if (combined.has(key)) {
          const prev = combined.get(key);
          prev.quantity += qty;
        } else {
          combined.set(key, { quantity: qty, refLine: line });
        }
      }

      // Emit line items with resolved prices
      for (const [key, { quantity, refLine }] of combined.entries()) {
        const cp = refLine.currentProduct || {};
        const lineIdentity = {
          productId: cp._id || cp.id,
          templateId: cp.templateId,
          slug: cp.slug || slugOf(cp),
          name: cp.name,
          type: cp.type,
          profile: cp.profile,
          size: cp.size,
        };
        const resolved = resolveProduct(lineIdentity);

        const priceResolved = toNum(
          resolved?.price ?? cp.price ?? refLine.price ?? 0
        );

        const label = refLine.isDownspout
          ? `Downspout ${refLine.downspoutSize || ""} ${
              refLine.downspoutMaterial || ""
            }`.trim()
          : cp.name || "Unknown Item";

        items.push({
          item: label,
          quantity: toNum(quantity),
          price: priceResolved,
          description:
            cp.description ||
            (refLine.isDownspout
              ? `Downspout ${refLine.downspoutSize || ""} ${
                  refLine.downspoutMaterial || ""
                }`.trim()
              : ""),
        });
      }

      // 2) Accessory lines (new structure)
      const acc = diagram?.accessories?.accessoryLineItems;
      if (Array.isArray(acc) && acc.length) {
        for (const li of acc) {
          const p = li.product || {};
          const identity = {
            productId: p._id || p.id,
            templateId: p.templateId,
            slug: p.slug || slugOf(p),
            name: p.name,
            type: p.type,
            profile: p.profile,
            size: p.size,
          };
          const resolved = resolveProduct(identity);
          const priceResolved = toNum(
            li.price ?? resolved?.price ?? p.price ?? 0
          );
          const qty = toNum(li.quantity || 0);
          if (qty > 0) {
            items.push({
              item: p.name || li.name || "Accessory",
              quantity: qty,
              price: priceResolved,
              description: p.description || "",
            });
          }
        }
      } else {
        // 2b) Legacy accessory shape
        const accessoryData = Array.isArray(diagram?.accessoryData)
          ? diagram.accessoryData
          : [];

        const pushObj = (obj) => {
          if (!obj) return;
          Object.keys(obj).forEach((k) => {
            const v = obj[k];
            const emit = (row) => {
              if (!row) return;
              const p = row.product || {};
              const identity = {
                productId: p._id || p.id,
                templateId: p.templateId,
                slug: p.slug || slugOf(p),
                name: p.name || row.name,
                type: p.type,
                profile: p.profile,
                size: p.size,
              };
              const resolved = resolveProduct(identity);
              const qty = toNum(row.quantity || 0);
              if (qty <= 0) return;
              const priceResolved = toNum(
                row.price ?? resolved?.price ?? p.price ?? 0
              );
              items.push({
                item: p.name || row.name || `${k} accessory`,
                quantity: qty,
                price: priceResolved,
                description: p.description || "",
              });
            };

            if (Array.isArray(v)) v.forEach(emit);
            else if (v && typeof v === "object") emit(v);
          });
        };

        // indices 0/1/2 per your previous shape
        pushObj(accessoryData[0]);
        pushObj(accessoryData[1]);
        pushObj(accessoryData[2]);
      }

      // 3) Downspout parts (A/B/C elbows and 2/4/6" offsets)
      const partsByKey = {}; // `${size}|${material}` -> { A,B,C,2,4,6 }
      for (const line of lines) {
        if (!line?.isDownspout) continue;
        const type = String(line.downspoutSize || "").trim(); // "2x3" | "3x4"
        const material = String(line.downspoutMaterial || "").trim(); // "aluminum" | "copper" | ""
        const k = `${type}|${material}`;
        if (!partsByKey[k])
          partsByKey[k] = { A: 0, B: 0, C: 0, 2: 0, 4: 0, 6: 0 };
        const seq = String(line.elbowSequence || "").toUpperCase();
        for (const ch of seq) {
          if (["A", "B", "C", "2", "4", "6"].includes(ch)) partsByKey[k][ch]++;
        }
      }

      for (const [k, counts] of Object.entries(partsByKey)) {
        const [type, material] = k.split("|");
        for (const [part, qtyRaw] of Object.entries(counts)) {
          const qty = toNum(qtyRaw);
          if (qty <= 0) continue;

          const isOffset = ["2", "4", "6"].includes(part);
          const label = isOffset
            ? `${type} ${material ? material + " " : ""}${part}" Offset`
            : `${type} ${material ? material + " " : ""}${part} Elbow`;

          // try to resolve by a synthetic "product-like" identity using slug first
          const pseudoProduct = {
            // using consistent type/profile helps slug resolver
            type: "downspout",
            profile: isOffset ? "offset" : "elbow",
            size: type,
            name: label,
          };
          const resolved = resolveProduct({
            slug: slugOf(pseudoProduct),
            name: label,
            // give the resolver multiple angles
            type: pseudoProduct.type,
            profile: pseudoProduct.profile,
            size: pseudoProduct.size,
          });

          const priceResolved = toNum(resolved?.price || 0);
          items.push({
            item: label,
            quantity: qty,
            price: priceResolved, // 0 if not found; you can set these in catalog
            description: resolved?.description || "",
          });
        }
      }

      // 4) Optional counters (0-priced placeholders you may price later)
      const miscCounters = (() => {
        let splashBlocks = 0;
        let rainBarrelConnections = 0;
        let undergroundDrainageConnections = 0;
        for (const line of lines) {
          if (!line?.isDownspout) continue;
          if (line.splashBlock) splashBlocks++;
          if (line.rainBarrel) rainBarrelConnections++;
          if (line.undergroundDrainage) undergroundDrainageConnections++;
        }
        return {
          splashBlocks,
          rainBarrelConnections,
          undergroundDrainageConnections,
        };
      })();

      if (miscCounters.splashBlocks > 0)
        items.push({
          item: "Splash Block",
          quantity: miscCounters.splashBlocks,
          price: 0,
          description: "",
        });
      if (miscCounters.rainBarrelConnections > 0)
        items.push({
          item: "Rain Barrel Connection",
          quantity: miscCounters.rainBarrelConnections,
          price: 0,
          description: "",
        });
      if (miscCounters.undergroundDrainageConnections > 0)
        items.push({
          item: "Underground Drainage Connection",
          quantity: miscCounters.undergroundDrainageConnections,
          price: 0,
          description: "",
        });

      return items;
    };
  }, [resolveProduct]);

  // Rebuild items when the diagram/modal changes
  useEffect(() => {
    const next = buildItemized(selectedDiagram);
    setItemizedArray(next);
  }, [selectedDiagram, activeModal, buildItemized]);

  const grandTotal = useMemo(() => {
    return (itemizedArray || []).reduce((sum, row) => {
      return sum + toNum(row.quantity) * toNum(row.price);
    }, 0);
  }, [itemizedArray]);

  // ===== Render =====
  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.header}>ESTIMATE</Text>

        <View>
          <View style={[styles.section, { paddingBottom: 40 }]}>
            <Text style={[styles.text, styles.bold, { textAlign: "right" }]}>
              {project?.siteName}
            </Text>
            <Text style={[styles.text, { textAlign: "right" }]}>
              {project?.siteAddress}
            </Text>
            <Text
              style={[
                styles.smallerText,
                { textAlign: "right", color: "#444", marginTop: 10 },
              ]}
            >
              {project?.sitePrimaryPhone}
            </Text>
          </View>

          <View
            style={[
              styles.section,
              {
                display: "flex",
                flexDirection: "row",
                padding: 20,
                justifyContent: "space-between",
              },
            ]}
          >
            <View>
              <Text
                style={[styles.smallerText, styles.bold, { color: "#444" }]}
              >
                BILL TO
              </Text>
              <Text style={[styles.smallerText, styles.bold]}>
                {project?.billingName}
              </Text>
              <Text style={[styles.smallerText, { marginBottom: 10 }]}>
                {project?.billingAddress}
              </Text>
              <Text style={[styles.smallerText, { color: "#444" }]}></Text>
              <Text style={[styles.smallerText, { color: "#444" }]}>
                {project?.billingPrimaryPhone}
              </Text>
            </View>

            <View
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                width: 250,
              }}
            >
              <View style={{ display: "flex", flexDirection: "row" }}>
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Estimate Number:
                </Text>
                <Text style={[styles.smallerText]}>
                  {estimateDataResolved.estimateNumber}
                </Text>
              </View>
              <View style={{ display: "flex", flexDirection: "row" }}>
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Estimate Date:
                </Text>
                <Text style={[styles.smallerText]}>{getCurrentDate()}</Text>
              </View>
              <View style={{ display: "flex", flexDirection: "row" }}>
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Payment Due:
                </Text>
                <Text style={[styles.smallerText]}>
                  {estimateDataResolved.paymentDue}
                </Text>
              </View>
              <View
                style={{
                  display: "flex",
                  flexDirection: "row",
                  backgroundColor: "#ddd",
                  alignItems: "center",
                  padding: 5,
                  marginTop: 10,
                }}
              >
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Amount Due (USD):
                </Text>
                <Text
                  style={[styles.smallerText, styles.bold, { paddingTop: 2 }]}
                >
                  ${grandTotal.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Logo */}
          <View
            style={{
              position: "absolute",
              top: -70,
              display: "flex",
              alignItems: "center",
              flexDirection: "row",
            }}
          >
            <View
              style={{
                backgroundColor: "transparent",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {logoUrl && (
                <Image
                  src={logoUrl}
                  style={{ width: 150, height: 150, objectFit: "contain" }}
                />
              )}
            </View>
          </View>
        </View>

        {/* Items Header */}
        <View>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#ccc",
              padding: 8,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{ width: "60%", fontWeight: "bold", fontSize: "12px" }}
            >
              Item
            </Text>
            <Text
              style={{
                width: "10%",
                fontWeight: "bold",
                textAlign: "center",
                fontSize: "12px",
              }}
            >
              Quantity
            </Text>
            <Text
              style={{
                width: "20%",
                fontWeight: "bold",
                textAlign: "right",
                fontSize: "12px",
              }}
            >
              Amount
            </Text>
          </View>

          {itemizedArray.map((line, i) => {
            const qty = toNum(line.quantity);
            const amount = (qty * toNum(line.price)).toFixed(2);
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  padding: 8,
                  borderBottom: "1px solid #eee",
                  alignItems: "center",
                }}
              >
                <View style={{ width: "60%" }}>
                  <Text style={{ fontSize: "12px", fontWeight: "bold" }}>
                    {capWords(line.item || "N/A")}
                  </Text>
                  <Text
                    style={{ fontSize: "10px", color: "#555", marginTop: 2 }}
                  >
                    {line.description || ""}
                  </Text>
                </View>
                <Text
                  style={{
                    width: "20%",
                    textAlign: "center",
                    fontSize: "12px",
                  }}
                >
                  {qty || "-"}
                </Text>
                <Text
                  style={{ width: "20%", textAlign: "right", fontSize: "12px" }}
                >
                  ${amount}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Footer Total */}
        <View
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            right: 20,
            padding: 10,
            borderTop: "1px solid #ccc",
            backgroundColor: "#f5f5f5",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "bold" }}>
            Total Amount Due (USD):
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "bold" }}>
            ${grandTotal.toFixed(2)}
          </Text>
        </View>
      </Page>

      <Page>
        <Text>This is some sample page text</Text>
      </Page>
    </Document>
  );
}

function EstimatePDFButton({
  estimate,
  selectedDiagram,
  project,
  logoUrl,
  estimateData,
  activeModal,
  currentUser,
  fileName = "estimate.pdf",
}) {
  return (
    <PDFDownloadLink
      document={
        <EstimatePDF
          estimate={estimate}
          estimateData={estimateData}
          selectedDiagram={selectedDiagram}
          project={project}
          logoUrl={logoUrl}
          activeModal={activeModal}
          currentUser={currentUser}
          products={
            estimate?.products /* pass products if you store them here */
          }
        />
      }
      fileName={fileName}
    >
      {({ loading }) => (loading ? "Generating PDF..." : "Download Estimate")}
    </PDFDownloadLink>
  );
}

export { EstimatePDFButton, EstimatePDF };
