import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Image,
} from "@react-pdf/renderer";
import { useEffect, useState } from "react";
import { getCurrentDate } from "../../utils/constants";
import { capitalizeFirstLetter } from "../../utils/constants";

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 100 },
  section: { marginBottom: 15, borderBottom: "1px solid grey" },
  header: {
    fontSize: 28,
    marginBottom: 15,
    textAlign: "right",
  },
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
  // If callers pass `estimate` instead of `estimateData`, we’ll still work:
  estimate,
}) {
  const [token, setToken] = useState("");
  const [itemizedArray, setItemizedArray] = useState([]);

  // Resolve estimate fields regardless of prop name
  const estimateDataResolved = estimateData || estimate || {};

  useEffect(() => {
    const t = localStorage.getItem("jwt");
    setToken(t || "");
  }, []);

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

  // Build a single combined list of items from lines + accessoryData
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
        // Group by size/type for downspouts
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

    // 2) Accessory data: [0]=endcaps, [1]=miters, [2]=custom miters
    const endCapsObj = accessoryData?.[0] || {};
    const mitersObj = accessoryData?.[1] || {};
    const customObj = accessoryData?.[2] || {};

    function pushAccessoryObject(obj) {
      if (!obj) return;
      Object.keys(obj).forEach((profile) => {
        const row = obj[profile];
        if (!row) return;

        const name = row.product?.name || row.name || `${profile} accessory`;

        const price = Number(row.price ?? row.product?.price ?? 0) || 0;

        const quantity = Number(row.quantity || 0);
        const description = row.product?.description || "";

        if (quantity > 0) {
          items.push({
            item: name,
            quantity,
            price,
            description,
          });
        }
      });
    }

    pushAccessoryObject(endCapsObj);
    pushAccessoryObject(mitersObj);
    pushAccessoryObject(customObj);

    // 3) Optional: add misc counters as separate rows (with price=0 by default)
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

  // (Optional) If you add ad-hoc items elsewhere, use functional setter to avoid races
  function injectMiscItem({ name, quantity, price, description = "" }) {
    const formattedMiscItem = {
      item: name,
      quantity,
      price,
      description,
    };
    setItemizedArray((prev) => [...prev, formattedMiscItem]);
  }

  // Rebuild the items when the diagram (or modal trigger) changes
  useEffect(() => {
    const next = buildItemized(selectedDiagram);
    setItemizedArray(next);
  }, [selectedDiagram, activeModal]);

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
                  $
                  {selectedDiagram?.price !== undefined &&
                  selectedDiagram?.price !== null
                    ? String(selectedDiagram.price)
                    : "N/A"}
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
                  style={{
                    width: 150,
                    height: 150,
                    objectFit: "contain",
                  }}
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

          {/* Item Rows */}
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
                    {line.item || "N/A"}
                  </Text>
                  {line.description ? (
                    <Text
                      style={{
                        fontSize: "10px",
                        color: "#555",
                        marginTop: 2,
                      }}
                    >
                      {line.description}
                    </Text>
                  ) : null}
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
                  style={{
                    width: "20%",
                    textAlign: "right",
                    fontSize: "12px",
                  }}
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
            $
            {selectedDiagram?.price !== undefined &&
            selectedDiagram?.price !== null
              ? String(selectedDiagram.price)
              : "N/A"}
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
