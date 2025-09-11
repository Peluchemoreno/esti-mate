import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Image,
} from "@react-pdf/renderer";
import { useEffect, useState, useMemo } from "react";
import { getCurrentDate } from "../../utils/constants";
import { capitalizeFirstLetter } from "../../utils/constants";

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 100 },
  section: { marginBottom: 15, borderBottom: "1px solid grey" },
  header: { fontSize: 28, marginBottom: 15, textAlign: "right" },
  text: { fontSize: 14, marginBottom: 5 },
  smallerText: { fontSize: 12, marginBottom: 5 },
  bold: { fontWeight: "bold" },
  itemsHeader: { display: "flex", flexDirection: "row" },
});

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
  const [token, setToken] = useState("");
  const [itemizedArray, setItemizedArray] = useState([]);
  const estimateDataResolved = estimateData || estimate || {};

  useEffect(() => {
    const t = localStorage.getItem("jwt");
    setToken(t || "");
  }, []);

  useEffect(() => {
    console.log(selectedDiagram);
    console.log(products);
  }, [selectedDiagram, products]);

  const grandTotal = useMemo(() => {
    return (itemizedArray || []).reduce((sum, row) => {
      const qty = Number(row.quantity || 0);
      const price = Number(row.price || 0);
      return sum + qty * price;
    }, 0);
  }, [itemizedArray]);

  // ===== Helpers =====
  function getMiscItems(diagram) {
    let splashBlocks = 0;
    let rainBarrelConnections = 0;
    let undergroundDrainageConnections = 0;

    (diagram?.lines || []).forEach((line) => {
      if (line.isDownspout) {
        if (line.splashBlock) splashBlocks++;
        if (line.rainBarrel) rainBarrelConnections++;
        if (line.undergroundDrainage) undergroundDrainageConnections++;
      }
    });

    return {
      splashBlocks,
      rainBarrelConnections,
      undergroundDrainageConnections,
    };
  }

  function capitalizeWords(str) {
    return String(str || "")
      .split(" ")
      .map((w) => capitalizeFirstLetter(w))
      .join(" ");
  }

  // ---------- Normalization / parsing utilities (shared) ----------
  const normalize = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/["“”]/g, '"')
      .replace(/\b(in|inch|inches)\b/g, '"')
      .replace(/\s+/g, " ")
      .trim();

  const hasMaterial = (nameOrDesc, material) => {
    if (!material) return false;
    const n = normalize(nameOrDesc);
    const m = normalize(material);
    if (m === "aluminum")
      return n.includes("alum") || n.includes("aluminum") || n.includes("al");
    if (m === "copper") return n.includes("copper") || n.includes("cu");
    return n.includes(m);
  };

  const extractSize = (nameOrDesc) => {
    const n = normalize(nameOrDesc).replace(/×/g, "x");
    // Common sizes; expand if you support more
    const m = n.match(/\b(\d\s*x\s*\d)\b/);
    return m ? m[1].replace(/\s*/g, "") : null; // "2x3"
  };

  const extractKind = (nameOrDesc) => {
    const n = normalize(nameOrDesc);
    if (n.includes("offset")) return "offset";
    if (n.includes("elbow") || n.includes("elb")) return "elbow";
    return null;
  };

  const extractElbowLetter = (nameOrDesc) => {
    const n = normalize(nameOrDesc);
    // Look for standalone A/B/C or patterns around "elbow"
    const m =
      n.match(/\b([abc])\b/) ||
      n.match(/\belbow\s*([abc])\b/) ||
      n.match(/\b([abc])\s*elbow\b/);
    return m ? m[1].toUpperCase() : null;
  };

  const extractOffsetInches = (nameOrDesc) => {
    const n = normalize(nameOrDesc);
    const m = n.match(/\b(2|4|6)\s*(?:"|in)\b/);
    return m ? m[1] : null;
  };

  const hasSizeLoose = (nameOrDesc, size) => {
    if (!size) return false;
    const n = normalize(nameOrDesc).replace(/×/g, "x");
    const sz = normalize(size);
    return (
      n.includes(sz) ||
      n.includes(sz.replace("x", " x ")) ||
      n.includes(sz.replace("x", "×"))
    );
  };

  const isElbow = (nameOrDesc) => {
    const n = normalize(nameOrDesc);
    return n.includes("elbow") || n.includes("elb");
  };

  const isOffset = (nameOrDesc) => {
    const n = normalize(nameOrDesc);
    return n.includes("offset");
  };

  const hasOffsetInches = (nameOrDesc, inches) => {
    const n = normalize(nameOrDesc);
    return (
      n.includes(`${inches}"`) ||
      n.includes(`${inches} "`) ||
      n.includes(`${inches}in`)
    );
  };

  // ---------- Index builder ----------
  function buildProductIndex(list) {
    // key: `${size}|${kind}|${material}|${detail}`
    // detail = elbow letter ("A"/"B"/"C") OR offset inches ("2"/"4"/"6")
    const index = new Map();

    const put = (key, product) => {
      if (!key) return;
      const existing = index.get(key);
      // Prefer entries that actually have a numeric price
      const priceScore = (p) => (typeof p?.price === "number" ? 1 : 0);
      if (!existing || priceScore(product) > priceScore(existing)) {
        index.set(key, product);
      }
    };

    (list || []).forEach((p) => {
      const name = p?.name || "";
      const desc = p?.description || "";
      const both = `${name} ${desc}`;

      const size = extractSize(both);
      const kind = extractKind(both); // elbow | offset | null
      if (!size || !kind) return;

      const materialAlum = hasMaterial(both, "aluminum");
      const materialCu = hasMaterial(both, "copper");
      const material = materialAlum ? "aluminum" : materialCu ? "copper" : "";

      if (kind === "elbow") {
        // Try to capture the letter; some catalogs omit it
        const letter = extractElbowLetter(both);
        const detailCandidates = letter ? [letter] : ["A", "B", "C"]; // if unknown, index under all letters as a fallback
        detailCandidates.forEach((detail) => {
          put(`${size}|elbow|${material}|${detail}`, p);
          // also material-agnostic fallback
          put(`${size}|elbow||${detail}`, p);
        });
      } else if (kind === "offset") {
        const inches = extractOffsetInches(both);
        const detailCandidates = inches ? [inches] : ["2", "4", "6"]; // if unknown, index under all common inches
        detailCandidates.forEach((detail) => {
          put(`${size}|offset|${material}|${detail}`, p);
          // material-agnostic fallback
          put(`${size}|offset||${detail}`, p);
        });
      }
    });

    return index;
  }

  // ---------- Main builder ----------
  function buildItemized(diagram) {
    if (!diagram) return [];
    const { lines = [], accessoryData = [] } = diagram;
    const items = [];

    // 1) Aggregate line items (downspouts + non-downspouts)
    const table = {}; // key => { quantity, refLine }
    lines.forEach((line) => {
      if (!line || line.isNote) return;

      let key;
      let refLine = line;

      if (line.isDownspout) {
        const sizeLabel = line.downspoutSize || "";
        key = `Downspout ${sizeLabel}`.trim();
      } else {
        key = line.currentProduct?.name || "Unknown Item";
      }

      const qty = Number(line.measurement || 0);
      if (table[key]) {
        table[key] = {
          quantity: table[key].quantity + qty,
          refLine: table[key].refLine,
        };
      } else {
        table[key] = { quantity: qty, refLine };
      }
    });

    Object.entries(table).forEach(([key, { quantity, refLine }]) => {
      const price =
        Number(refLine?.currentProduct?.price ?? refLine?.price ?? 0) || 0;

      const description =
        (refLine?.currentProduct?.description ??
          (refLine?.isDownspout
            ? `Downspout ${refLine.downspoutSize || ""}`.trim()
            : "")) ||
        "";

      items.push({
        item: key,
        quantity,
        price,
        description,
      });
    });

    // 2) Accessories – new shape if present, else legacy fallback
    if (diagram?.accessories?.accessoryLineItems?.length) {
      const mapped = diagram.accessories.accessoryLineItems.map((li) => ({
        item: li.name,
        quantity: Number(li.quantity || 0),
        price: Number(li.price || 0),
        description: li.product?.description || "",
      }));
      items.push(...mapped);
    } else {
      const endCapsObj = accessoryData?.[0] || {};
      const mitersObj = accessoryData?.[1] || {};
      const customObj = accessoryData?.[2] || {};

      function pushAccessoryObject(obj) {
        if (!obj) return;
        Object.keys(obj).forEach((profile) => {
          const val = obj[profile];
          if (Array.isArray(val)) {
            val.forEach((row) => {
              if (!row) return;
              const name =
                row.product?.name || row.name || `${profile} accessory`;
              const price = Number(row.price ?? row.product?.price ?? 0) || 0;
              const quantity = Number(row.quantity || 0);
              const description = row.product?.description || "";
              if (quantity > 0) {
                items.push({ item: name, quantity, price, description });
              }
            });
          } else if (val && typeof val === "object") {
            const name =
              val.product?.name || val.name || `${profile} accessory`;
            const price = Number(val.price ?? val.product?.price ?? 0) || 0;
            const quantity = Number(val.quantity || 0);
            const description = val.product?.description || "";
            if (quantity > 0) {
              items.push({ item: name, quantity, price, description });
            }
          }
        });
      }

      pushAccessoryObject(endCapsObj);
      pushAccessoryObject(mitersObj);
      pushAccessoryObject(customObj);
    }

    // 3) Downspout parts (A, B, C, 2", 4", 6" offsets) by type and material
    const downspoutPartsTable = {}; // { "type|material": { A: n, B: n, C: n, 2: n, 4: n, 6: n } }

    // Prefer a richer product list if available
    const allProductsList =
      Array.isArray(diagram?.unfilteredProducts) &&
      diagram.unfilteredProducts.length
        ? diagram.unfilteredProducts
        : Array.isArray(products)
        ? products
        : [];

    // Build index ONCE
    const productIndex = buildProductIndex(allProductsList);

    // Fallback fuzzy matcher (only if index misses)
    function fuzzyMatchPartProduct({ part, type, material }) {
      const isOffsetPart = ["2", "4", "6"].includes(part);

      let candidates = allProductsList.filter((p) => {
        const both = `${p.name || ""} ${p.description || ""}`;
        if (!hasSizeLoose(both, type)) return false;

        if (isOffsetPart) {
          if (!isOffset(both)) return false;
          if (!hasOffsetInches(both, part)) return false;
        } else {
          if (!isElbow(both)) return false;
          const letter = part.toUpperCase();
          const nm = normalize(both);
          if (
            !(
              nm.includes(` ${letter} `) ||
              nm.endsWith(` ${letter}`) ||
              nm.includes(`${letter}-`) ||
              nm.includes(` ${letter} elbow`)
            )
          ) {
            // allow loose match when catalogs omit the letter
          }
        }

        return material ? hasMaterial(both, material) : true;
      });

      if (!candidates.length) {
        candidates = allProductsList.filter((p) => {
          const both = `${p.name || ""} ${p.description || ""}`;
          if (!hasSizeLoose(both, type)) return false;
          if (isOffsetPart) {
            if (!isOffset(both)) return false;
            if (!hasOffsetInches(both, part)) return false;
          } else {
            if (!isElbow(both)) return false;
          }
          return true;
        });
      }

      const best = candidates.sort((a, b) => {
        const aMat =
          material && hasMaterial(`${a.name} ${a.description}`, material)
            ? 1
            : 0;
        const bMat =
          material && hasMaterial(`${b.name} ${b.description}`, material)
            ? 1
            : 0;
        const aPrice = typeof a.price === "number" ? 1 : 0;
        const bPrice = typeof b.price === "number" ? 1 : 0;
        return bMat - aMat || bPrice - aPrice;
      })[0];

      return best;
    }

    // Count parts by size/material
    lines.forEach((line) => {
      if (!line?.isDownspout) return;
      const type = line.downspoutSize || ""; // "2x3" | "3x4"
      const material = line.downspoutMaterial || ""; // "aluminum" | "copper" | ""

      const key = `${type}|${material || "unknown"}`;
      if (!downspoutPartsTable[key]) {
        downspoutPartsTable[key] = { A: 0, B: 0, C: 0, 2: 0, 4: 0, 6: 0 };
      }

      (line.elbowSequence || "")
        .toUpperCase()
        .split("")
        .forEach((char) => {
          if (["A", "B", "C", "2", "4", "6"].includes(char)) {
            downspoutPartsTable[key][char]++;
          }
        });
    });

    // Emit items with indexed (O(1)) lookups first, then fuzzy fallback
    Object.entries(downspoutPartsTable).forEach(([key, parts]) => {
      const [type, materialRaw] = key.split("|");
      const material = materialRaw === "unknown" ? "" : materialRaw;

      Object.entries(parts).forEach(([part, qty]) => {
        if (qty <= 0) return;

        const kind = ["2", "4", "6"].includes(part) ? "offset" : "elbow";
        const detail = part; // "A"/"B"/"C" or "2"/"4"/"6"

        // 1) exact with material
        let product = productIndex.get(`${type}|${kind}|${material}|${detail}`);
        // 2) exact without material
        if (!product) product = productIndex.get(`${type}|${kind}||${detail}`);
        // 3) fuzzy as last resort
        if (!product) product = fuzzyMatchPartProduct({ part, type, material });

        const label =
          kind === "offset"
            ? `${type} ${material ? material + " " : ""}${detail}" Offset`
            : `${type} ${material ? material + " " : ""}${detail} Elbow`;

        const priceNum = Number(product?.price);
        const price = Number.isFinite(priceNum) ? priceNum : 0;

        if (!price) {
          console.warn("No price matched for part:", {
            label,
            part,
            type,
            material,
            via: product ? "no-price-product" : "not-found",
          });
        }

        items.push({
          item: label.trim(),
          quantity: qty,
          price,
          description: product?.description || "",
          missingPrice: !price,
        });
      });
    });

    // 4) Optional: add misc counters as separate rows (with price=0 by default)
    const misc = getMiscItems(diagram);
    if (misc.splashBlocks > 0) {
      items.push({
        item: "Splash Block",
        quantity: misc.splashBlocks,
        price: 0,
        description: "",
      });
    }
    if (misc.rainBarrelConnections > 0) {
      items.push({
        item: "Rain Barrel Connection",
        quantity: misc.rainBarrelConnections,
        price: 0,
        description: "",
      });
    }
    if (misc.undergroundDrainageConnections > 0) {
      items.push({
        item: "Underground Drainage Connection",
        quantity: misc.undergroundDrainageConnections,
        price: 0,
        description: "",
      });
    }

    return items;
  }

  // (Optional) add ad-hoc items elsewhere
  function injectMiscItem({ name, quantity, price, description = "" }) {
    const formattedMiscItem = { item: name, quantity, price, description };
    setItemizedArray((prev) => [...prev, formattedMiscItem]);
  }

  // Rebuild items on changes
  useEffect(() => {
    const next = buildItemized(selectedDiagram);
    setItemizedArray(next);
  }, [selectedDiagram, activeModal]); // eslint-disable-line react-hooks/exhaustive-deps

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

          {itemizedArray.map((line, index) => {
            const qty = Number(line.quantity || 0);
            const price = Number(line.price || 0);
            const amount = (qty * price).toFixed(2);

            return (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  padding: 8,
                  borderBottom: "1px solid #eee",
                  alignItems: "center",
                }}
              >
                <View style={{ width: "60%" }}>
                  <Text style={{ fontSize: "12px", fontWeight: "bold" }}>
                    {capitalizeWords(line.item || "N/A")}
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
        />
      }
      fileName={fileName}
    >
      {({ loading }) => (loading ? "Generating PDF..." : "Download Estimate")}
    </PDFDownloadLink>
  );
}

export { EstimatePDFButton, EstimatePDF };
